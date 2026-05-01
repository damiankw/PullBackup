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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import api from '../api';

export default function BackupJobs() {
  const [jobs, setJobs] = useState([]);
  const [servers, setServers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    server_id: '',
    remote_path: '',
    local_path: '',
    schedule: '',
    rsync_options: '',
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

  const handleOpen = (job = null) => {
    if (job) {
      setEditingJob(job);
      setFormData(job);
    } else {
      setEditingJob(null);
      setFormData({
        name: '',
        server_id: '',
        remote_path: '',
        local_path: '',
        schedule: '',
        rsync_options: '',
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
      alert('Failed to save backup job: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this backup job?')) {
      try {
        await api.delete(`/backup-jobs/${id}`);
        fetchJobs();
      } catch (error) {
        console.error('Failed to delete backup job:', error);
        alert('Failed to delete backup job');
      }
    }
  };

  const handleRunNow = async (id) => {
    try {
      await api.post(`/backup-jobs/${id}/run`);
      alert('Backup started successfully');
    } catch (error) {
      console.error('Failed to start backup:', error);
      alert('Failed to start backup: ' + (error.response?.data?.detail || error.message));
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Backup Jobs</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Create Backup Job
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Remote Path</TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell>Last Run</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>{job.name}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {job.remote_path}
                </TableCell>
                <TableCell>{job.schedule || 'Manual only'}</TableCell>
                <TableCell>
                  {job.last_run ? new Date(job.last_run).toLocaleString() : 'Never'}
                </TableCell>
                <TableCell>
                  {job.is_active ? (
                    <Chip label="Active" color="success" size="small" />
                  ) : (
                    <Chip label="Inactive" size="small" />
                  )}
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleRunNow(job.id)} title="Run now">
                    <PlayArrowIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleOpen(job)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(job.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingJob ? 'Edit Backup Job' : 'Create Backup Job'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Job Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Server"
            select
            fullWidth
            value={formData.server_id}
            onChange={(e) => setFormData({ ...formData, server_id: e.target.value })}
            SelectProps={{ native: true }}
          >
            <option value="">Select a server</option>
            {servers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name} ({server.hostname})
              </option>
            ))}
          </TextField>
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
            label="Local Path"
            fullWidth
            value={formData.local_path}
            onChange={(e) => setFormData({ ...formData, local_path: e.target.value })}
            placeholder="server-name/backup-folder"
          />
          <TextField
            margin="dense"
            label="Schedule (cron format)"
            fullWidth
            value={formData.schedule}
            onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
            placeholder="0 2 * * * (daily at 2am)"
            helperText="Leave empty for manual-only backups. Format: minute hour day month weekday"
          />
          <TextField
            margin="dense"
            label="Rsync Options (optional)"
            fullWidth
            value={formData.rsync_options}
            onChange={(e) => setFormData({ ...formData, rsync_options: e.target.value })}
            placeholder="-avz --delete"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingJob ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
