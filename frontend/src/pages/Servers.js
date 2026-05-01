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
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import api from '../api';

export default function Servers() {
  const [servers, setServers] = useState([]);
  const [sshKeys, setSSHKeys] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    hostname: '',
    port: 22,
    username: '',
    description: '',
    ssh_key_id: '',
  });

  useEffect(() => {
    fetchServers();
    fetchSSHKeys();
  }, []);

  const fetchServers = async () => {
    try {
      const response = await api.get('/servers/');
      setServers(response.data);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    }
  };

  const fetchSSHKeys = async () => {
    try {
      const response = await api.get('/ssh-keys/');
      setSSHKeys(response.data);
    } catch (error) {
      console.error('Failed to fetch SSH keys:', error);
    }
  };

  const handleOpen = (server = null) => {
    if (server) {
      setEditingServer(server);
      setFormData(server);
    } else {
      setEditingServer(null);
      setFormData({
        name: '',
        hostname: '',
        port: 22,
        username: '',
        description: '',
        ssh_key_id: '',
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingServer(null);
  };

  const handleSubmit = async () => {
    try {
      const data = { ...formData };
      if (!data.ssh_key_id) delete data.ssh_key_id;
      
      if (editingServer) {
        await api.put(`/servers/${editingServer.id}`, data);
      } else {
        await api.post('/servers/', data);
      }
      fetchServers();
      handleClose();
    } catch (error) {
      console.error('Failed to save server:', error);
      alert('Failed to save server: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this server?')) {
      try {
        await api.delete(`/servers/${id}`);
        fetchServers();
      } catch (error) {
        console.error('Failed to delete server:', error);
        alert('Failed to delete server');
      }
    }
  };

  const handleTestConnection = async (server) => {
    try {
      const response = await api.post(`/servers/${server.id}/test-connection`);
      alert(response.data.message);
      fetchServers();
    } catch (error) {
      console.error('Connection test failed:', error);
      alert('Connection test failed: ' + (error.response?.data?.detail || error.message));
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Servers</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Add Server
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Hostname</TableCell>
              <TableCell>Port</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {servers.map((server) => (
              <TableRow key={server.id}>
                <TableCell>{server.name}</TableCell>
                <TableCell>{server.hostname}</TableCell>
                <TableCell>{server.port}</TableCell>
                <TableCell>{server.username}</TableCell>
                <TableCell>
                  {server.connection_test_success === true && (
                    <Chip label="Connected" color="success" size="small" />
                  )}
                  {server.connection_test_success === false && (
                    <Chip label="Failed" color="error" size="small" />
                  )}
                  {server.connection_test_success === null && (
                    <Chip label="Not Tested" size="small" />
                  )}
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleTestConnection(server)}>
                    <CheckCircleIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleOpen(server)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(server.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingServer ? 'Edit Server' : 'Add Server'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Hostname"
            fullWidth
            value={formData.hostname}
            onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Port"
            type="number"
            fullWidth
            value={formData.port}
            onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
          />
          <TextField
            margin="dense"
            label="Username"
            fullWidth
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          />
          <TextField
            margin="dense"
            label="SSH Key"
            select
            fullWidth
            value={formData.ssh_key_id || ''}
            onChange={(e) => setFormData({ ...formData, ssh_key_id: e.target.value })}
            SelectProps={{ native: true }}
          >
            <option value="">None</option>
            {sshKeys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.name}
              </option>
            ))}
          </TextField>
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingServer ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
