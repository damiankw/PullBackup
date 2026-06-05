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
  const wsRef = useRef(null);

  useEffect(() => {
    const t = new XTerm({ cols: 80, rows: 24 });
    // attach FitAddon lazily after xterm internal viewport is available
    let fit = null;
    // open terminal when the ref is available
    try {
      if (xtermRef.current) {
        t.open(xtermRef.current);
        const el = xtermRef.current;

        const maybeFit = () => {
          const fitLocal = fit || fitAddonRef.current;
          if (!fitLocal) return;
          // guard internal xterm core/viewport presence to avoid reading `dimensions`
          try {
            const core = t && t._core;
            const viewport = core && core.viewport;
            if (viewport && typeof viewport.dimensions !== 'undefined' && el.clientWidth > 0 && el.clientHeight > 0) {
              fitLocal.fit();
            }
          } catch (err) {
            // transient error — retry shortly in case core/viewport isn't initialized yet
            try {
              setTimeout(() => {
                try {
                  if (el.clientWidth > 0 && el.clientHeight > 0) fitLocal.fit();
                } catch (_) {}
              }, 100);
            } catch (_) {}
          }
        };

        // try to attach FitAddon if/when the core.viewport becomes available
        const attachFitIfReady = () => {
          try {
            if (!fit && t && t._core && t._core.viewport) {
              fit = new FitAddon();
              try { t.loadAddon(fit); } catch (_) {}
              fitAddonRef.current = fit;
            }
          } catch (_) {}
        };

        // initial attempt
        attachFitIfReady();
        maybeFit();

        // Observe size changes and call fit when the terminal container is visible
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
      try { t.dispose(); } catch (_e) {}
      if (resizeObserverRef.current) {
        try { resizeObserverRef.current.disconnect(); } catch (_e) {}
        resizeObserverRef.current = null;
      }
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
      try { term?.writeln('\x1b[32mConnected to server\x1b[0m'); } catch (e) {}
      try { term?.focus(); } catch (e) {}
    };

    ws.onmessage = (ev) => {
      try { if (term) term.write(ev.data); } catch (e) {}
    };

    ws.onclose = () => {
      try { term?.writeln('\r\n\x1b[31mConnection closed\x1b[0m'); } catch (e) {}
      // dispose onData listener if set
      if (wsRef.current?.dataListener) {
        try { wsRef.current.dataListener.dispose(); } catch (_e) {}
        wsRef.current.dataListener = null;
      }
    };

    ws.onerror = (e) => {
      try { term?.writeln('\r\n\x1b[31mWebSocket error\x1b[0m'); } catch (e) {}
    };

    if (term) {
      // remove previous listener if present
      if (wsRef.current?.dataListener) {
        try { wsRef.current.dataListener.dispose(); } catch (_e) {}
      }
      const listener = term.onData(data => {
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
