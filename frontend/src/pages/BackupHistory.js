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
  TableSortLabel,
  Tooltip,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import api from '../api';

export default function BackupHistory() {
  const [history, setHistory] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [orderBy, setOrderBy] = useState('started_at');
  const [order, setOrder] = useState('desc');

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

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedHistory = [...history].sort((a, b) => {
    let aValue = a[orderBy];
    let bValue = b[orderBy];
    
    // Handle nested properties for backup job name and server name
    if (orderBy === 'backup_job_name') {
      aValue = a.backup_job?.name || '';
      bValue = b.backup_job?.name || '';
    }
    
    if (orderBy === 'server_name') {
      aValue = a.backup_job?.server?.name || '';
      bValue = b.backup_job?.server?.name || '';
    }
    
    if (orderBy === 'started_at') {
      aValue = aValue ? new Date(aValue).getTime() : 0;
      bValue = bValue ? new Date(bValue).getTime() : 0;
    }
    
    if (orderBy === 'bytes_transferred' || orderBy === 'files_transferred' || orderBy === 'snapshot_size_bytes') {
      aValue = aValue || 0;
      bValue = bValue || 0;
    }
    
    if (aValue < bValue) return order === 'asc' ? -1 : 1;
    if (aValue > bValue) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Backup History
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'backup_job_name'}
                  direction={orderBy === 'backup_job_name' ? order : 'asc'}
                  onClick={() => handleSort('backup_job_name')}
                >
                  Backup Job
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'server_name'}
                  direction={orderBy === 'server_name' ? order : 'asc'}
                  onClick={() => handleSort('server_name')}
                >
                  Server
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'status'}
                  direction={orderBy === 'status' ? order : 'asc'}
                  onClick={() => handleSort('status')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'started_at'}
                  direction={orderBy === 'started_at' ? order : 'asc'}
                  onClick={() => handleSort('started_at')}
                >
                  Started
                </TableSortLabel>
              </TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'bytes_transferred'}
                  direction={orderBy === 'bytes_transferred' ? order : 'asc'}
                  onClick={() => handleSort('bytes_transferred')}
                >
                  Data Transferred
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'snapshot_size_bytes'}
                  direction={orderBy === 'snapshot_size_bytes' ? order : 'asc'}
                  onClick={() => handleSort('snapshot_size_bytes')}
                >
                  Snapshot Size
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'files_transferred'}
                  direction={orderBy === 'files_transferred' ? order : 'asc'}
                  onClick={() => handleSort('files_transferred')}
                >
                  Files
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'triggered_by'}
                  direction={orderBy === 'triggered_by' ? order : 'asc'}
                  onClick={() => handleSort('triggered_by')}
                >
                  Triggered By
                </TableSortLabel>
              </TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedHistory.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell sx={{ fontWeight: 600 }}>
                  {entry.backup_job?.name || `Job #${entry.backup_job_id}`}
                </TableCell>
                <TableCell>
                  {entry.backup_job?.server?.name || 'Unknown'}
                </TableCell>
                <TableCell>{getStatusChip(entry.status)}</TableCell>
                <TableCell>
                  {entry.started_at ? new Date(entry.started_at).toLocaleString() : 'Not started'}
                </TableCell>
                <TableCell>
                  {formatDuration(entry.started_at, entry.completed_at)}
                </TableCell>
                <TableCell>{formatBytes(entry.bytes_transferred)}</TableCell>
                <TableCell>
                  <Tooltip title={
                    entry.space_saved_bytes > 0 
                      ? `Logical: ${formatBytes(entry.snapshot_total_size_bytes)} | Saved: ${formatBytes(entry.space_saved_bytes)} (${((entry.space_saved_bytes / entry.snapshot_total_size_bytes) * 100).toFixed(1)}%)`
                      : 'First snapshot (full backup)'
                  }>
                    <span>{formatBytes(entry.snapshot_size_bytes)}</span>
                  </Tooltip>
                </TableCell>
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
                <strong>Backup Job:</strong> {selectedLog.backup_job?.name || `Job #${selectedLog.backup_job_id}`}
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                <strong>Server:</strong> {selectedLog.backup_job?.server?.name || 'Unknown'}
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
