import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, MenuItem, Select, Typography, Paper } from '@mui/material';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import api from '../api';

export default function TerminalPage() {
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [term, setTerm] = useState(null);
  const [servers, setServers] = useState([]);
  const [selected, setSelected] = useState('');
  const wsRef = useRef(null);

  useEffect(() => {
    const t = new XTerm({ cols: 80, rows: 24 });
    const fit = new FitAddon();
    t.loadAddon(fit);
    t.open(xtermRef.current);
    fit.fit();
    setTerm(t);
    fitAddonRef.current = fit;

    const handleResize = () => {
      try { fit.fit(); } catch (e) {}
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      t.dispose();
    };
  }, []);

  useEffect(() => {
    api.get('/servers/').then(res => setServers(res.data)).catch(() => setServers([]));
  }, []);

  const connect = () => {
    if (!selected) return;
    const token = localStorage.getItem('token');
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${window.location.host}/api/terminal/ws/${selected}?token=${token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      term.writeln('\x1b[32mConnected to server\x1b[0m');
      term.focus();
    };

    ws.onmessage = (ev) => {
      term.write(ev.data);
    };

    ws.onclose = () => {
      term.writeln('\r\n\x1b[31mConnection closed\x1b[0m');
    };

    ws.onerror = (e) => {
      term.writeln('\r\n\x1b[31mWebSocket error\x1b[0m');
    };

    term.onData(data => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Terminal</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">Select a server to open an interactive SSH terminal.</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 2 }}>
          <Select value={selected} onChange={(e) => setSelected(e.target.value)} displayEmpty sx={{ minWidth: 300 }}>
            <MenuItem value="">Select server</MenuItem>
            {servers.map(s => (
              <MenuItem key={s.id} value={s.id}>{s.name} — {s.hostname}</MenuItem>
            ))}
          </Select>
          <Button variant="contained" color="primary" onClick={connect} disabled={!selected}>Connect</Button>
          <Button variant="outlined" color="error" onClick={disconnect}>Disconnect</Button>
        </Box>
      </Paper>

      <Box sx={{ height: '70vh', borderRadius: 2, overflow: 'hidden' }}>
        <div ref={xtermRef} style={{ height: '100%', width: '100%' }} />
      </Box>
    </Box>
  );
}
