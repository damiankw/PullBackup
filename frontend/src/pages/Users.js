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
  MenuItem,
  Switch,
  FormControlLabel,
  TableSortLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import api from '../api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [orderBy, setOrderBy] = useState('username');
  const [order, setOrder] = useState('asc');
  const [formData, setFormData] = useState({
    email: '',
    role: 'user',
    is_active: true,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleOpen = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        role: user.role,
        is_active: user.is_active,
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        role: 'user',
        is_active: true,
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingUser(null);
    setFormData({
      email: '',
      role: 'user',
      is_active: true,
    });
  };

  const handleSubmit = async () => {
    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, formData);
      }
      handleClose();
      fetchUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
      alert(error.response?.data?.detail || 'Failed to save user');
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await api.delete(`/users/${userId}`);
        fetchUsers();
      } catch (error) {
        console.error('Failed to delete user:', error);
        alert(error.response?.data?.detail || 'Failed to delete user');
      }
    }
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedUsers = [...users].sort((a, b) => {
    let aValue = a[orderBy];
    let bValue = b[orderBy];
    
    if (orderBy === 'created_at') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          User Management
        </Typography>
      </Box>

      <TableContainer 
        component={Paper} 
        sx={{ 
          background: 'rgba(30, 41, 59, 0.8)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ 
              background: 'rgba(20, 184, 166, 0.1)',
            }}>
              <TableCell sx={{ fontWeight: 600 }}>
                <TableSortLabel
                  active={orderBy === 'username'}
                  direction={orderBy === 'username' ? order : 'asc'}
                  onClick={() => handleSort('username')}
                >
                  Username
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                <TableSortLabel
                  active={orderBy === 'email'}
                  direction={orderBy === 'email' ? order : 'asc'}
                  onClick={() => handleSort('email')}
                >
                  Email
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                <TableSortLabel
                  active={orderBy === 'role'}
                  direction={orderBy === 'role' ? order : 'asc'}
                  onClick={() => handleSort('role')}
                >
                  Role
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                <TableSortLabel
                  active={orderBy === 'is_active'}
                  direction={orderBy === 'is_active' ? order : 'asc'}
                  onClick={() => handleSort('is_active')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                <TableSortLabel
                  active={orderBy === 'created_at'}
                  direction={orderBy === 'created_at' ? order : 'asc'}
                  onClick={() => handleSort('created_at')}
                >
                  Created
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedUsers.map((user) => (
              <TableRow 
                key={user.id}
                sx={{ 
                  '&:hover': { 
                    background: 'rgba(99, 102, 241, 0.05)',
                  },
                }}
              >
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip
                    label={user.role}
                    size="small"
                    sx={{
                      background: user.role === 'admin' 
                        ? 'rgba(20, 184, 166, 0.2)'
                        : 'rgba(148, 163, 184, 0.1)',
                      color: user.role === 'admin' ? '#5eead4' : 'text.secondary',
                      border: `1px solid ${user.role === 'admin' ? 'rgba(20, 184, 166, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
                      textTransform: 'capitalize',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={user.is_active ? 'Active' : 'Inactive'}
                    size="small"
                    sx={{
                      background: user.is_active 
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                      color: user.is_active ? '#10b981' : '#ef4444',
                      border: `1px solid ${user.is_active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                    }}
                  />
                </TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => handleOpen(user)}
                    sx={{ color: '#14b8a6', mr: 1 }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(user.id)}
                    sx={{ color: '#ef4444' }}
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
            border: '1px solid rgba(148, 163, 184, 0.1)',
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editingUser ? 'Edit User' : 'Add User'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            select
            label="Role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            margin="normal"
          >
            <MenuItem value="user">User</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
            }
            label="Active"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            sx={{
              background: '#14b8a6',
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
