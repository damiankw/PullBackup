import React, { useState, useEffect, useRef } from 'react';
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
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Alert,
  CircularProgress,
  Tooltip,
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
  FolderOpen as BrowseIcon,
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
  const [addError, setAddError] = useState('');

  // Generate dialog
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({ name: '', key_type: 'ed25519', is_public: false });
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generatedKey, setGeneratedKey] = useState(null);

  const { user } = useAuth();
  const privateKeyFileRef = useRef(null);
  const publicKeyFileRef = useRef(null);

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

  // --- Add / Import dialog ---
  const handleOpen = () => {
    setFormData({ name: '', private_key: '', public_key: '', is_public: false });
    setAddError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setAddError('');
  };

  const handleFileRead = (file, field) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setFormData(prev => ({ ...prev, [field]: e.target.result }));
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    try {
      await api.post('/ssh-keys/', formData);
      fetchKeys();
      handleClose();
    } catch (error) {
      setAddError(error.response?.data?.detail || 'Failed to add key');
    }
  };

  // --- Generate dialog ---
  const handleGenerateOpen = () => {
    setGenerateForm({ name: '', key_type: 'ed25519', is_public: false });
    setGenerateError('');
    setGeneratedKey(null);
    setGenerateOpen(true);
  };

  const handleGenerateClose = () => {
    setGenerateOpen(false);
    setGeneratedKey(null);
    setGenerateError('');
    if (generatedKey) fetchKeys();
  };

  const handleGenerate = async () => {
    if (!generateForm.name.trim()) {
      setGenerateError('Key name is required');
      return;
    }
    setGenerating(true);
    setGenerateError('');
    try {
      const res = await api.post('/ssh-keys/generate', generateForm);
      setGeneratedKey(res.data);
    } catch (error) {
      setGenerateError(error.response?.data?.detail || 'Key generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // --- Other actions ---
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this SSH key?')) {
      try {
        await api.delete(`/ssh-keys/${id}`);
        fetchKeys();
      } catch (error) {
        alert('Failed to delete SSH key: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  const handleToggleVisibility = async (key) => {
    const newIsPublic = !key.is_public;
    const label = newIsPublic ? 'public' : 'private';
    if (window.confirm(`Change "${key.name}" to ${label}?\n\n${newIsPublic ? 'This key will be visible and usable by all users.' : 'This key will only be visible to you.'}`)) {
      try {
        await api.patch(`/ssh-keys/${key.id}`, { is_public: newIsPublic });
        fetchKeys();
      } catch (error) {
        alert('Failed to update SSH key: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  const handleViewPublicKey = (key) => setPublicKeyDialog({ open: true, key });

  const handleCopyPublicKey = (publicKey) => {
    navigator.clipboard.writeText(publicKey);
    alert('Public key copied to clipboard!');
  };

  const handleGeneratePublicKey = async (key) => {
    if (window.confirm(`Generate public key for "${key.name}"?\n\nThis will extract the public key from the private key file.`)) {
      try {
        await api.post(`/ssh-keys/${key.id}/generate-public-key`);
        fetchKeys();
        alert('Public key generated successfully!');
      } catch (error) {
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<GenerateIcon />} onClick={handleGenerateOpen}>
            Generate Key
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>
            Add / Import Key
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel active={orderBy === 'name'} direction={orderBy === 'name' ? order : 'asc'} onClick={() => handleSort('name')}>
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>Visibility</TableCell>
              <TableCell>
                <TableSortLabel active={orderBy === 'fingerprint'} direction={orderBy === 'fingerprint' ? order : 'asc'} onClick={() => handleSort('fingerprint')}>
                  Fingerprint
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={orderBy === 'created_at'} direction={orderBy === 'created_at' ? order : 'asc'} onClick={() => handleSort('created_at')}>
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
                    <Chip icon={<PublicIcon />} label="Public" size="small" color="primary" variant="outlined" />
                  ) : (
                    <Chip icon={<LockIcon />} label="Private" size="small" variant="outlined" />
                  )}
                  {key.owner_id !== user?.id && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>(Shared)</Typography>
                  )}
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {key.fingerprint || 'N/A'}
                </TableCell>
                <TableCell>{new Date(key.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  {key.owner_id === user?.id && (
                    <>
                      <Tooltip title={key.is_public ? 'Make private' : 'Make public'}>
                        <IconButton size="small" onClick={() => handleToggleVisibility(key)}>
                          <SwapIcon />
                        </IconButton>
                      </Tooltip>
                      {key.public_key_content ? (
                        <>
                          <Tooltip title="View public key">
                            <IconButton size="small" onClick={() => handleViewPublicKey(key)}>
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Copy public key">
                            <IconButton size="small" onClick={() => handleCopyPublicKey(key.public_key_content)}>
                              <ContentCopyIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <Tooltip title="Generate public key">
                          <IconButton size="small" onClick={() => handleGeneratePublicKey(key)} color="primary">
                            <GenerateIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDelete(key.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  {key.owner_id !== user?.id && key.public_key_content && (
                    <>
                      <Tooltip title="View public key">
                        <IconButton size="small" onClick={() => handleViewPublicKey(key)}>
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy public key">
                        <IconButton size="small" onClick={() => handleCopyPublicKey(key.public_key_content)}>
                          <ContentCopyIcon />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add / Import Key Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add / Import SSH Key</DialogTitle>
        <DialogContent>
          {addError && <Alert severity="error" sx={{ mb: 2 }}>{addError}</Alert>}
          <TextField
            autoFocus
            margin="dense"
            label="Key Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Private Key</Typography>
            <Button
              size="small"
              startIcon={<BrowseIcon />}
              onClick={() => privateKeyFileRef.current?.click()}
            >
              Browse file
            </Button>
          </Box>
          <input
            ref={privateKeyFileRef}
            type="file"
            style={{ display: 'none' }}
            accept=".pem,.key,.txt"
            onChange={(e) => handleFileRead(e.target.files[0], 'private_key')}
          />
          <TextField
            fullWidth
            multiline
            rows={8}
            value={formData.private_key}
            onChange={(e) => setFormData({ ...formData, private_key: e.target.value })}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
            InputProps={{ style: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Public Key (Optional)</Typography>
            <Button
              size="small"
              startIcon={<BrowseIcon />}
              onClick={() => publicKeyFileRef.current?.click()}
            >
              Browse file
            </Button>
          </Box>
          <input
            ref={publicKeyFileRef}
            type="file"
            style={{ display: 'none' }}
            accept=".pub,.txt"
            onChange={(e) => handleFileRead(e.target.files[0], 'public_key')}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            value={formData.public_key}
            onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
            placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... or leave blank to auto-generate"
            InputProps={{ style: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
            helperText="If not provided, the public key will be automatically extracted from the private key"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Make this key public</Typography>
                <Typography variant="caption" color="text.secondary">
                  Public keys can be viewed and used by all users.
                </Typography>
              </Box>
            }
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">Add Key</Button>
        </DialogActions>
      </Dialog>

      {/* Generate Key Dialog */}
      <Dialog open={generateOpen} onClose={handleGenerateClose} maxWidth="sm" fullWidth>
        <DialogTitle>Generate SSH Key</DialogTitle>
        <DialogContent>
          {generateError && <Alert severity="error" sx={{ mb: 2 }}>{generateError}</Alert>}

          {!generatedKey ? (
            <>
              <TextField
                autoFocus
                margin="dense"
                label="Key Name"
                fullWidth
                value={generateForm.name}
                onChange={(e) => setGenerateForm({ ...generateForm, name: e.target.value })}
              />
              <FormControl fullWidth margin="dense">
                <InputLabel>Key Type</InputLabel>
                <Select
                  label="Key Type"
                  value={generateForm.key_type}
                  onChange={(e) => setGenerateForm({ ...generateForm, key_type: e.target.value })}
                >
                  <MenuItem value="ed25519">Ed25519 (Recommended)</MenuItem>
                  <MenuItem value="rsa">RSA 4096</MenuItem>
                  <MenuItem value="ecdsa">ECDSA 521</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={generateForm.is_public}
                    onChange={(e) => setGenerateForm({ ...generateForm, is_public: e.target.checked })}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Make this key public</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Public keys can be viewed and used by all users.
                    </Typography>
                  </Box>
                }
                sx={{ mt: 1 }}
              />
            </>
          ) : (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                Key <strong>{generatedKey.name}</strong> generated successfully ({generatedKey.fingerprint})
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Copy this public key and add it to <code>~/.ssh/authorized_keys</code> on your servers:
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={generatedKey.public_key_content || ''}
                InputProps={{
                  readOnly: true,
                  style: { fontFamily: 'monospace', fontSize: '0.8rem' },
                }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          {!generatedKey ? (
            <>
              <Button onClick={handleGenerateClose}>Cancel</Button>
              <Button
                onClick={handleGenerate}
                variant="contained"
                disabled={generating}
                startIcon={generating ? <CircularProgress size={16} /> : <GenerateIcon />}
              >
                {generating ? 'Generating…' : 'Generate'}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => handleCopyPublicKey(generatedKey.public_key_content)}
                startIcon={<ContentCopyIcon />}
              >
                Copy Public Key
              </Button>
              <Button onClick={handleGenerateClose} variant="contained">Done</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Public Key View Dialog */}
      <Dialog
        open={publicKeyDialog.open}
        onClose={() => setPublicKeyDialog({ open: false, key: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Public Key — {publicKeyDialog.key?.name}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={publicKeyDialog.key?.public_key_content || ''}
            InputProps={{ readOnly: true, style: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Add this to <code>~/.ssh/authorized_keys</code> on your servers
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => handleCopyPublicKey(publicKeyDialog.key?.public_key_content)}
            startIcon={<ContentCopyIcon />}
          >
            Copy to Clipboard
          </Button>
          <Button onClick={() => setPublicKeyDialog({ open: false, key: null })}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
