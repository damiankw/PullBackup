import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  TableSortLabel,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Snackbar,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PlayArrow as PlayArrowIcon,
  FlashOn as FlashOnIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import api from '../api';

export default function BackupJobs() {
  const [jobs, setJobs] = useState([]);
  const [servers, setServers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [orderBy, setOrderBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [formData, setFormData] = useState({
    name: '',
    server_id: '',
    remote_path: '',
    schedule: '',
    rsync_options: '',
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [runningJobs, setRunningJobs] = useState(new Set());
  
  const [scheduleConfig, setScheduleConfig] = useState({
    frequency: 'manual',
    hour: '2',
    minute: '0',
    dayOfWeek: '1',
    dayOfMonth: '1',
    hourInterval: '4',  // For hourly schedules
    timesPerDay: '2',   // For multiple-daily schedules
  });

  useEffect(() => {
    fetchJobs();
    fetchServers();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await api.get('/backup-jobs/');
      setJobs(response.data);
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

  const parseCronToConfig = (cronExpression) => {
    if (!cronExpression || !cronExpression.trim()) {
      return {
        frequency: 'manual',
        hour: '2',
        minute: '0',
        dayOfWeek: '1',
        dayOfMonth: '1',
        hourInterval: '4',
        timesPerDay: '2',
      };
    }
    
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) return { frequency: 'manual', hour: '2', minute: '0', dayOfWeek: '1', dayOfMonth: '1', hourInterval: '4', timesPerDay: '2' };
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    
    // Hourly patterns: 0 */4 * * * (every N hours)
    if (hour.startsWith('*/') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      const interval = hour.substring(2);
      return { frequency: 'hourly', hour: '0', minute, dayOfWeek: '1', dayOfMonth: '1', hourInterval: interval, timesPerDay: '2' };
    }
    
    // Multiple times daily: 0 0,8,16 * * * (specific hours)
    if (hour.includes(',') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      const hours = hour.split(',');
      const timesPerDay = hours.length.toString();
      return { frequency: 'multiple-daily', hour: hours[0], minute, dayOfWeek: '1', dayOfMonth: '1', hourInterval: '4', timesPerDay };
    }
    
    // Daily: 0 2 * * *
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*' && !hour.includes('*') && !hour.includes(',')) {
      return { frequency: 'daily', hour, minute, dayOfWeek: '1', dayOfMonth: '1', hourInterval: '4', timesPerDay: '2' };
    }
    // Weekly: 0 2 * * 1
    if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
      return { frequency: 'weekly', hour, minute, dayOfWeek, dayOfMonth: '1', hourInterval: '4', timesPerDay: '2' };
    }
    // Monthly: 0 2 1 * *
    if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
      return { frequency: 'monthly', hour, minute, dayOfWeek: '1', dayOfMonth, hourInterval: '4', timesPerDay: '2' };
    }
    
    return { frequency: 'manual', hour: '2', minute: '0', dayOfWeek: '1', dayOfMonth: '1', hourInterval: '4', timesPerDay: '2' };
  };
  
  const buildCronExpression = (config) => {
    if (config.frequency === 'manual') return '';
    
    const { frequency, hour, minute, dayOfWeek, dayOfMonth, hourInterval, timesPerDay } = config;
    
    if (frequency === 'hourly') {
      return `${minute} */${hourInterval} * * *`;
    }
    if (frequency === 'multiple-daily') {
      // Calculate evenly spaced hours throughout the day
      const times = parseInt(timesPerDay);
      const interval = 24 / times;
      const hours = Array.from({ length: times }, (_, i) => i * interval).join(',');
      return `${minute} ${hours} * * *`;
    }
    if (frequency === 'daily') {
      return `${minute} ${hour} * * *`;
    }
    if (frequency === 'weekly') {
      return `${minute} ${hour} * * ${dayOfWeek}`;
    }
    if (frequency === 'monthly') {
      return `${minute} ${hour} ${dayOfMonth} * *`;
    }
    
    return '';
  };
  
  const formatSchedule = (cronExpression) => {
    if (!cronExpression || !cronExpression.trim()) {
      return 'Manual only';
    }
    
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) return cronExpression;
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const timeStr = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Hourly patterns
    if (hour.startsWith('*/') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      const interval = hour.substring(2);
      return `Every ${interval} hour${interval !== '1' ? 's' : ''}`;
    }
    
    // Multiple times daily
    if (hour.includes(',') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      const hours = hour.split(',');
      return `${hours.length}x daily at ${hours.map(h => h.padStart(2, '0') + ':' + minute.padStart(2, '0')).join(', ')}`;
    }
    
    // Daily
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return `Daily at ${timeStr}`;
    }
    // Weekly
    if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
      return `Weekly on ${dayNames[parseInt(dayOfWeek)]} at ${timeStr}`;
    }
    // Monthly
    if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
      return `Monthly on day ${dayOfMonth} at ${timeStr}`;
    }
    
    return cronExpression;
  };

  const handleOpen = (job = null) => {
    if (job) {
      setEditingJob(job);
      setFormData(job);
      setScheduleConfig(parseCronToConfig(job.schedule));
    } else {
      setEditingJob(null);
      setFormData({
        name: '',
        server_id: '',
        remote_path: '',
        schedule: '',
        rsync_options: '',
      });
      setScheduleConfig({
        frequency: 'manual',
        hour: '2',
        minute: '0',
        dayOfWeek: '1',
        dayOfMonth: '1',
        hourInterval: '4',
        timesPerDay: '2',
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingJob(null);
  };

  const handleSubmit = async () => {
    try {
      const data = { ...formData };
      data.server_id = parseInt(data.server_id);
      data.schedule = buildCronExpression(scheduleConfig);
      if (!data.rsync_options) delete data.rsync_options;
      
      if (editingJob) {
        await api.put(`/backup-jobs/${editingJob.id}`, data);
      } else {
        await api.post('/backup-jobs/', data);
      }
      fetchJobs();
      handleClose();
    } catch (error) {
      console.error('Failed to save backup job:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save backup job: ' + (error.response?.data?.detail || error.message),
        severity: 'error'
      });
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this backup job?')) {
      try {
        await api.delete(`/backup-jobs/${id}`);
        fetchJobs();
      } catch (error) {
        console.error('Failed to delete backup job:', error);
        setSnackbar({ open: true, message: 'Failed to delete backup job', severity: 'error' });
      }
    }
  };

  const handleRunNow = async (id) => {
    try {
      setRunningJobs(prev => new Set([...prev, id]));
      setSnackbar({ open: true, message: 'Backup started...', severity: 'info' });
      
      await api.post(`/backup-jobs/${id}/run`);
      
      setSnackbar({ open: true, message: 'Backup running in background', severity: 'success' });
      
      // Remove from running jobs after a delay and refresh
      setTimeout(() => {
        setRunningJobs(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        fetchJobs();
      }, 3000);
    } catch (error) {
      console.error('Failed to start backup:', error);
      setRunningJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      setSnackbar({
        open: true,
        message: 'Failed to start backup: ' + (error.response?.data?.detail || error.message),
        severity: 'error'
      });
    }
  };

  const handleRemoveVolatileFile = async (jobId, filePath) => {
    try {
      const job = jobs.find(j => j.id === jobId);
      const updatedFiles = (job.volatile_files || []).filter(f => f !== filePath);
      await api.put(`/backup-jobs/${jobId}`, { volatile_files: updatedFiles });
      fetchJobs();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to remove volatile file', severity: 'error' });
    }
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedJobs = [...jobs].sort((a, b) => {
    let aValue = a[orderBy];
    let bValue = b[orderBy];
    
    // Handle nested server name property
    if (orderBy === 'server_name') {
      aValue = a.server?.name || '';
      bValue = b.server?.name || '';
    }
    
    if (orderBy === 'last_run') {
      aValue = aValue ? new Date(aValue).getTime() : 0;
      bValue = bValue ? new Date(bValue).getTime() : 0;
    }
    
    if (orderBy === 'last_status') {
      aValue = aValue || '';
      bValue = bValue || '';
    }
    
    if (orderBy === 'is_active') {
      aValue = aValue ? 1 : 0;
      bValue = bValue ? 1 : 0;
    }
    
    if (aValue < bValue) return order === 'asc' ? -1 : 1;
    if (aValue > bValue) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h3" sx={{ 
            fontWeight: 700, 
            mb: 1,
            background: '#14b8a6',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Backup Jobs
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage and schedule your backup operations
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
          sx={{ px: 3, py: 1.5 }}
        >
          Create Backup Job
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ 
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      }}>
        <Table>
          <TableHead>
            <TableRow sx={{
              background: 'rgba(20, 184, 166, 0.05)',
            }}>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
                <TableSortLabel
                  active={orderBy === 'name'}
                  direction={orderBy === 'name' ? order : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
                <TableSortLabel
                  active={orderBy === 'server_name'}
                  direction={orderBy === 'server_name' ? order : 'asc'}
                  onClick={() => handleSort('server_name')}
                >
                  Server
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
                <TableSortLabel
                  active={orderBy === 'remote_path'}
                  direction={orderBy === 'remote_path' ? order : 'asc'}
                  onClick={() => handleSort('remote_path')}
                >
                  Remote Path
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
                <TableSortLabel
                  active={orderBy === 'schedule'}
                  direction={orderBy === 'schedule' ? order : 'asc'}
                  onClick={() => handleSort('schedule')}
                >
                  Schedule
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
                <TableSortLabel
                  active={orderBy === 'last_run'}
                  direction={orderBy === 'last_run' ? order : 'asc'}
                  onClick={() => handleSort('last_run')}
                >
                  Last Run
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
                <TableSortLabel
                  active={orderBy === 'last_status'}
                  direction={orderBy === 'last_status' ? order : 'asc'}
                  onClick={() => handleSort('last_status')}
                >
                  Last Result
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
                <TableSortLabel
                  active={orderBy === 'is_active'}
                  direction={orderBy === 'is_active' ? order : 'asc'}
                  onClick={() => handleSort('is_active')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Volatile Files</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedJobs.map((job) => (
              <TableRow 
                key={job.id}
                sx={{
                  '&:hover': {
                    background: 'rgba(99, 102, 241, 0.05)',
                  },
                  transition: 'background 0.2s',
                }}
              >
                <TableCell sx={{ fontWeight: 600 }}>{job.name}</TableCell>
                <TableCell>{job.server?.name || 'Unknown'}</TableCell>
                <TableCell sx={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.85rem',
                  color: 'text.secondary',
                }}>
                  {job.remote_path}
                </TableCell>
                <TableCell>{formatSchedule(job.schedule)}</TableCell>
                <TableCell sx={{ fontSize: '0.875rem' }}>
                  {job.last_run ? new Date(job.last_run).toLocaleString() : 'Never'}
                </TableCell>
                <TableCell>
                  {job.last_status ? (
                    <Chip
                      label={job.last_status.charAt(0).toUpperCase() + job.last_status.slice(1)}
                      size="small"
                      sx={{
                        background: job.last_status === 'success' 
                          ? 'rgba(16, 185, 129, 0.2)'
                          : job.last_status === 'failed'
                          ? 'rgba(239, 68, 68, 0.2)'
                          : job.last_status === 'running'
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'rgba(148, 163, 184, 0.1)',
                        border: job.last_status === 'success'
                          ? '1px solid rgba(16, 185, 129, 0.3)'
                          : job.last_status === 'failed'
                          ? '1px solid rgba(239, 68, 68, 0.3)'
                          : job.last_status === 'running'
                          ? '1px solid rgba(59, 130, 246, 0.3)'
                          : '1px solid rgba(148, 163, 184, 0.2)',
                        color: job.last_status === 'success'
                          ? '#10b981'
                          : job.last_status === 'failed'
                          ? '#ef4444'
                          : job.last_status === 'running'
                          ? '#3b82f6'
                          : 'text.secondary',
                        fontWeight: 600,
                      }}
                    />
                  ) : (
                    <Chip
                      label="None"
                      size="small"
                      sx={{
                        background: 'rgba(148, 163, 184, 0.1)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        color: 'text.secondary',
                      }}
                    />
                  )}
                </TableCell>
                <TableCell>
                  {job.is_active ? (
                    <Chip 
                      label="Active" 
                      size="small"
                      sx={{
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#10b981',
                        fontWeight: 600,
                      }}
                    />
                  ) : (
                    <Chip 
                      label="Inactive" 
                      size="small"
                      sx={{
                        background: 'rgba(148, 163, 184, 0.1)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        color: 'text.secondary',
                      }}
                    />
                  )}
                </TableCell>
                <TableCell>
                  {job.volatile_files && job.volatile_files.length > 0 ? (
                    <Tooltip title={job.volatile_files.join('\n')} placement="left">
                      <Chip
                        icon={<FlashOnIcon sx={{ fontSize: '0.85rem !important' }} />}
                        label={`${job.volatile_files.length} file${job.volatile_files.length !== 1 ? 's' : ''}`}
                        size="small"
                        sx={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          color: '#f59e0b',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        onClick={() => handleOpen(job)}
                      />
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="text.disabled">—</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleRunNow(job.id)}
                    title="Run now"
                    disabled={runningJobs.has(job.id)}
                    sx={{
                      color: '#10b981',
                      '&:hover': {
                        background: 'rgba(16, 185, 129, 0.1)',
                      },
                    }}
                  >
                    {runningJobs.has(job.id) ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => handleOpen(job)}
                    sx={{
                      color: '#14b8a6',
                      '&:hover': {
                        background: 'rgba(99, 102, 241, 0.1)',
                      },
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => handleDelete(job.id)}
                    sx={{
                      color: '#ef4444',
                      '&:hover': {
                        background: 'rgba(239, 68, 68, 0.1)',
                      },
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            background: 'rgba(30, 41, 59, 0.95)',
            backdropFilter: 'blur(20px)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem' }}>
          {editingJob ? 'Edit Backup Job' : 'Create Backup Job'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Job Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mt: 2 }}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel id="server-label">Server</InputLabel>
            <Select
              labelId="server-label"
              label="Server"
              value={formData.server_id}
              onChange={(e) => setFormData({ ...formData, server_id: e.target.value })}
            >
              <MenuItem value="">Select a server</MenuItem>
              {servers.map((server) => (
                <MenuItem key={server.id} value={server.id}>
                  {server.name} ({server.hostname})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Remote Path"
            fullWidth
            value={formData.remote_path}
            onChange={(e) => setFormData({ ...formData, remote_path: e.target.value })}
            placeholder="/path/on/remote/server"
          />
          <TextField
            margin="dense"
            label="Rsync Options (optional)"
            fullWidth
            value={formData.rsync_options}
            onChange={(e) => setFormData({ ...formData, rsync_options: e.target.value })}
            placeholder="-avz --delete"
          />
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Schedule
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Frequency</InputLabel>
                  <Select
                    value={scheduleConfig.frequency}
                    label="Frequency"
                    onChange={(e) => setScheduleConfig({ ...scheduleConfig, frequency: e.target.value })}
                  >
                    <MenuItem value="manual">Manual Only</MenuItem>
                    <MenuItem value="hourly">Every N Hours</MenuItem>
                    <MenuItem value="multiple-daily">Multiple Times Daily</MenuItem>
                    <MenuItem value="daily">Daily</MenuItem>
                    <MenuItem value="weekly">Weekly</MenuItem>
                    <MenuItem value="monthly">Monthly</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {scheduleConfig.frequency === 'hourly' && (
                <>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Interval</InputLabel>
                      <Select
                        value={scheduleConfig.hourInterval}
                        label="Interval"
                        onChange={(e) => setScheduleConfig({ ...scheduleConfig, hourInterval: e.target.value })}
                      >
                        <MenuItem value="1">Every hour</MenuItem>
                        <MenuItem value="2">Every 2 hours</MenuItem>
                        <MenuItem value="3">Every 3 hours</MenuItem>
                        <MenuItem value="4">Every 4 hours</MenuItem>
                        <MenuItem value="6">Every 6 hours</MenuItem>
                        <MenuItem value="8">Every 8 hours</MenuItem>
                        <MenuItem value="12">Every 12 hours</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Starting Minute</InputLabel>
                      <Select
                        value={scheduleConfig.minute}
                        label="Starting Minute"
                        onChange={(e) => setScheduleConfig({ ...scheduleConfig, minute: e.target.value })}
                      >
                        <MenuItem value="0">:00</MenuItem>
                        <MenuItem value="15">:15</MenuItem>
                        <MenuItem value="30">:30</MenuItem>
                        <MenuItem value="45">:45</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}
              
              {scheduleConfig.frequency === 'multiple-daily' && (
                <>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Times Per Day</InputLabel>
                      <Select
                        value={scheduleConfig.timesPerDay}
                        label="Times Per Day"
                        onChange={(e) => setScheduleConfig({ ...scheduleConfig, timesPerDay: e.target.value })}
                      >
                        <MenuItem value="2">2 times (every 12 hours)</MenuItem>
                        <MenuItem value="3">3 times (every 8 hours)</MenuItem>
                        <MenuItem value="4">4 times (every 6 hours)</MenuItem>
                        <MenuItem value="6">6 times (every 4 hours)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Starting Minute</InputLabel>
                      <Select
                        value={scheduleConfig.minute}
                        label="Starting Minute"
                        onChange={(e) => setScheduleConfig({ ...scheduleConfig, minute: e.target.value })}
                      >
                        <MenuItem value="0">:00</MenuItem>
                        <MenuItem value="15">:15</MenuItem>
                        <MenuItem value="30">:30</MenuItem>
                        <MenuItem value="45">:45</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}
              
              {scheduleConfig.frequency !== 'manual' && scheduleConfig.frequency !== 'hourly' && scheduleConfig.frequency !== 'multiple-daily' && (
                <>
                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Hour</InputLabel>
                      <Select
                        value={scheduleConfig.hour}
                        label="Hour"
                        onChange={(e) => setScheduleConfig({ ...scheduleConfig, hour: e.target.value })}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <MenuItem key={i} value={i.toString()}>
                            {i.toString().padStart(2, '0')}:00
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Minute</InputLabel>
                      <Select
                        value={scheduleConfig.minute}
                        label="Minute"
                        onChange={(e) => setScheduleConfig({ ...scheduleConfig, minute: e.target.value })}
                      >
                        {[0, 15, 30, 45].map((min) => (
                          <MenuItem key={min} value={min.toString()}>
                            :{min.toString().padStart(2, '0')}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}
              
              {scheduleConfig.frequency === 'weekly' && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Day of Week</InputLabel>
                    <Select
                      value={scheduleConfig.dayOfWeek}
                      label="Day of Week"
                      onChange={(e) => setScheduleConfig({ ...scheduleConfig, dayOfWeek: e.target.value })}
                    >
                      <MenuItem value="0">Sunday</MenuItem>
                      <MenuItem value="1">Monday</MenuItem>
                      <MenuItem value="2">Tuesday</MenuItem>
                      <MenuItem value="3">Wednesday</MenuItem>
                      <MenuItem value="4">Thursday</MenuItem>
                      <MenuItem value="5">Friday</MenuItem>
                      <MenuItem value="6">Saturday</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
              
              {scheduleConfig.frequency === 'monthly' && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Day of Month</InputLabel>
                    <Select
                      value={scheduleConfig.dayOfMonth}
                      label="Day of Month"
                      onChange={(e) => setScheduleConfig({ ...scheduleConfig, dayOfMonth: e.target.value })}
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <MenuItem key={day} value={day.toString()}>
                          {day}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </Grid>
          </Box>
          {/* Volatile Files section — only shown when editing an existing job */}
          {editingJob && (
            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <FlashOnIcon sx={{ fontSize: '1rem', color: '#f59e0b' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#f59e0b' }}>
                  Volatile Files (Auto-detected)
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                These files are transferred using <code>--inplace --whole-file</code> to avoid checksum failures caused by live writes. Detected automatically — remove entries that are no longer needed.
              </Typography>
              {(!editingJob.volatile_files || editingJob.volatile_files.length === 0) ? (
                <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                  No volatile files detected yet. They will appear here after a backup run encounters checksum failures.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {editingJob.volatile_files.map((file) => (
                    <Chip
                      key={file}
                      label={file}
                      size="small"
                      onDelete={() => handleRemoveVolatileFile(editingJob.id, file)}
                      deleteIcon={<CloseIcon />}
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        color: '#f59e0b',
                        '& .MuiChip-deleteIcon': { color: '#f59e0b', opacity: 0.7 },
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleClose} sx={{ px: 3 }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" sx={{ px: 3 }}>
            {editingJob ? 'Update' : 'Create'}
          </Button>
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
