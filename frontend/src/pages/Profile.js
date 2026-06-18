import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
  Alert,
} from '@mui/material';
import api from '../api';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [emailForm, setEmailForm] = useState({ email: '' });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/users/me');
      setProfile(response.data);
      setEmailForm({ email: response.data.email });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const handleEmailUpdate = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    
    try {
      await api.patch(`/users/${profile.id}`, { email: emailForm.email });
      setMessage({ type: 'success', text: 'Email updated successfully' });
      fetchProfile();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Failed to update email' 
      });
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordForm.new_password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    try {
      await api.post('/users/me/password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Failed to change password' 
      });
    }
  };

  if (!profile) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Profile Settings
      </Typography>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, background: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(20px)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Account Information
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Username
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {profile.username}
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Role
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
                {profile.role}
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Member Since
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {new Date(profile.created_at).toLocaleDateString()}
              </Typography>
            </Box>

            <Divider sx={{ my: 3 }} />

            <form onSubmit={handleEmailUpdate}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Update Email
              </Typography>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={emailForm.email}
                onChange={(e) => setEmailForm({ email: e.target.value })}
                margin="normal"
                required
              />
              <Button
                type="submit"
                variant="contained"
                sx={{
                  mt: 2,
                  background: '#14b8a6',
                }}
              >
                Update Email
              </Button>
            </form>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, background: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(20px)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Change Password
            </Typography>
            
            <form onSubmit={handlePasswordChange}>
              <TextField
                fullWidth
                label="Current Password"
                type="password"
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="New Password"
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                margin="normal"
                required
                helperText="Minimum 6 characters"
              />
              <TextField
                fullWidth
                label="Confirm New Password"
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                margin="normal"
                required
              />
              <Button
                type="submit"
                variant="contained"
                sx={{
                  mt: 2,
                  background: '#14b8a6',
                }}
              >
                Change Password
              </Button>
            </form>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
