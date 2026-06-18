import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Grid,
  Collapse,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  FilterList as FilterListIcon,
  ContentCopy as ContentCopyIcon,
  FlashOn as FlashOnIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import api from '../api';

export default function BackupHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [orderBy, setOrderBy] = useState('started_at');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const logRef = useRef(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    backup_job_id: '',
    server_id: '',
    status: '',
    started_from: '',
    started_to: ''
  });
  
  // Data for filter dropdowns
  const [backupJobs, setBackupJobs] = useState([]);
  const [servers, setServers] = useState([]);

  useEffect(() => {
    fetchBackupJobs();
    fetchServers();
  }, []);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [page, rowsPerPage, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBackupJobs = async () => {
    try {
      const response = await api.get('/backup-jobs/');
      setBackupJobs(response.data);
    } catch (error) {
      console.error('Failed to fetch backup jobs:', error);
    }
  };

  const fetchServers = async () => {
    try {
      const response = await api.get('/servers/');
      setServers(response.data);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const skip = page * rowsPerPage;
      const params = { skip, limit: rowsPerPage };
      
      // Add filters to params if they have values
      if (filters.backup_job_id) params.backup_job_id = filters.backup_job_id;
      if (filters.server_id) params.server_id = filters.server_id;
      if (filters.status) params.status = filters.status;
      if (filters.started_from) params.started_from = new Date(filters.started_from).toISOString();
      if (filters.started_to) params.started_to = new Date(filters.started_to).toISOString();
      
      const response = await api.get('/backup-history/', { params });
      setHistory(response.data);
      // If we get fewer results than limit, we know the exact total
      if (response.data.length < rowsPerPage) {
        setTotalCount(skip + response.data.length);
      } else {
        setTotalCount((page + 2) * rowsPerPage); // Estimate there's at least one more page
      }
    } catch (error) {
      console.error('Failed to fetch backup history:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0); // Reset to first page when filters change
  };

  const handleClearFilters = () => {
    setFilters({
      backup_job_id: '',
      server_id: '',
      status: '',
      started_from: '',
      started_to: ''
    });
    setPage(0);
  };

  const handleViewLog = (entry) => {
    setSelectedLog(entry);
    setLogDialogOpen(true);
  };

  const handleBrowseBackup = (entry) => {
    navigate(`/browse?job=${entry.backup_job_id}&snapshot=${formatSnapshotName(entry.started_at)}`);
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
    if (!bytes || bytes === 0) return '0 B';
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

  const formatSnapshotName = (startedAt) => {
    if (!startedAt) return null;
    const date = new Date(startedAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  };

  const handleCopySnapshot = async (snapshotName) => {
    try {
      await navigator.clipboard.writeText(snapshotName);
      setCopyMessage('Snapshot folder name copied to clipboard!');
      setCopySuccess(true);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyLog = async () => {
    try {
      await navigator.clipboard.writeText(selectedLog?.log_output || '');
      setCopyMessage('Log copied to clipboard!');
      setCopySuccess(true);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleLogKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      const el = logRef.current;
      if (!el) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
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
    
    if (orderBy === 'bytes_transferred' || orderBy === 'files_transferred') {
      aValue = aValue || 0;
      bValue = bValue || 0;
    }
    
    if (aValue < bValue) return order === 'asc' ? -1 : 1;
    if (aValue > bValue) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Backup History
        </Typography>
        <Button
          variant="outlined"
          startIcon={<FilterListIcon />}
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </Box>

      {/* Filter Panel */}
      <Collapse in={showFilters}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Backup Job</InputLabel>
                <Select
                  value={filters.backup_job_id}
                  label="Backup Job"
                  onChange={(e) => handleFilterChange('backup_job_id', e.target.value)}
                >
                  <MenuItem value="">All Jobs</MenuItem>
                  {backupJobs.map((job) => (
                    <MenuItem key={job.id} value={job.id}>{job.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Server</InputLabel>
                <Select
                  value={filters.server_id}
                  label="Server"
                  onChange={(e) => handleFilterChange('server_id', e.target.value)}
                >
                  <MenuItem value="">All Servers</MenuItem>
                  {servers.map((server) => (
                    <MenuItem key={server.id} value={server.id}>{server.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="success">Success</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                  <MenuItem value="running">Running</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="datetime-local"
                label="Started From"
                value={filters.started_from}
                onChange={(e) => handleFilterChange('started_from', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="datetime-local"
                label="Started To"
                value={filters.started_to}
                onChange={(e) => handleFilterChange('started_to', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={handleClearFilters} variant="outlined" size="small">
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>

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
                  <Box>
                    <Typography variant="body2">
                      {entry.started_at ? new Date(entry.started_at).toLocaleString() : 'Not started'}
                    </Typography>
                    {entry.started_at && entry.status === 'success' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                          {formatSnapshotName(entry.started_at)}
                        </Typography>
                        <Tooltip title="Copy snapshot folder name">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopySnapshot(formatSnapshotName(entry.started_at));
                            }}
                            sx={{ padding: '2px', color: '#14b8a6' }}
                          >
                            <ContentCopyIcon sx={{ fontSize: '0.9rem' }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
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
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="View Log">
                      <IconButton size="small" onClick={() => handleViewLog(entry)}>
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    {entry.status === 'success' && entry.started_at && (
                      <Tooltip title="Browse Backup Files">
                        <IconButton size="small" onClick={() => handleBrowseBackup(entry)} sx={{ color: '#14b8a6' }}>
                          <FolderOpenIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Rows per page</InputLabel>
          <Select
            value={rowsPerPage}
            label="Rows per page"
            onChange={(e) => {
              setRowsPerPage(e.target.value);
              setPage(0);
            }}
          >
            <MenuItem value={25}>25</MenuItem>
            <MenuItem value={50}>50</MenuItem>
            <MenuItem value={100}>100</MenuItem>
            <MenuItem value={500}>500</MenuItem>
          </Select>
        </FormControl>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Showing {page * rowsPerPage + 1} - {page * rowsPerPage + history.length} of {history.length < rowsPerPage ? totalCount : `${totalCount}+`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              sx={{ minWidth: 80 }}
            >
              Previous
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={history.length < rowsPerPage}
              onClick={() => setPage(page + 1)}
              sx={{ minWidth: 80 }}
            >
              Next
            </Button>
          </Box>
        </Box>
      </Box>

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
              {/* Volatile file transfer summary */}
              {(() => {
                const synced = selectedLog.volatile_files_synced || [];
                const failed = selectedLog.volatile_files_failed || [];
                const detected = selectedLog.new_volatile_files_detected || [];
                const hasAny = synced.length || failed.length || detected.length;
                if (!hasAny) return null;
                return (
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <FlashOnIcon sx={{ fontSize: '1rem', color: '#f59e0b' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#f59e0b' }}>
                        Volatile File Transfers
                      </Typography>
                    </Box>
                    {detected.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 600, display: 'block', mb: 0.5 }}>
                          Newly detected ({detected.length})
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {detected.map(f => (
                            <Chip key={f} label={f} size="small" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }} />
                          ))}
                        </Box>
                      </Box>
                    )}
                    {synced.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600, display: 'block', mb: 0.5 }}>
                          Synced via inplace ({synced.length})
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {synced.map(f => (
                            <Chip key={f} label={f} size="small" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }} />
                          ))}
                        </Box>
                      </Box>
                    )}
                    {failed.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 600, display: 'block', mb: 0.5 }}>
                          Failed even with inplace ({failed.length})
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {failed.map(f => (
                            <Chip key={f} label={f} size="small" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }} />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                );
              })()}

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                <strong>Output Log:</strong>
              </Typography>
              <Paper
                ref={logRef}
                tabIndex={0}
                onKeyDown={handleLogKeyDown}
                sx={{
                  p: 2,
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  maxHeight: '400px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  outline: 'none',
                  cursor: 'text',
                }}
              >
                {selectedLog.log_output || 'No log output available'}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCopyLog}
            startIcon={<ContentCopyIcon />}
            disabled={!selectedLog?.log_output}
          >
            Copy Log
          </Button>
          <Button onClick={() => setLogDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={copySuccess}
        autoHideDuration={2000}
        onClose={() => setCopySuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          {copyMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
