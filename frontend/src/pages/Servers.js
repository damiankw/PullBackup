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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  VpnKey as VpnKeyIcon,
} from '@mui/icons-material';
import Tooltip from '@mui/material/Tooltip';
import api from '../api';

export default function Servers() {
  const [servers, setServers] = useState([]);
  const [sshKeys, setSSHKeys] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [orderBy, setOrderBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [testingServerId, setTestingServerId] = useState(null);
  const [scanningServerId, setScanningServerId] = useState(null);
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
      setSnackbar({ open: true, message: `Server ${editingServer ? 'updated' : 'created'} successfully`, severity: 'success' });
    } catch (error) {
      console.error('Failed to save server:', error);
      setSnackbar({ open: true, message: 'Failed to save server: ' + (error.response?.data?.detail || error.message), severity: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this server?')) {
      try {
        await api.delete(`/servers/${id}`);
        fetchServers();
        setSnackbar({ open: true, message: 'Server deleted successfully', severity: 'success' });
      } catch (error) {
        console.error('Failed to delete server:', error);
        setSnackbar({ open: true, message: 'Failed to delete server', severity: 'error' });
      }
    }
  };

  const handleTestConnection = async (server) => {
    setTestingServerId(server.id);
    try {
      await api.post(`/servers/${server.id}/test-connection`);
      fetchServers();
      setSnackbar({ open: true, message: 'Connection test successful', severity: 'success' });
    } catch (error) {
      console.error('Connection test failed:', error);
      fetchServers();
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Connection test failed', severity: 'error' });
    } finally {
      setTestingServerId(null);
    }
  };

  const handleScanHostKey = async (server) => {
    setScanningServerId(server.id);
    try {
      const res = await api.post(`/servers/${server.id}/scan-host-key`);
      fetchServers();
      setSnackbar({ open: true, message: res.data.message, severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Host key scan failed', severity: 'error' });
    } finally {
      setScanningServerId(null);
    }
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedServers = [...servers].sort((a, b) => {
    let aValue = a[orderBy];
    let bValue = b[orderBy];
    
    if (orderBy === 'connection_test_success') {
      aValue = aValue === true ? 2 : aValue === false ? 1 : 0;
      bValue = bValue === true ? 2 : bValue === false ? 1 : 0;
    }
    
    if (aValue < bValue) return order === 'asc' ? -1 : 1;
    if (aValue > bValue) return order === 'asc' ? 1 : -1;
    return 0;
  });

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
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'name'}
                  direction={orderBy === 'name' ? order : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'hostname'}
                  direction={orderBy === 'hostname' ? order : 'asc'}
                  onClick={() => handleSort('hostname')}
                >
                  Hostname
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'port'}
                  direction={orderBy === 'port' ? order : 'asc'}
                  onClick={() => handleSort('port')}
                >
                  Port
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'username'}
                  direction={orderBy === 'username' ? order : 'asc'}
                  onClick={() => handleSort('username')}
                >
                  Username
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'connection_test_success'}
                  direction={orderBy === 'connection_test_success' ? order : 'asc'}
                  onClick={() => handleSort('connection_test_success')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell>Host Key</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedServers.map((server) => (
              <TableRow key={server.id}>
                <TableCell>{server.name}</TableCell>
                <TableCell>{server.hostname}</TableCell>
                <TableCell>{server.port}</TableCell>
                <TableCell>{server.username}</TableCell>
                <TableCell>
                  {testingServerId === server.id ? (
                    <Chip label="Testing..." color="info" size="small" />
                  ) : (
                    <>
                      {server.connection_test_success === true && (
                        <Chip label="Connected" color="success" size="small" />
                      )}
                      {server.connection_test_success === false && (
                        <Chip label="Failed" color="error" size="small" />
                      )}
                      {server.connection_test_success === null && (
                        <Chip label="Not Tested" size="small" />
                      )}
                    </>
                  )}
                </TableCell>
                <TableCell>
                  {server.host_key ? (
                    <Chip label="Verified" color="success" size="small" />
                  ) : (
                    <Chip label="Not Scanned" size="small" />
                  )}
                </TableCell>
                <TableCell>
                  <Tooltip title="Test Connection">
                    <IconButton
                      size="small"
                      onClick={() => handleTestConnection(server)}
                      disabled={testingServerId === server.id}
                    >
                      <CheckCircleIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={server.host_key ? 'Re-scan Host Key' : 'Scan Host Key'}>
                    <IconButton
                      size="small"
                      onClick={() => handleScanHostKey(server)}
                      disabled={scanningServerId === server.id}
                      color={server.host_key ? 'success' : 'default'}
                    >
                      <VpnKeyIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => handleOpen(server)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => handleDelete(server.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
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
          <FormControl fullWidth margin="dense">
            <InputLabel id="ssh-key-label">SSH Key</InputLabel>
            <Select
              labelId="ssh-key-label"
              label="SSH Key"
              value={formData.ssh_key_id || ''}
              onChange={(e) => setFormData({ ...formData, ssh_key_id: e.target.value })}
            >
              <MenuItem value="">None</MenuItem>
              {sshKeys.map((key) => (
                <MenuItem key={key.id} value={key.id}>
                  {key.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
