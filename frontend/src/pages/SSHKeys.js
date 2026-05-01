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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import api from '../api';

export default function SSHKeys() {
  const [keys, setKeys] = useState([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    private_key: '',
  });

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const response = await api.get('/ssh-keys/');
      setKeys(response.data);
    } catch (error) {
      console.error('Failed to fetch SSH keys:', error);
    }
  };

  const handleOpen = () => {
    setFormData({ name: '', private_key: '' });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async () => {
    try {
      await api.post('/ssh-keys/', formData);
      fetchKeys();
      handleClose();
    } catch (error) {
      console.error('Failed to create SSH key:', error);
      alert('Failed to create SSH key: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this SSH key?')) {
      try {
        await api.delete(`/ssh-keys/${id}`);
        fetchKeys();
      } catch (error) {
        console.error('Failed to delete SSH key:', error);
        alert('Failed to delete SSH key: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">SSH Keys</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpen}
        >
          Add SSH Key
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Fingerprint</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {keys.map((key) => (
              <TableRow key={key.id}>
                <TableCell>{key.name}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {key.fingerprint || 'N/A'}
                </TableCell>
                <TableCell>{new Date(key.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleDelete(key.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add SSH Key</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Key Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Private Key"
            fullWidth
            multiline
            rows={8}
            value={formData.private_key}
            onChange={(e) => setFormData({ ...formData, private_key: e.target.value })}
            placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
            InputProps={{
              style: { fontFamily: 'monospace', fontSize: '0.85rem' }
            }}
          />
          <Typography variant="caption" color="textSecondary">
            Paste your SSH private key (RSA, Ed25519, etc.)
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            Add Key
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
