from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
import asyncio
import os
import subprocess
import tempfile
import threading
from datetime import datetime

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.models import Server, User, AuditAction
from app.services.audit_service import audit_service

router = APIRouter()


def _get_user_from_token(token: str, db: Session) -> User | None:
    payload = decode_access_token(token)
    if not payload:
        return None
    username = payload.get('sub')
    if not username:
        return None
    return db.query(User).filter(User.username == username).first()


@router.websocket('/ws/{server_id}')
async def websocket_ssh(websocket: WebSocket, server_id: int, token: str = Query(None)):
    """WebSocket endpoint that proxies a local ssh process to the browser terminal.

    Authentication: provide `?token=<JWT>` in the websocket URL. The token is
    validated against the same JWT decoder used for HTTP routes.
    """
    await websocket.accept()

    db = SessionLocal()
    try:
        user = _get_user_from_token(token, db)
        if user is None:
            await websocket.close(code=1008)
            return

        server = db.query(Server).filter(Server.id == server_id).first()
        if not server:
            await websocket.close(code=1008)
            return

        # Permission: only admin allowed to open terminal
        if getattr(user, 'role', None) != 'admin':
            await websocket.close(code=1008)
            return

        ssh_key_path = server.ssh_key.key_file_path if server.ssh_key else None

        # Write host key to a temp known_hosts file if stored; else fall back to no-check
        temp_known_hosts = None
        if server.host_key:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.known_hosts', delete=False) as f:
                f.write(server.host_key.strip() + '\n')
                temp_known_hosts = f.name

        # Open a pseudo-tty for the ssh process
        master_fd, slave_fd = os.openpty()

        cmd = ['ssh']
        if temp_known_hosts:
            cmd += ['-o', 'StrictHostKeyChecking=yes', '-o', f'UserKnownHostsFile={temp_known_hosts}']
        else:
            cmd += ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null']
        cmd += ['-p', str(server.port)]
        if ssh_key_path:
            cmd.extend(['-i', ssh_key_path])
        cmd.append(f"{server.username}@{server.hostname}")

        proc = subprocess.Popen(
            cmd,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            preexec_fn=os.setsid,
            close_fds=True
        )
        os.close(slave_fd)

        session_start = datetime.now()
        client_ip = (
            websocket.headers.get("CF-Connecting-IP")
            or websocket.headers.get("X-Real-IP")
            or (websocket.client.host if websocket.client else None)
        )
        audit_service.log(
            db=db,
            action=AuditAction.EXECUTE,
            user=user,
            resource_type="terminal",
            resource_id=server.id,
            resource_name=server.name,
            description=f"Opened terminal session to {server.name} ({server.hostname})",
            ip_address=client_ip,
            user_agent=websocket.headers.get("User-Agent"),
        )

        loop = asyncio.get_event_loop()

        stop_event = threading.Event()

        def read_from_pty():
            try:
                while not stop_event.is_set():
                    try:
                        data = os.read(master_fd, 1024)
                    except OSError:
                        break
                    if not data:
                        break
                    # send to websocket in event loop
                    asyncio.run_coroutine_threadsafe(websocket.send_text(data.decode(errors='replace')), loop)
            finally:
                try:
                    asyncio.run_coroutine_threadsafe(websocket.close(), loop)
                except Exception:
                    pass

        reader_thread = threading.Thread(target=read_from_pty, daemon=True)
        reader_thread.start()

        try:
            while True:
                msg = await websocket.receive_text()
                # write incoming data to pty
                try:
                    os.write(master_fd, msg.encode())
                except OSError:
                    break
        except WebSocketDisconnect:
            pass
        finally:
            stop_event.set()
            try:
                proc.terminate()
            except Exception:
                pass
            try:
                reader_thread.join(timeout=1)
            except Exception:
                pass
            try:
                os.close(master_fd)
            except Exception:
                pass
            if temp_known_hosts:
                try:
                    os.unlink(temp_known_hosts)
                except OSError:
                    pass
            duration = int((datetime.now() - session_start).total_seconds())
            audit_service.log(
                db=db,
                action=AuditAction.EXECUTE,
                user=user,
                resource_type="terminal",
                resource_id=server.id,
                resource_name=server.name,
                description=f"Closed terminal session to {server.name} ({server.hostname}), duration {duration}s",
                ip_address=client_ip,
                user_agent=websocket.headers.get("User-Agent"),
            )
    finally:
        db.close()
