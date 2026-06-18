import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Breadcrumbs,
  Link,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
  FolderZip as FolderZipIcon,
  ArrowBack as ArrowBackIcon,
  CalendarToday as CalendarIcon,
  Visibility as VisibilityIcon,
  ContentCopy as ContentCopyIcon,
  FiberNew as NewIcon,
  Edit as EditIcon,
  CompareArrows as CompareIcon,
} from '@mui/icons-material';
import api from '../api';

export default function BrowseBackups() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasRestoredRef = useRef(false);
  
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [jobName, setJobName] = useState('');
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewFileContent, setViewFileContent] = useState('');
  const [viewFileName, setViewFileName] = useState('');
  const [viewFileSize, setViewFileSize] = useState(0);
  const [viewLoading, setViewLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [totalActualSize, setTotalActualSize] = useState(0);
  const [totalLogicalSize, setTotalLogicalSize] = useState(0);
  const [totalSpaceSaved, setTotalSpaceSaved] = useState(0);
  const [showChanges, setShowChanges] = useState(false);
  const [hasPreviousSnapshot, setHasPreviousSnapshot] = useState(false);

  // Load backup jobs
  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const response = await api.get('/backup-jobs/');
      setJobs(response.data);
    } catch (err) {
      setError('Failed to load backup jobs');
    }
  };

  // Restore state from URL on mount (after jobs are loaded)
  useEffect(() => {
    if (jobs.length === 0 || hasRestoredRef.current) return;
    
    const jobId = searchParams.get('job');
    const snapshot = searchParams.get('snapshot');
    const path = searchParams.get('path');
    
    if (jobId) {
      setSelectedJobId(jobId);
      
      // If snapshot is in URL, load snapshots then browse it
      if (snapshot) {
        const restoreSnapshot = async () => {
          try {
            const response = await api.get(`/browse/backup-jobs/${jobId}/snapshots`);
            setSnapshots(response.data.snapshots);
            setJobName(response.data.job_name);
            setTotalActualSize(response.data.total_actual_size_bytes || 0);
            setTotalLogicalSize(response.data.total_logical_size_bytes || 0);
            setTotalSpaceSaved(response.data.total_space_saved_bytes || 0);
            setSelectedSnapshot(snapshot);
            
            // Now browse the snapshot at the specified path
            const browseResponse = await api.get(
              `/browse/backup-jobs/${jobId}/snapshots/${snapshot}/browse`,
              { params: { path: path || '' } }
            );
            setItems(browseResponse.data.items);
            setCurrentPath(path || '');
          } catch (err) {
            setError('Failed to restore previous location');
          } finally {
            hasRestoredRef.current = true;
          }
        };
        
        restoreSnapshot();
      } else {
        hasRestoredRef.current = true;
      }
    } else {
      hasRestoredRef.current = true;
    }
  }, [jobs, searchParams]);

  // Update URL when state changes (but not during initial restore)
  useEffect(() => {
    if (!hasRestoredRef.current) return; // Don't update URL until we've restored from it
    
    const params = {};
    
    if (selectedJobId) {
      params.job = selectedJobId;
    }
    if (selectedSnapshot) {
      params.snapshot = selectedSnapshot;
    }
    if (currentPath) {
      params.path = currentPath;
    }
    
    setSearchParams(params);
  }, [selectedJobId, selectedSnapshot, currentPath, setSearchParams]);

  // Load snapshots when job is selected
  useEffect(() => {
    // Skip if we haven't restored yet (avoid race condition)
    if (!hasRestoredRef.current) return;
    
    const loadSnapshotsForJob = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/browse/backup-jobs/${selectedJobId}/snapshots`);
        setSnapshots(response.data.snapshots);
        setJobName(response.data.job_name);
        setTotalActualSize(response.data.total_actual_size_bytes || 0);
        setTotalLogicalSize(response.data.total_logical_size_bytes || 0);
        setTotalSpaceSaved(response.data.total_space_saved_bytes || 0);
        setSelectedSnapshot(null);
        setCurrentPath('');
        setItems([]);
      } catch (err) {
        setError('Failed to load snapshots');
        setSnapshots([]);
      } finally {
        setLoading(false);
      }
    };

    if (selectedJobId) {
      loadSnapshotsForJob();
    } else {
      setSnapshots([]);
      setSelectedSnapshot(null);
    }
  }, [selectedJobId]);

  // Browse snapshot contents
  const browseSnapshot = async (snapshotName, path = '') => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(
        `/browse/backup-jobs/${selectedJobId}/snapshots/${snapshotName}/browse`,
        { params: { path, compare: showChanges } }
      );
      setItems(response.data.items);
      setCurrentPath(path);
      setHasPreviousSnapshot(response.data.has_previous_snapshot || false);
      if (!selectedSnapshot) {
        setSelectedSnapshot(snapshotName);
      }
    } catch (err) {
      setError('Failed to browse snapshot');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Navigate to folder
  const navigateToFolder = (folderPath) => {
    browseSnapshot(selectedSnapshot, folderPath);
  };

  // Toggle change detection
  const handleToggleChanges = () => {
    setShowChanges(!showChanges);
  };

  // Re-browse when showChanges toggles
  useEffect(() => {
    if (selectedSnapshot && hasRestoredRef.current) {
      browseSnapshot(selectedSnapshot, currentPath);
    }
  }, [showChanges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate up (parent directory)
  const navigateUp = () => {
    const pathParts = currentPath.split('/').filter(p => p);
    pathParts.pop();
    const newPath = pathParts.join('/');
    browseSnapshot(selectedSnapshot, newPath);
  };

  // Download file
  const downloadFile = async (filePath, fileName) => {
    try {
      const response = await api.get(
        `/browse/backup-jobs/${selectedJobId}/snapshots/${selectedSnapshot}/download`,
        {
          params: { path: filePath },
          responseType: 'blob',
        }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download file');
    }
  };

  // View file
  const viewFile = async (filePath, fileName, fileSize) => {
    const MAX_VIEW_SIZE = 10 * 1024 * 1024; // 10MB
    
    if (fileSize > MAX_VIEW_SIZE) {
      setSnackbar({
        open: true,
        message: `File too large to view (${formatSize(fileSize)}). Maximum size is 10MB.`,
        severity: 'error'
      });
      return;
    }
    
    try {
      setViewLoading(true);
      const response = await api.get(
        `/browse/backup-jobs/${selectedJobId}/snapshots/${selectedSnapshot}/view`,
        { params: { path: filePath } }
      );
      
      setViewFileContent(response.data.content);
      setViewFileName(response.data.filename);
      setViewFileSize(response.data.size);
      setViewModalOpen(true);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to view file';
      setSnackbar({ open: true, message: errorMsg, severity: 'error' });
    } finally {
      setViewLoading(false);
    }
  };

  // Copy file content to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(viewFileContent);
    setSnackbar({ open: true, message: 'Content copied to clipboard!', severity: 'success' });
  };

  // Download folder as zip
  const downloadFolderZip = async (folderPath, folderName) => {
    try {
      const response = await api.get(
        `/browse/backup-jobs/${selectedJobId}/snapshots/${selectedSnapshot}/download-zip`,
        {
          params: { path: folderPath },
          responseType: 'blob',
        }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${folderName}_${selectedSnapshot}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download folder');
    }
  };

  // Download entire snapshot
  const downloadSnapshot = () => {
    downloadFolderZip('', jobName);
  };

  // Format file size
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Render breadcrumbs
  const renderBreadcrumbs = () => {
    if (!selectedSnapshot) return null;
    
    const pathParts = currentPath.split('/').filter(p => p);
    const crumbs = [
      <Link
        key="root"
        component="button"
        variant="body1"
        onClick={() => browseSnapshot(selectedSnapshot, '')}
        sx={{ cursor: 'pointer', color: '#14b8a6' }}
      >
        Root
      </Link>
    ];

    let accumulatedPath = '';
    pathParts.forEach((part, index) => {
      accumulatedPath += (accumulatedPath ? '/' : '') + part;
      const pathToNavigate = accumulatedPath;
      
      crumbs.push(
        <Link
          key={index}
          component="button"
          variant="body1"
          onClick={() => browseSnapshot(selectedSnapshot, pathToNavigate)}
          sx={{ cursor: 'pointer', color: '#14b8a6' }}
        >
          {part}
        </Link>
      );
    });

    return (
      <Breadcrumbs sx={{ mb: 2 }}>
        {crumbs}
      </Breadcrumbs>
    );
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: '#14b8a6' }}>
        Browse Backups
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Job Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Select Backup Job</InputLabel>
              <Select
                value={selectedJobId}
                label="Select Backup Job"
                onChange={(e) => {
                  setSelectedJobId(e.target.value);
                  if (!e.target.value) {
                    // Clear everything when "None" is selected
                    setSnapshots([]);
                    setSelectedSnapshot(null);
                    setCurrentPath('');
                    setItems([]);
                  }
                }}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {jobs.map((job) => (
                  <MenuItem key={job.id} value={job.id}>
                    {job.name} ({job.server?.name || 'Unknown Server'})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Snapshots */}
      {selectedJobId && snapshots.length > 0 && !selectedSnapshot && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Available Snapshots for {jobName}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Chip
                label={`Total Disk Usage: ${formatSize(totalActualSize)}`}
                sx={{ backgroundColor: '#14b8a6', color: 'white', fontWeight: 600 }}
              />
              {totalSpaceSaved > 0 && (
                <Chip
                  label={`Space Saved: ${formatSize(totalSpaceSaved)} (${((totalSpaceSaved / totalLogicalSize) * 100).toFixed(1)}%)`}
                  sx={{ backgroundColor: '#10b981', color: 'white', fontWeight: 600 }}
                />
              )}
            </Box>
          </Box>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {snapshots.map((snapshot) => (
              <Grid item xs={12} sm={6} md={4} key={snapshot.name}>
                <Paper
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    '&:hover': {
                      borderColor: '#14b8a6',
                      backgroundColor: 'rgba(20, 184, 166, 0.05)',
                    },
                  }}
                  onClick={() => browseSnapshot(snapshot.name)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CalendarIcon sx={{ mr: 1, color: '#14b8a6' }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {formatDate(snapshot.date)}
                      </Typography>
                    </Box>
                    <Chip
                      label={formatSize(snapshot.size_bytes || 0)}
                      size="small"
                      sx={{ backgroundColor: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6' }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {snapshot.name}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* File Browser */}
      {selectedSnapshot && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Browsing: {jobName} - {formatDate(snapshots.find(s => s.name === selectedSnapshot)?.date)}
              </Typography>
              <Chip
                label={selectedSnapshot}
                size="small"
                color="primary"
                sx={{ backgroundColor: '#14b8a6' }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showChanges}
                    onChange={handleToggleChanges}
                    disabled={!hasPreviousSnapshot}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#14b8a6',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: '#14b8a6',
                      },
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CompareIcon sx={{ fontSize: '1rem' }} />
                    <Typography variant="body2">Show Changes</Typography>
                  </Box>
                }
              />
              <Button
                variant="outlined"
                startIcon={<FolderZipIcon />}
                onClick={downloadSnapshot}
                sx={{ borderColor: '#14b8a6', color: '#14b8a6' }}
              >
                Download All
              </Button>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => {
                  setSelectedSnapshot(null);
                  setCurrentPath('');
                  setItems([]);
                }}
              >
                Back to Snapshots
              </Button>
            </Box>
          </Box>

          {renderBreadcrumbs()}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Modified</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentPath && (
                    <TableRow hover sx={{ cursor: 'pointer' }} onClick={navigateUp}>
                      <TableCell colSpan={5}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <ArrowBackIcon sx={{ mr: 1, color: '#14b8a6' }} />
                          <Typography>.. (Parent Directory)</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                  {items.map((item, index) => (
                    <TableRow
                      key={index}
                      hover
                      sx={{ cursor: item.type === 'directory' ? 'pointer' : 'default' }}
                      onClick={() => item.type === 'directory' && navigateToFolder(item.path)}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {item.type === 'directory' ? (
                              <FolderIcon sx={{ mr: 1, color: '#14b8a6' }} />
                            ) : (
                              <FileIcon sx={{ mr: 1, color: 'text.secondary' }} />
                            )}
                            <span>{item.name}</span>
                          </Box>
                          <Box>
                            {item.change_status === 'new' && (
                              <Chip
                                icon={<NewIcon />}
                                label="New"
                                size="small"
                                sx={{
                                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                  color: '#10b981',
                                  border: '1px solid #10b981',
                                  fontWeight: 600,
                                  fontSize: '0.7rem'
                                }}
                              />
                            )}
                            {item.change_status === 'modified' && (
                              <Chip
                                icon={<EditIcon />}
                                label="Modified"
                                size="small"
                                sx={{
                                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                  color: '#f59e0b',
                                  border: '1px solid #f59e0b',
                                  fontWeight: 600,
                                  fontSize: '0.7rem'
                                }}
                              />
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.type}
                          size="small"
                          color={item.type === 'directory' ? 'primary' : 'default'}
                          sx={item.type === 'directory' ? { backgroundColor: '#14b8a6' } : {}}
                        />
                      </TableCell>
                      <TableCell>{item.type === 'file' ? formatSize(item.size) : '-'}</TableCell>
                      <TableCell>{formatDate(item.modified)}</TableCell>
                      <TableCell align="right">
                        {item.type === 'file' ? (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            <Tooltip title={item.size > 10 * 1024 * 1024 ? `File too large to view (${formatSize(item.size)}, max 10MB)` : "View File"}>
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={item.size > 10 * 1024 * 1024 || viewLoading}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    viewFile(item.path, item.name, item.size);
                                  }}
                                  sx={{ color: '#14b8a6' }}
                                >
                                  {viewLoading ? <CircularProgress size={20} /> : <VisibilityIcon />}
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Download File">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadFile(item.path, item.name);
                                }}
                                sx={{ color: '#14b8a6' }}
                              >
                                <DownloadIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Tooltip title="Download Folder as ZIP">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadFolderZip(item.path, item.name);
                              }}
                              sx={{ color: '#14b8a6' }}
                            >
                              <FolderZipIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography color="text.secondary">
                          This directory is empty
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {selectedJobId && snapshots.length === 0 && !loading && (
        <Alert severity="info">
          No snapshots found for this backup job. Run a backup first.
        </Alert>
      )}

      {/* File Viewer Modal */}
      <Dialog
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">{viewFileName}</Typography>
            <Chip
              label={formatSize(viewFileSize)}
              size="small"
              sx={{ backgroundColor: '#14b8a6', color: 'white' }}
            />
          </Box>
        </DialogTitle>
        <DialogContent>
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
            {viewFileContent || 'No content available'}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={copyToClipboard}
            sx={{ color: '#14b8a6' }}
          >
            Copy to Clipboard
          </Button>
          <Button onClick={() => setViewModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
