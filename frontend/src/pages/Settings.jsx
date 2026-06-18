import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  TextField,
  Button,
  Alert,
  Switch,
  FormControlLabel,
  Divider,
  InputAdornment,
  IconButton,
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
} from '@mui/material';
import {
  People as PeopleIcon,
  Email as EmailIcon,
  Info as InfoIcon,
  Storage as StorageIcon,
  Visibility,
  VisibilityOff,
  Send as SendIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  ArrowUpward as ArrowUpwardIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';
import Users from './Users';
import api from '../api';
import packageJson from '../../package.json';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function EmailSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/email/');
      const data = response.data;
      // Track if password exists on server (it will be null in response)
      setHasPassword(data.smtp_password === null && data.smtp_username);
      // Set empty string for password field (backend returns null for security)
      setSettings({ ...data, smtp_password: '' });
    } catch (error) {
      console.error('Failed to fetch email settings:', error);
      setMessage({ type: 'error', text: 'Failed to load email settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings({ ...settings, [field]: value });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      // Only send password if it's been changed (not empty)
      const updateData = { ...settings };
      if (!updateData.smtp_password) {
        delete updateData.smtp_password;
      } else {
        // User entered a new password
        setHasPassword(true);
      }
      
      const response = await api.put('/email/', updateData);
      // Set empty string for password field (backend returns null for security)
      setSettings({ ...response.data, smtp_password: '' });
      setMessage({ type: 'success', text: 'Email settings saved successfully' });
    } catch (error) {
      console.error('Failed to save email settings:', error);
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      setMessage({ type: 'error', text: 'Please enter a test email address' });
      return;
    }

    setSendingTest(true);
    setMessage({ type: '', text: '' });

    try {
      await api.post('/email/test/', { recipient: testEmail });
      setMessage({ type: 'success', text: `Test email sent to ${testEmail}` });
      setTestEmail('');
    } catch (error) {
      console.error('Failed to send test email:', error);
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to send test email' });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 4, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          Email Configuration
        </Typography>

        {message.text && (
          <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage({ type: '', text: '' })}>
            {message.text}
          </Alert>
        )}

        <FormControlLabel
          control={
            <Switch
              checked={settings?.is_enabled || false}
              onChange={(e) => handleChange('is_enabled', e.target.checked)}
              color="primary"
            />
          }
          label="Enable Email Notifications"
          sx={{ mb: 3 }}
        />

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          SMTP Server Settings
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="SMTP Host"
              value={settings?.smtp_host || ''}
              onChange={(e) => handleChange('smtp_host', e.target.value)}
              placeholder="smtp.gmail.com"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="SMTP Port"
              type="number"
              value={settings?.smtp_port || 587}
              onChange={(e) => handleChange('smtp_port', parseInt(e.target.value))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="SMTP Username"
              value={settings?.smtp_username || ''}
              onChange={(e) => handleChange('smtp_username', e.target.value)}
              placeholder="your-email@example.com"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="SMTP Password"
              type={showPassword ? 'text' : 'password'}
              value={settings?.smtp_password || ''}
              onChange={(e) => handleChange('smtp_password', e.target.value)}
              placeholder={hasPassword && !settings?.smtp_password ? "Password is set (enter new to change)" : "Enter password"}
              helperText={hasPassword && !settings?.smtp_password ? "Leave empty to keep current password" : ""}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="From Email"
              value={settings?.from_email || ''}
              onChange={(e) => handleChange('from_email', e.target.value)}
              placeholder="noreply@example.com"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="From Name"
              value={settings?.from_name || ''}
              onChange={(e) => handleChange('from_name', e.target.value)}
              placeholder="PullBackup Alerts"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings?.smtp_use_tls || false}
                  onChange={(e) => handleChange('smtp_use_tls', e.target.checked)}
                  color="primary"
                />
              }
              label="Use TLS (recommended for port 587)"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings?.smtp_use_ssl || false}
                  onChange={(e) => handleChange('smtp_use_ssl', e.target.checked)}
                  color="primary"
                />
              }
              label="Use SSL (for port 465)"
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          Notification Settings
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Notification Recipients"
              value={settings?.notify_recipients || ''}
              onChange={(e) => handleChange('notify_recipients', e.target.value)}
              placeholder="admin@example.com, ops@example.com"
              helperText="Comma-separated list of email addresses to receive backup notifications"
              multiline
              rows={2}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings?.notify_on_success || false}
                  onChange={(e) => handleChange('notify_on_success', e.target.checked)}
                  color="primary"
                />
              }
              label="Notify on Successful Backups"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings?.notify_on_failure || false}
                  onChange={(e) => handleChange('notify_on_failure', e.target.checked)}
                  color="primary"
                />
              }
              label="Notify on Failed Backups"
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{
              textTransform: 'none',
              bgcolor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' }
            }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          Test Email Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Send a test email to verify your SMTP configuration is working correctly.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            fullWidth
            label="Test Email Address"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
          />
          <Button
            variant="outlined"
            onClick={handleTestEmail}
            disabled={sendingTest || !testEmail}
            startIcon={<SendIcon />}
            sx={{ textTransform: 'none', minWidth: '150px' }}
          >
            {sendingTest ? 'Sending...' : 'Send Test'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

function StorageSettings() {
  const [backupDir, setBackupDir] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPath, setPickerPath] = useState('/');
  const [pickerDirs, setPickerDirs] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');

  useEffect(() => {
    api.get('/system/backup-dir').then(r => setBackupDir(r.data.backup_dir)).catch(() => {});
  }, []);

  const loadPickerDirs = async (path) => {
    setPickerLoading(true);
    setPickerError('');
    try {
      const res = await api.get('/setup/browse-dirs', { params: { path } });
      setPickerPath(res.data.path);
      setPickerDirs(res.data.dirs);
    } catch (e) {
      setPickerError(e.response?.data?.detail || 'Failed to browse directories');
    } finally {
      setPickerLoading(false);
    }
  };

  const handleOpenPicker = () => {
    loadPickerDirs(backupDir || '/');
    setPickerOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await api.put('/system/backup-dir', { backup_dir: backupDir });
      setMessage({ type: 'success', text: 'Backup directory updated successfully' });
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.detail || 'Failed to update backup directory' });
    } finally {
      setSaving(false);
    }
  };

  const breadcrumbParts = pickerPath === '/' ? [] : pickerPath.split('/').filter(Boolean);

  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
        Backup Storage Location
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Where backup snapshots are stored. Use an absolute path or a relative path (e.g. a NAS mount point). Changes take effect immediately — existing backups are not moved.
      </Typography>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
        <TextField
          fullWidth
          label="Backup Directory"
          value={backupDir}
          onChange={(e) => setBackupDir(e.target.value)}
          placeholder="./data/backups"
        />
        <Button
          variant="outlined"
          startIcon={<FolderOpenIcon />}
          onClick={handleOpenPicker}
          sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: 120 }}
        >
          Browse
        </Button>
      </Box>

      <Button
        variant="contained"
        onClick={handleSave}
        disabled={saving || !backupDir}
        sx={{ textTransform: 'none' }}
      >
        {saving ? 'Saving...' : 'Save'}
      </Button>

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Choose Backup Directory</DialogTitle>
        <DialogContent>
          <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
            <Link component="button" variant="body2" onClick={() => loadPickerDirs('/')}>
              /
            </Link>
            {breadcrumbParts.map((part, i) => {
              const path = '/' + breadcrumbParts.slice(0, i + 1).join('/');
              return (
                <Link key={path} component="button" variant="body2" onClick={() => loadPickerDirs(path)}>
                  {part}
                </Link>
              );
            })}
          </Breadcrumbs>

          {pickerLoading ? (
            <LinearProgress />
          ) : pickerError ? (
            <Alert severity="error">{pickerError}</Alert>
          ) : (
            <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
              {pickerPath !== '/' && (
                <ListItemButton onClick={() => {
                  const parent = pickerPath.split('/').slice(0, -1).join('/') || '/';
                  loadPickerDirs(parent);
                }}>
                  <ListItemIcon><ArrowUpwardIcon /></ListItemIcon>
                  <ListItemText primary=".." />
                </ListItemButton>
              )}
              {pickerDirs.map((dir) => (
                <ListItemButton key={dir.path} onClick={() => loadPickerDirs(dir.path)}>
                  <ListItemIcon><FolderIcon /></ListItemIcon>
                  <ListItemText primary={dir.name} />
                </ListItemButton>
              ))}
              {pickerDirs.length === 0 && !pickerLoading && (
                <ListItem>
                  <ListItemText primary="No subdirectories" secondary="Use this path or type one manually" />
                </ListItem>
              )}
            </List>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Selected: <strong>{pickerPath}</strong>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPickerOpen(false)}>Cancel</Button>
          <Button
            onClick={() => { setBackupDir(pickerPath); setPickerOpen(false); }}
            variant="contained"
            disabled={pickerLoading}
          >
            Select This Folder
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

function SystemInfo() {
  const [systemData, setSystemData] = useState(null);
  const [storageData, setStorageData] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);

  useEffect(() => {
    fetchSystemInfo();
    fetchStorageStats();
    fetchHealthCheck();
  }, []);

  const fetchSystemInfo = async () => {
    try {
      const response = await api.get('/system/info');
      setSystemData(response.data);
    } catch (error) {
      console.error('Failed to fetch system info:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageStats = async () => {
    try {
      const response = await api.get('/system/storage-stats');
      setStorageData(response.data);
    } catch (error) {
      console.error('Failed to fetch storage stats:', error);
    }
  };

  const fetchHealthCheck = async () => {
    setHealthLoading(true);
    try {
      const response = await api.get('/system/health-check');
      setHealthData(response.data);
    } catch (error) {
      console.error('Failed to fetch health check:', error);
    } finally {
      setHealthLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (!systemData) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography color="error">Failed to load system information</Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* System Overview Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'rgba(20, 184, 166, 0.1)', border: '1px solid rgba(20, 184, 166, 0.2)' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                Version
              </Typography>
              <Typography variant="h6" sx={{ mt: 1, fontWeight: 700, color: '#14b8a6' }}>
                Backend: {systemData.version}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#14b8a6' }}>
                Frontend: {packageJson.version}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                Total Backups
              </Typography>
              <Typography variant="h4" sx={{ mt: 1, fontWeight: 700, color: '#3b82f6' }}>
                {systemData.backups.total.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {systemData.backups.recent_24h} in last 24h
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                Success Rate
              </Typography>
              <Typography variant="h4" sx={{ mt: 1, fontWeight: 700, color: '#10b981' }}>
                {systemData.backups.success_rate}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {systemData.backups.successful} / {systemData.backups.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                Failed Backups
              </Typography>
              <Typography variant="h4" sx={{ mt: 1, fontWeight: 700, color: '#ef4444' }}>
                {systemData.backups.failed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Storage Information */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Storage
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Backup Storage
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {systemData.storage.used_gb} GB / {systemData.storage.total_gb} GB
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={systemData.storage.used_percent} 
                sx={{ 
                  height: 10, 
                  borderRadius: 5,
                  backgroundColor: 'rgba(148, 163, 184, 0.2)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: systemData.storage.used_percent > 90 ? '#ef4444' : 
                                     systemData.storage.used_percent > 75 ? '#f59e0b' : '#14b8a6'
                  }
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {systemData.storage.free_gb} GB free ({(100 - systemData.storage.used_percent).toFixed(2)}%)
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Database Size
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {systemData.database.size_mb} MB
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatBytes(systemData.database.size)}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* System Resources */}
      {(systemData.system.cpu_percent !== null || systemData.system.memory_percent !== null) && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
            System Resources
          </Typography>

          <Grid container spacing={3}>
            {systemData.system.cpu_percent !== null && (
              <Grid item xs={12} md={6}>
                <Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      CPU Usage
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {systemData.system.cpu_percent}%
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemData.system.cpu_percent} 
                    sx={{ 
                      height: 10, 
                      borderRadius: 5,
                      backgroundColor: 'rgba(148, 163, 184, 0.2)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: systemData.system.cpu_percent > 80 ? '#ef4444' : '#3b82f6'
                      }
                    }}
                  />
                </Box>
              </Grid>
            )}

            {systemData.system.memory_percent !== null && (
              <Grid item xs={12} md={6}>
                <Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Memory Usage
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {systemData.system.memory_percent}%
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemData.system.memory_percent} 
                    sx={{ 
                      height: 10, 
                      borderRadius: 5,
                      backgroundColor: 'rgba(148, 163, 184, 0.2)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: systemData.system.memory_percent > 80 ? '#ef4444' : '#3b82f6'
                      }
                    }}
                  />
                </Box>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Entity Counts */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          System Entities
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={6} sm={4} md={2}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight={700} color="#14b8a6">
                {systemData.entities.users}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Users
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight={700} color="#14b8a6">
                {systemData.entities.servers}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Servers
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight={700} color="#14b8a6">
                {systemData.entities.ssh_keys}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                SSH Keys
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight={700} color="#14b8a6">
                {systemData.entities.backup_jobs}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Backup Jobs
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight={700} color="#10b981">
                {systemData.entities.active_jobs}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Active Jobs
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight={700} color="#14b8a6">
                {systemData.scheduler.scheduled_jobs}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Scheduled
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Storage by Backup Job */}
      {storageData && storageData.jobs && storageData.jobs.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
            Storage by Backup Job
          </Typography>

          <Box mb={2}>
            <Typography variant="body2" color="text.secondary">
              Total: {storageData.total_size_gb} GB across {storageData.total_snapshots} snapshots
            </Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Backup Job</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Snapshots</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Size</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">% of Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {storageData.jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{job.name}</TableCell>
                    <TableCell>
                      <Chip label={job.snapshot_count} size="small" />
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                      {job.size_gb} GB
                    </TableCell>
                    <TableCell align="right">
                      {storageData.total_size > 0 
                        ? ((job.size / storageData.total_size) * 100).toFixed(1) 
                        : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* System Health Check */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            System Health
          </Typography>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchHealthCheck}
            disabled={healthLoading}
            size="small"
          >
            Refresh
          </Button>
        </Box>

        {healthLoading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={30} />
          </Box>
        )}

        {!healthLoading && healthData && (
          <>
            {/* Overall Status */}
            <Box mb={3}>
              <Alert
                severity={
                  healthData.status === 'healthy' ? 'success' :
                  healthData.status === 'degraded' ? 'warning' :
                  'error'
                }
                icon={
                  healthData.status === 'healthy' ? <CheckCircleIcon /> :
                  healthData.status === 'degraded' ? <WarningIcon /> :
                  <ErrorIcon />
                }
              >
                <Typography variant="body2" fontWeight={600}>
                  {healthData.status === 'healthy' && 'All systems operational'}
                  {healthData.status === 'degraded' && `${healthData.total_warnings} warning(s) detected`}
                  {healthData.status === 'unhealthy' && `${healthData.critical_count} critical issue(s) detected`}
                </Typography>
                <Typography variant="caption">
                  Last checked: {new Date(healthData.timestamp).toLocaleString()}
                </Typography>
              </Alert>
            </Box>

            {/* Critical Issues */}
            {healthData.issues && healthData.issues.length > 0 && (
              <Box mb={3}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#ef4444' }}>
                  <ErrorIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Critical Issues ({healthData.issues.length})
                </Typography>
                {healthData.issues.map((issue, index) => (
                  <Alert key={index} severity="error" sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight={600} gutterBottom>
                      {issue.message}
                    </Typography>
                    {issue.suggestion && (
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        <strong>Suggestion:</strong> {issue.suggestion}
                      </Typography>
                    )}
                    {issue.last_error && (
                      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                        <strong>Last Error:</strong> {issue.last_error}
                      </Typography>
                    )}
                  </Alert>
                ))}
              </Box>
            )}

            {/* Warnings */}
            {healthData.warnings && healthData.warnings.length > 0 && (
              <Box mb={3}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#f59e0b' }}>
                  <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Warnings ({healthData.warnings.length})
                </Typography>
                {healthData.warnings.map((warning, index) => (
                  <Alert key={index} severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight={600} gutterBottom>
                      {warning.message}
                    </Typography>
                    {warning.suggestion && (
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        <strong>Suggestion:</strong> {warning.suggestion}
                      </Typography>
                    )}
                  </Alert>
                ))}
              </Box>
            )}

            {/* Health Summary */}
            {healthData.status === 'healthy' && healthData.issues.length === 0 && healthData.warnings.length === 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  All {healthData.active_jobs_checked} active backup job(s) are healthy.
                  No missed backups or failures detected.
                </Typography>
              </Box>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
}

export default function Settings() {
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h3" sx={{ 
          fontWeight: 700, 
          mb: 1,
          background: '#14b8a6',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure system settings and preferences
        </Typography>
      </Box>

      <Paper sx={{ 
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            background: 'rgba(20, 184, 166, 0.05)',
            px: 2,
          }}
        >
          <Tab 
            icon={<InfoIcon />} 
            iconPosition="start"
            label="System" 
            sx={{ 
              fontWeight: 600,
              minHeight: 64,
            }}
          />
          <Tab 
            icon={<PeopleIcon />} 
            iconPosition="start"
            label="Users" 
            sx={{ 
              fontWeight: 600,
              minHeight: 64,
            }}
          />
          <Tab
            icon={<EmailIcon />}
            iconPosition="start"
            label="Email"
            sx={{
              fontWeight: 600,
              minHeight: 64,
            }}
          />
          <Tab
            icon={<StorageIcon />}
            iconPosition="start"
            label="Storage"
            sx={{
              fontWeight: 600,
              minHeight: 64,
            }}
          />
        </Tabs>

        <Box sx={{ px: 3 }}>
          <TabPanel value={currentTab} index={0}>
            <SystemInfo />
          </TabPanel>
          <TabPanel value={currentTab} index={1}>
            <Users />
          </TabPanel>
          <TabPanel value={currentTab} index={2}>
            <EmailSettings />
          </TabPanel>
          <TabPanel value={currentTab} index={3}>
            <StorageSettings />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}
