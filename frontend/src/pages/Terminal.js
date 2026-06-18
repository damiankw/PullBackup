import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, MenuItem, Select, Typography, Paper } from '@mui/material';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import api from '../api';

export default function TerminalPage() {
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const [term, setTerm] = useState(null);
  const [servers, setServers] = useState([]);
  const [selected, setSelected] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const wsRef = useRef(null);

  // Create XTerm lazily when the user clicks Connect to avoid timing issues
  const createTerminal = () => {
    if (term) return term;
    const t = new XTerm({ cols: 80, rows: 24 });
    let fit = null;
    try { window.__terminalDebug = window.__terminalDebug || []; } catch (_) {}
    console.log('Terminal: creating xterm instance');

    try {
      if (xtermRef.current) {
        t.open(xtermRef.current);
        const el = xtermRef.current;

        const maybeFit = () => {
          const fitLocal = fit || fitAddonRef.current;
          if (!fitLocal) return;
          try {
            const core = t && t._core;
            const viewport = core && core.viewport;
            if (viewport && typeof viewport.dimensions !== 'undefined' && el.clientWidth > 0 && el.clientHeight > 0) {
              fitLocal.fit();
            }
          } catch (err) {
            try {
              setTimeout(() => {
                try { if (el.clientWidth > 0 && el.clientHeight > 0) fitLocal.fit(); } catch (_) {}
              }, 100);
            } catch (_) {}
          }
        };

        const attachFitIfReady = () => {
          try {
            if (!fit && t && t._core && t._core.viewport) {
              fit = new FitAddon();
              try { t.loadAddon(fit); } catch (_) {}
              fitAddonRef.current = fit;
            }
          } catch (_) {}
        };

        attachFitIfReady();
        maybeFit();

        if (typeof ResizeObserver !== 'undefined') {
          const ro = new ResizeObserver(() => {
            try { attachFitIfReady(); maybeFit(); } catch (e) {}
          });
          ro.observe(el);
          resizeObserverRef.current = ro;
        }
      }
    } catch (e) {
      console.warn('Failed to open xterm:', e);
    }

    setTerm(t);
    fitAddonRef.current = fit;
    return t;
  };

  useEffect(() => {
    const handleResize = () => {
      const fit = fitAddonRef.current;
      const el = xtermRef.current;
      if (!fit || !el || !term) return;
      try {
        const core = term && term._core;
        const viewport = core && core.viewport;
        if (viewport && typeof viewport.dimensions !== 'undefined' && el.clientWidth > 0 && el.clientHeight > 0) {
          fit.fit();
        }
      } catch (e) {}
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      try { term?.dispose(); } catch (_e) {}
      if (resizeObserverRef.current) {
        try { resizeObserverRef.current.disconnect(); } catch (_e) {}
        resizeObserverRef.current = null;
      }
    };
  }, [term]);

  useEffect(() => {
    api.get('/servers/').then(res => setServers(res.data)).catch(() => setServers([]));
  }, []);

  // fetch current user to determine admin privileges
  useEffect(() => {
    api.get('/users/me').then(res => {
      try {
        setIsAdmin(res.data?.role === 'admin');
      } catch (e) {
        setIsAdmin(false);
      }
    }).catch(() => setIsAdmin(false));
  }, []);

  // auto-select first server when servers list loads
  useEffect(() => {
    if (servers && servers.length && !selected) {
      setSelected(servers[0].id);
    }
  }, [servers]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = () => {
    if (!selected) return;
    const t = createTerminal();
    try { window.__terminalDebug.push({evt:'connect_attempt', selected}); } catch (_) {}
    console.log('Terminal.connect', { selected, hasTerm: !!t });
    const token = localStorage.getItem('token');
    try { window.__terminalDebug.push({evt:'token_present', hasToken: !!token}); } catch (_) {}
    console.log('Terminal token:', token);
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

    // Prefer explicit backend host in development to avoid CRA dev-server not proxying WS.
    let backendHost;
    try {
      if (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.startsWith('http')) {
        backendHost = new URL(process.env.REACT_APP_API_URL).host;
      } else {
        const devPort = process.env.REACT_APP_API_PORT || (window.location.port === '3000' ? '8000' : window.location.port || '');
        backendHost = devPort ? `${window.location.hostname}:${devPort}` : window.location.hostname;
      }
    } catch (e) {
      backendHost = `${window.location.hostname}:8000`;
    }

    const url = `${protocol}://${backendHost}/api/terminal/ws/${selected}`;
    try { window.__terminalDebug.push({evt:'ws_url', url}); } catch (_) {}
    console.log('Terminal.connect url', url);
    try { t?.writeln('\r\n\x1b[33mConnecting to server...\x1b[0m\r\n'); } catch (_) {}
    try { window.__terminalDebug.push({evt:'wrote_connect_message'}); } catch (_) {}
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      try { window.__terminalDebug.push({evt:'ws_open'}); } catch (_) {}
      console.log('Terminal WebSocket open');
      ws.send(token);
      try { t?.writeln('\x1b[32mConnected to server\x1b[0m'); } catch (e) {}
      try { t?.focus(); } catch (e) {}
    };

    ws.onmessage = (ev) => {
      try { window.__terminalDebug.push({evt:'ws_message', data: ev.data && ev.data.slice ? ev.data.slice(0,200) : ev.data}); } catch (_) {}
      console.log('Terminal WebSocket message', ev.data && ev.data.slice ? ev.data.slice(0,100) : ev.data);
      try { if (t) t.write(ev.data); } catch (e) {}
    };

    ws.onclose = (ev) => {
      try { window.__terminalDebug.push({evt:'ws_close', code: ev?.code}); } catch (_) {}
      try { term?.writeln('\r\n\x1b[31mConnection closed\x1b[0m'); } catch (e) {}
      // dispose onData listener if set
      if (wsRef.current?.dataListener) {
        try { wsRef.current.dataListener.dispose(); } catch (_e) {}
        wsRef.current.dataListener = null;
      }
    };

    ws.onerror = (e) => {
      try { window.__terminalDebug.push({evt:'ws_error', err: String(e)}); } catch (_) {}
      console.error('Terminal WebSocket error', e);
      try { t?.writeln('\r\n\x1b[31mWebSocket error\x1b[0m'); } catch (e) {}
    };

    if (t) {
      // remove previous listener if present
      if (wsRef.current?.dataListener) {
        try { wsRef.current.dataListener.dispose(); } catch (_e) {}
      }
      const listener = t.onData(data => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
      wsRef.current.dataListener = listener;
    }
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
          <Button variant="contained" color="primary" onClick={connect} disabled={!selected || !isAdmin}>Connect</Button>
          <Button variant="outlined" color="error" onClick={disconnect}>Disconnect</Button>
        </Box>
      </Paper>

      {!isAdmin && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: '#fff3f0' }}>
          <Typography variant="body2" color="text.secondary">Terminal access is restricted to administrators only.</Typography>
        </Paper>
      )}

      <Box sx={{ height: '70vh', borderRadius: 2, overflow: 'hidden' }}>
        <div ref={xtermRef} style={{ height: '100%', width: '100%' }} />
      </Box>
    </Box>
  );
}
