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
  TableSortLabel,
  Chip,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  SwapHoriz as SwapIcon,
  ContentCopy as ContentCopyIcon,
  Visibility as VisibilityIcon,
  AutoAwesome as GenerateIcon,
} from '@mui/icons-material';
import api from '../api';
import { useAuth } from '../AuthContext';

export default function SSHKeys() {
  const [keys, setKeys] = useState([]);
  const [open, setOpen] = useState(false);
  const [publicKeyDialog, setPublicKeyDialog] = useState({ open: false, key: null });
  const [orderBy, setOrderBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [formData, setFormData] = useState({
    name: '',
    private_key: '',
    public_key: '',
    is_public: false,
  });
  const { user } = useAuth();

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
    setFormData({ name: '', private_key: '', public_key: '', is_public: false });
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

  const handleToggleVisibility = async (key) => {
    const newIsPublic = !key.is_public;
    const visibilityType = newIsPublic ? 'public' : 'private';
    
    if (window.confirm(`Change "${key.name}" to ${visibilityType}?\n\n${newIsPublic ? 'This key will be visible and usable by all users.' : 'This key will only be visible to you.'}`)) {
      try {
        await api.patch(`/ssh-keys/${key.id}`, { is_public: newIsPublic });
        fetchKeys();
      } catch (error) {
        console.error('Failed to update SSH key:', error);
        alert('Failed to update SSH key: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  const handleViewPublicKey = (key) => {
    setPublicKeyDialog({ open: true, key });
  };

  const handleCopyPublicKey = (publicKey) => {
    navigator.clipboard.writeText(publicKey);
    alert('Public key copied to clipboard!');
  };

  const handleGeneratePublicKey = async (key) => {
    if (window.confirm(`Generate public key for "${key.name}"?\n\nThis will extract the public key from the private key file.`)) {
      try {
        const response = await api.post(`/ssh-keys/${key.id}/generate-public-key`);
        fetchKeys();
        alert('Public key generated successfully!');
      } catch (error) {
        console.error('Failed to generate public key:', error);
        alert('Failed to generate public key: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedKeys = [...keys].sort((a, b) => {
    let aValue = a[orderBy];
    let bValue = b[orderBy];
    
    if (orderBy === 'created_at') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }
    
    if (aValue < bValue) return order === 'asc' ? -1 : 1;
    if (aValue > bValue) return order === 'asc' ? 1 : -1;
    return 0;
  });

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
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'name'}
                  direction={orderBy === 'name' ? order : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>Visibility</TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'fingerprint'}
                  direction={orderBy === 'fingerprint' ? order : 'asc'}
                  onClick={() => handleSort('fingerprint')}
                >
                  Fingerprint
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'created_at'}
                  direction={orderBy === 'created_at' ? order : 'asc'}
                  onClick={() => handleSort('created_at')}
                >
                  Created At
                </TableSortLabel>
              </TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedKeys.map((key) => (
              <TableRow key={key.id}>
                <TableCell>{key.name}</TableCell>
                <TableCell>
                  {key.is_public ? (
                    <Chip 
                      icon={<PublicIcon />} 
                      label="Public" 
                      size="small" 
                      color="primary"
                      variant="outlined"
                    />
                  ) : (
                    <Chip 
                      icon={<LockIcon />} 
                      label="Private" 
                      size="small" 
                      variant="outlined"
                    />
                  )}
                  {key.owner_id !== user?.id && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      (Shared)
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {key.fingerprint || 'N/A'}
                </TableCell>
                <TableCell>{new Date(key.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  {key.owner_id === user?.id && (
                    <>
                      <IconButton 
                        size="small" 
                        onClick={() => handleToggleVisibility(key)}
                        title={key.is_public ? 'Make private' : 'Make public'}
                      >
                        <SwapIcon />
                      </IconButton>
                      {key.public_key_content ? (
                        <>
                          <IconButton 
                            size="small" 
                            onClick={() => handleViewPublicKey(key)}
                            title="View public key"
                          >
                            <VisibilityIcon />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            onClick={() => handleCopyPublicKey(key.public_key_content)}
                            title="Copy public key"
                          >
                            <ContentCopyIcon />
                          </IconButton>
                        </>
                      ) : (
                        <IconButton 
                          size="small" 
                          onClick={() => handleGeneratePublicKey(key)}
                          title="Generate public key"
                          color="primary"
                        >
                          <GenerateIcon />
                        </IconButton>
                      )}
                      <IconButton size="small" onClick={() => handleDelete(key.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </>
                  )}
                  {key.owner_id !== user?.id && key.public_key_content && (
                    <>
                      <IconButton 
                        size="small" 
                        onClick={() => handleViewPublicKey(key)}
                        title="View public key"
                      >
                        <VisibilityIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleCopyPublicKey(key.public_key_content)}
                        title="Copy public key"
                      >
                        <ContentCopyIcon />
                      </IconButton>
                    </>
                  )}
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
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
            InputProps={{
              style: { fontFamily: 'monospace', fontSize: '0.85rem' }
            }}
          />
          <TextField
            margin="dense"
            label="Public Key (Optional)"
            fullWidth
            multiline
            rows={4}
            value={formData.public_key}
            onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
            placeholder="ssh-rsa AAAAB3NzaC1yc2E... or ssh-ed25519 AAAAC3NzaC1lZDI1NTE5..."
            InputProps={{
              style: { fontFamily: 'monospace', fontSize: '0.85rem' }
            }}
            helperText="If not provided, the public key will be automatically generated from the private key"
          />
          <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
            Paste your SSH private key. Supported formats: RSA, OpenSSH, EC (Ed25519), DSA, and PKCS#8
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2">Make this key public</Typography>
                <Typography variant="caption" color="text.secondary">
                  Public keys can be viewed and used by all users. Private keys are only visible to you.
                </Typography>
              </Box>
            }
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            Add Key
          </Button>
        </DialogActions>
      </Dialog>

      {/* Public Key View Dialog */}
      <Dialog 
        open={publicKeyDialog.open} 
        onClose={() => setPublicKeyDialog({ open: false, key: null })} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Public Key - {publicKeyDialog.key?.name}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={publicKeyDialog.key?.public_key_content || ''}
            InputProps={{
              readOnly: true,
              style: { fontFamily: 'monospace', fontSize: '0.85rem' }
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            You can copy this public key and add it to authorized_keys on your servers
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => handleCopyPublicKey(publicKeyDialog.key?.public_key_content)}
            startIcon={<ContentCopyIcon />}
          >
            Copy to Clipboard
          </Button>
          <Button onClick={() => setPublicKeyDialog({ open: false, key: null })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
