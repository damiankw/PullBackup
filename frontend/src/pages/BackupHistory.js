import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import api from '../api';

export default function BackupHistory() {
  const [history, setHistory] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [logDialogOpen, setLogDialogOpen] = useState(false);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await api.get('/backup-history/');
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch backup history:', error);
    }
  };

  const handleViewLog = (entry) => {
    setSelectedLog(entry);
    setLogDialogOpen(true);
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      success: { label: 'Success', color: 'success' },
      failed: { label: 'Failed', color: 'error' },
      running: { label: 'Running', color: 'info' },
      pending: { label: 'Pending', color: 'default' },
      cancelled: { label: 'Cancelled', color: 'warning' },
    };

    const config = statusConfig[status] || { label: status, color: 'default' };
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (started, completed) => {
    if (!started || !completed) return 'N/A';
    const start = new Date(started);
    const end = new Date(completed);
    const seconds = Math.floor((end - start) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Backup History
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Job ID</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Data Transferred</TableCell>
              <TableCell>Files</TableCell>
              <TableCell>Triggered By</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{entry.backup_job_id}</TableCell>
                <TableCell>{getStatusChip(entry.status)}</TableCell>
                <TableCell>
                  {entry.started_at ? new Date(entry.started_at).toLocaleString() : 'Not started'}
                </TableCell>
                <TableCell>
                  {formatDuration(entry.started_at, entry.completed_at)}
                </TableCell>
                <TableCell>{formatBytes(entry.bytes_transferred)}</TableCell>
                <TableCell>{entry.files_transferred}</TableCell>
                <TableCell>
                  <Chip label={entry.triggered_by || 'Unknown'} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleViewLog(entry)}>
                    <VisibilityIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={logDialogOpen} onClose={() => setLogDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Backup Log Details</DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                <strong>Backup Job ID:</strong> {selectedLog.backup_job_id}
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                <strong>Status:</strong> {getStatusChip(selectedLog.status)}
              </Typography>
              {selectedLog.error_message && (
                <Typography variant="subtitle2" color="error" gutterBottom>
                  <strong>Error:</strong> {selectedLog.error_message}
                </Typography>
              )}
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                <strong>Output Log:</strong>
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  maxHeight: '400px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {selectedLog.log_output || 'No log output available'}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
