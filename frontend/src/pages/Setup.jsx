import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItem,
  Breadcrumbs,
  Link,
  Alert,
  Checkbox,
  FormControlLabel,
  LinearProgress,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Folder as FolderIcon,
  ArrowUpward,
  NavigateNext,
  CheckCircle,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const STEPS = ['Admin Account', 'Backup Storage', 'Email Setup'];

export default function Setup({ onComplete }) {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 1
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2
  const [backupDir, setBackupDir] = useState('./data/backups');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPath, setPickerPath] = useState('/');
  const [pickerDirs, setPickerDirs] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');

  // Step 3
  const [skipEmail, setSkipEmail] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpTls, setSmtpTls] = useState(true);
  const [notifyRecipients, setNotifyRecipients] = useState('');

  // --- Folder picker ---
  const loadPickerDirs = async (path) => {
    setPickerLoading(true);
    setPickerError('');
    try {
      const res = await api.get('/setup/browse-dirs', { params: { path } });
      setPickerPath(res.data.path);
      setPickerDirs(res.data.dirs);
    } catch {
      setPickerError('Could not load directory listing');
    } finally {
      setPickerLoading(false);
    }
  };

  const openPicker = () => {
    setPickerOpen(true);
    setPickerError('');
    // Try to open at the current backupDir; it may not exist yet, so fall back to /
    api.get('/setup/browse-dirs', { params: { path: backupDir || '/' } })
      .then(res => {
        setPickerPath(res.data.path);
        setPickerDirs(res.data.dirs);
      })
      .catch(() => loadPickerDirs('/'));
  };

  const handlePickerUp = () => {
    const parts = pickerPath.split('/').filter(Boolean);
    loadPickerDirs(parts.length > 0 ? '/' + parts.slice(0, -1).join('/') : '/');
  };

  const handlePickerSelect = () => {
    setBackupDir(pickerPath);
    setPickerOpen(false);
  };

  // Breadcrumb parts derived from pickerPath
  const pathParts = pickerPath === '/' ? [] : pickerPath.split('/').filter(Boolean);

  // --- Step validation ---
  const validateCurrent = () => {
    if (activeStep === 0) {
      if (!username.trim()) return 'Username is required';
      if (username.length < 3) return 'Username must be at least 3 characters';
      if (!email.trim()) return 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
      if (!password) return 'Password is required';
      if (password.length < 6) return 'Password must be at least 6 characters';
      if (password !== confirmPassword) return 'Passwords do not match';
    }
    if (activeStep === 1) {
      if (!backupDir.trim()) return 'Backup directory is required';
    }
    return null;
  };

  const handleNext = () => {
    const err = validateCurrent();
    if (err) { setError(err); return; }
    setError('');
    setActiveStep((s) => s + 1);
  };

  const handleBack = () => {
    setError('');
    setActiveStep((s) => s - 1);
  };

  const handleComplete = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload = { username, email, password, backup_dir: backupDir };
      if (!skipEmail && smtpHost) {
        payload.email_config = {
          smtp_host: smtpHost,
          smtp_port: parseInt(smtpPort, 10),
          smtp_user: smtpUser || null,
          smtp_password: smtpPassword || null,
          smtp_from: smtpFrom,
          use_tls: smtpTls,
          notify_recipients: notifyRecipients || null,
        };
      }
      await api.post('/setup/complete', payload);
      onComplete();
      navigate('/login', { state: { setupComplete: true } });
    } catch (err) {
      setError(err.response?.data?.detail || 'Setup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#0f172a',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 560 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#14b8a6', mb: 1 }}>
            PullBackup
          </Typography>
          <Typography variant="body1" sx={{ color: '#94a3b8' }}>
            Let's get you set up
          </Typography>
        </Box>

        <Paper
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            activeStep < STEPS.length - 1 ? handleNext() : handleComplete();
          }}
          sx={{ p: 4 }}
        >
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Step 1: Admin Account */}
          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6" gutterBottom>
                Create your admin account
              </Typography>
              <TextField
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
                autoFocus
              />
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                error={email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
                helperText={
                  email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
                    ? 'Enter a valid email address'
                    : ''
                }
              />
              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" tabIndex={-1}>
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Confirm Password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                fullWidth
                error={confirmPassword.length > 0 && password !== confirmPassword}
                helperText={
                  confirmPassword.length > 0 && password !== confirmPassword
                    ? 'Passwords do not match'
                    : ''
                }
              />
            </Box>
          )}

          {/* Step 2: Backup Storage */}
          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6" gutterBottom>
                Choose a backup storage location
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This is where all backup snapshots will be stored on this server.
              </Typography>
              <TextField
                label="Backup Directory"
                value={backupDir}
                onChange={(e) => setBackupDir(e.target.value)}
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={openPicker}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        Browse
                      </Button>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}

          {/* Step 3: Email */}
          {activeStep === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6" gutterBottom>
                Email notifications
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure SMTP to receive backup alerts. You can set this up later in Settings.
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox checked={skipEmail} onChange={(e) => setSkipEmail(e.target.checked)} />
                }
                label="Skip email setup for now"
              />
              {!skipEmail && (
                <>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="SMTP Host"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Port"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      type="number"
                      sx={{ width: 110 }}
                    />
                  </Box>
                  <TextField
                    label="SMTP Username"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="SMTP Password"
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="From Address"
                    value={smtpFrom}
                    onChange={(e) => setSmtpFrom(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Notify Recipients (comma-separated)"
                    value={notifyRecipients}
                    onChange={(e) => setNotifyRecipients(e.target.value)}
                    fullWidth
                  />
                  <FormControlLabel
                    control={
                      <Checkbox checked={smtpTls} onChange={(e) => setSmtpTls(e.target.checked)} />
                    }
                    label="Use TLS"
                  />
                </>
              )}
            </Box>
          )}

          {/* Navigation */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button type="button" onClick={handleBack} disabled={activeStep === 0}>
              Back
            </Button>
            {activeStep < STEPS.length - 1 ? (
              <Button type="submit" variant="contained">
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={16} /> : <CheckCircle />}
              >
                {submitting ? 'Setting up…' : 'Complete Setup'}
              </Button>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Folder Picker Dialog */}
      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Choose Backup Directory</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {/* Breadcrumb bar */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: '1px solid rgba(148,163,184,0.1)',
              bgcolor: 'rgba(15,23,42,0.5)',
            }}
          >
            <Breadcrumbs separator={<NavigateNext fontSize="small" />}>
              <Link
                component="button"
                variant="body2"
                onClick={() => loadPickerDirs('/')}
                sx={{ cursor: 'pointer', color: '#14b8a6' }}
              >
                /
              </Link>
              {pathParts.map((part, i) => {
                const partPath = '/' + pathParts.slice(0, i + 1).join('/');
                const isLast = i === pathParts.length - 1;
                return isLast ? (
                  <Typography key={partPath} variant="body2" color="text.primary">
                    {part}
                  </Typography>
                ) : (
                  <Link
                    key={partPath}
                    component="button"
                    variant="body2"
                    onClick={() => loadPickerDirs(partPath)}
                    sx={{ cursor: 'pointer', color: '#14b8a6' }}
                  >
                    {part}
                  </Link>
                );
              })}
            </Breadcrumbs>
          </Box>

          {pickerLoading && <LinearProgress />}
          {pickerError && (
            <Alert severity="error" sx={{ m: 2 }}>
              {pickerError}
            </Alert>
          )}

          <List dense sx={{ maxHeight: 360, overflow: 'auto' }}>
            {pickerPath !== '/' && (
              <ListItemButton onClick={handlePickerUp}>
                <ListItemIcon>
                  <ArrowUpward fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary=".."
                  primaryTypographyProps={{ sx: { color: '#94a3b8' } }}
                />
              </ListItemButton>
            )}
            {pickerDirs.length === 0 && !pickerLoading && (
              <ListItem>
                <ListItemText
                  primary="No subdirectories"
                  primaryTypographyProps={{ sx: { color: '#64748b', fontStyle: 'italic' } }}
                />
              </ListItem>
            )}
            {pickerDirs.map((dir) => (
              <ListItemButton key={dir.path} onClick={() => loadPickerDirs(dir.path)}>
                <ListItemIcon>
                  <FolderIcon fontSize="small" sx={{ color: '#f59e0b' }} />
                </ListItemIcon>
                <ListItemText primary={dir.name} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Typography
            variant="caption"
            sx={{ flex: 1, ml: 2, color: '#64748b', fontFamily: 'monospace' }}
          >
            {pickerPath}
          </Typography>
          <Button onClick={() => setPickerOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handlePickerSelect}>
            Select This Folder
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
