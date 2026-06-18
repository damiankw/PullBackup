import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
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
  Visibility as VisibilityIcon,
  ContentCopy as ContentCopyIcon,
  FiberNew as NewIcon,
  Edit as EditIcon,
  CompareArrows as CompareIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import api from '../api';

const ColumnItem = ({ selected, onClick, children }) => (
  <Box
    onClick={onClick}
    sx={{
      px: 2, py: 1.5,
      cursor: 'pointer',
      borderLeft: selected ? '3px solid #14b8a6' : '3px solid transparent',
      backgroundColor: selected ? 'rgba(20,184,166,0.1)' : 'transparent',
      '&:hover': { backgroundColor: selected ? 'rgba(20,184,166,0.12)' : 'rgba(148,163,184,0.05)' },
      transition: 'background-color 0.15s',
    }}
  >
    {children}
  </Box>
);

const ColumnHeader = ({ children, right }) => (
  <Box sx={{
    px: 2, py: 1.5,
    borderBottom: '1px solid rgba(148,163,184,0.15)',
    backgroundColor: 'rgba(148,163,184,0.04)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  }}>
    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>
      {children}
    </Typography>
    {right}
  </Box>
);

export default function BrowseBackups() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasRestoredRef = useRef(false);

  const [jobs, setJobs] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState('');
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

  // Derive unique servers from loaded jobs
  const servers = useMemo(() => {
    const seen = new Set();
    const result = [];
    jobs.forEach(job => {
      const sid = job.server_id || job.server?.id;
      if (sid && !seen.has(sid)) {
        seen.add(sid);
        result.push({ id: sid, name: job.server?.name || `Server #${sid}`, hostname: job.server?.hostname || '' });
      }
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [jobs]);

  // Jobs filtered to the selected server
  const serverJobs = useMemo(() => {
    if (!selectedServerId) return [];
    return jobs.filter(j => String(j.server_id || j.server?.id) === String(selectedServerId));
  }, [jobs, selectedServerId]);

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

      // Pre-select the server that owns this job
      const job = jobs.find(j => String(j.id) === String(jobId));
      const sid = job?.server_id || job?.server?.id;
      if (sid) setSelectedServerId(String(sid));

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

            const browseResponse = await api.get(
              `/browse/backup-jobs/${jobId}/snapshots/${snapshot}/browse`,
              { params: { path: path || '' } }
            );
            setItems(browseResponse.data.items);
            setCurrentPath(path || '');
            setHasPreviousSnapshot(browseResponse.data.has_previous_snapshot || false);
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

  // Keep URL in sync with navigation state
  useEffect(() => {
    if (!hasRestoredRef.current) return;
    const params = {};
    if (selectedJobId) params.job = selectedJobId;
    if (selectedSnapshot) params.snapshot = selectedSnapshot;
    if (currentPath) params.path = currentPath;
    setSearchParams(params);
  }, [selectedJobId, selectedSnapshot, currentPath, setSearchParams]);

  // Load snapshots when job changes
  useEffect(() => {
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
      if (!selectedSnapshot) setSelectedSnapshot(snapshotName);
    } catch (err) {
      setError('Failed to browse snapshot');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folderPath) => browseSnapshot(selectedSnapshot, folderPath);

  const handleToggleChanges = () => setShowChanges(!showChanges);

  useEffect(() => {
    if (selectedSnapshot && hasRestoredRef.current) {
      browseSnapshot(selectedSnapshot, currentPath);
    }
  }, [showChanges]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateUp = () => {
    const parts = currentPath.split('/').filter(p => p);
    parts.pop();
    browseSnapshot(selectedSnapshot, parts.join('/'));
  };

  const handleSelectServer = (serverId) => {
    if (String(serverId) === String(selectedServerId)) return;
    setSelectedServerId(String(serverId));
    setSelectedJobId('');
    setCurrentPath('');
    setItems([]);
  };

  const downloadFile = async (filePath, fileName) => {
    try {
      const response = await api.get(
        `/browse/backup-jobs/${selectedJobId}/snapshots/${selectedSnapshot}/download`,
        { params: { path: filePath }, responseType: 'blob' }
      );
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

  const viewFile = async (filePath, fileName, fileSize) => {
    const MAX_VIEW_SIZE = 10 * 1024 * 1024;
    if (fileSize > MAX_VIEW_SIZE) {
      setSnackbar({ open: true, message: `File too large to view (${formatSize(fileSize)}). Maximum size is 10MB.`, severity: 'error' });
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
      setSnackbar({ open: true, message: err.response?.data?.detail || 'Failed to view file', severity: 'error' });
    } finally {
      setViewLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(viewFileContent);
    setSnackbar({ open: true, message: 'Content copied to clipboard!', severity: 'success' });
  };

  const downloadFolderZip = async (folderPath, folderName) => {
    try {
      const response = await api.get(
        `/browse/backup-jobs/${selectedJobId}/snapshots/${selectedSnapshot}/download-zip`,
        { params: { path: folderPath }, responseType: 'blob' }
      );
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

  const downloadSnapshot = () => downloadFolderZip('', jobName);

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleString();

  const renderBreadcrumbs = () => {
    if (!selectedSnapshot) return null;
    const pathParts = currentPath.split('/').filter(p => p);
    const crumbs = [
      <Link key="root" component="button" variant="body1"
        onClick={() => browseSnapshot(selectedSnapshot, '')}
        sx={{ cursor: 'pointer', color: '#14b8a6' }}
      >
        Root
      </Link>
    ];
    let acc = '';
    pathParts.forEach((part, index) => {
      acc += (acc ? '/' : '') + part;
      const dest = acc;
      crumbs.push(
        <Link key={index} component="button" variant="body1"
          onClick={() => browseSnapshot(selectedSnapshot, dest)}
          sx={{ cursor: 'pointer', color: '#14b8a6' }}
        >
          {part}
        </Link>
      );
    });
    return <Breadcrumbs sx={{ mb: 2 }}>{crumbs}</Breadcrumbs>;
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

      {/* Three-column browser — hidden once a snapshot is open */}
      {!selectedSnapshot && (
        <Paper sx={{ overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', height: 520 }}>

            {/* Column 1: Servers */}
            <Box sx={{ width: 210, borderRight: '1px solid rgba(148,163,184,0.15)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <ColumnHeader>Servers</ColumnHeader>
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {servers.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                    No servers configured
                  </Typography>
                ) : servers.map(server => (
                  <ColumnItem
                    key={server.id}
                    selected={String(selectedServerId) === String(server.id)}
                    onClick={() => handleSelectServer(server.id)}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                      {server.name}
                    </Typography>
                    {server.hostname && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                        {server.hostname}
                      </Typography>
                    )}
                  </ColumnItem>
                ))}
              </Box>
            </Box>

            {/* Column 2: Backup Jobs */}
            <Box sx={{ width: 240, borderRight: '1px solid rgba(148,163,184,0.15)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <ColumnHeader>Backup Jobs</ColumnHeader>
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {!selectedServerId ? (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Select a server</Typography>
                ) : serverJobs.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No jobs for this server</Typography>
                ) : serverJobs.map(job => (
                  <ColumnItem
                    key={job.id}
                    selected={String(selectedJobId) === String(job.id)}
                    onClick={() => setSelectedJobId(String(job.id))}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {job.name}
                    </Typography>
                    {job.remote_path && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job.remote_path}
                      </Typography>
                    )}
                  </ColumnItem>
                ))}
              </Box>
            </Box>

            {/* Column 3: Snapshots */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <ColumnHeader
                right={selectedJobId && totalSpaceSaved > 0 ? (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip label={`${formatSize(totalActualSize)} on disk`} size="small"
                      sx={{ height: 20, fontSize: '0.7rem', backgroundColor: 'rgba(20,184,166,0.1)', color: '#14b8a6' }} />
                    <Chip label={`${formatSize(totalSpaceSaved)} saved`} size="small"
                      sx={{ height: 20, fontSize: '0.7rem', backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981' }} />
                  </Box>
                ) : null}
              >
                Snapshots{snapshots.length > 0 ? ` (${snapshots.length})` : ''}
              </ColumnHeader>
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {!selectedJobId ? (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Select a backup job</Typography>
                ) : loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress size={28} />
                  </Box>
                ) : snapshots.length === 0 ? (
                  <Alert severity="info" sx={{ m: 2 }}>No snapshots found. Run a backup first.</Alert>
                ) : snapshots.map((snapshot, idx) => (
                  <Box
                    key={snapshot.name}
                    onClick={() => browseSnapshot(snapshot.name)}
                    sx={{
                      px: 2, py: 1.5,
                      cursor: 'pointer',
                      borderBottom: idx < snapshots.length - 1 ? '1px solid rgba(148,163,184,0.08)' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      '&:hover': { backgroundColor: 'rgba(20,184,166,0.05)' },
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatDate(snapshot.date)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {snapshot.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, ml: 1 }}>
                      <Chip label={formatSize(snapshot.size_bytes || 0)} size="small"
                        sx={{ backgroundColor: 'rgba(20,184,166,0.1)', color: '#14b8a6' }} />
                      <ChevronRightIcon sx={{ fontSize: '1.1rem', color: 'text.disabled' }} />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

          </Box>
        </Paper>
      )}

      {/* File Browser */}
      {selectedSnapshot && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {jobName} — {formatDate(snapshots.find(s => s.name === selectedSnapshot)?.date || selectedSnapshot)}
              </Typography>
              <Chip label={selectedSnapshot} size="small" color="primary" sx={{ backgroundColor: '#14b8a6' }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showChanges}
                    onChange={handleToggleChanges}
                    disabled={!hasPreviousSnapshot}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#14b8a6' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#14b8a6' },
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
              <Button variant="outlined" startIcon={<FolderZipIcon />} onClick={downloadSnapshot}
                sx={{ borderColor: '#14b8a6', color: '#14b8a6' }}>
                Download All
              </Button>
              <Button variant="outlined" startIcon={<ArrowBackIcon />}
                onClick={() => { setSelectedSnapshot(null); setCurrentPath(''); setItems([]); }}>
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
                              <Chip icon={<NewIcon />} label="New" size="small"
                                sx={{ backgroundColor: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid #10b981', fontWeight: 600, fontSize: '0.7rem' }} />
                            )}
                            {item.change_status === 'modified' && (
                              <Chip icon={<EditIcon />} label="Modified" size="small"
                                sx={{ backgroundColor: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid #f59e0b', fontWeight: 600, fontSize: '0.7rem' }} />
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={item.type} size="small"
                          color={item.type === 'directory' ? 'primary' : 'default'}
                          sx={item.type === 'directory' ? { backgroundColor: '#14b8a6' } : {}}
                        />
                      </TableCell>
                      <TableCell>{item.type === 'file' ? formatSize(item.size) : '-'}</TableCell>
                      <TableCell>{formatDate(item.modified)}</TableCell>
                      <TableCell align="right">
                        {item.type === 'file' ? (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            <Tooltip title={item.size > 10 * 1024 * 1024 ? `File too large to view (${formatSize(item.size)}, max 10MB)` : 'View File'}>
                              <span>
                                <IconButton size="small"
                                  disabled={item.size > 10 * 1024 * 1024 || viewLoading}
                                  onClick={(e) => { e.stopPropagation(); viewFile(item.path, item.name, item.size); }}
                                  sx={{ color: '#14b8a6' }}
                                >
                                  {viewLoading ? <CircularProgress size={20} /> : <VisibilityIcon />}
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Download File">
                              <IconButton size="small"
                                onClick={(e) => { e.stopPropagation(); downloadFile(item.path, item.name); }}
                                sx={{ color: '#14b8a6' }}
                              >
                                <DownloadIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Tooltip title="Download Folder as ZIP">
                            <IconButton size="small"
                              onClick={(e) => { e.stopPropagation(); downloadFolderZip(item.path, item.name); }}
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
                        <Typography color="text.secondary">This directory is empty</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* File Viewer Modal */}
      <Dialog open={viewModalOpen} onClose={() => setViewModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">{viewFileName}</Typography>
            <Chip label={formatSize(viewFileSize)} size="small" sx={{ backgroundColor: '#14b8a6', color: 'white' }} />
          </Box>
        </DialogTitle>
        <DialogContent>
          <Paper sx={{ p: 2, backgroundColor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace', fontSize: '0.85rem', maxHeight: '400px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {viewFileContent || 'No content available'}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<ContentCopyIcon />} onClick={copyToClipboard} sx={{ color: '#14b8a6' }}>
            Copy to Clipboard
          </Button>
          <Button onClick={() => setViewModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
