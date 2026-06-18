import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Grid,
  Collapse,
  IconButton,
  Card,
  CardContent,
} from '@mui/material';
import {
  FilterList as FilterListIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import api from '../api';
import { useAuth } from '../AuthContext';

export default function AuditLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    username: '',
    action: '',
    resource_type: '',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    fetchLogs();
    if (user?.role === 'admin') {
      fetchStats();
    }
  }, [filters, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLogs = async () => {
    try {
      const params = {};
      
      // Add filters to params if they have values
      if (filters.username) params.username = filters.username;
      if (filters.action) params.action = filters.action;
      if (filters.resource_type) params.resource_type = filters.resource_type;
      if (filters.date_from) params.date_from = new Date(filters.date_from).toISOString();
      if (filters.date_to) params.date_to = new Date(filters.date_to).toISOString();
      
      const response = await api.get('/audit-logs/', { params });
      setLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/audit-logs/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch audit stats:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      username: '',
      action: '',
      resource_type: '',
      date_from: '',
      date_to: '',
    });
  };

  const getActionColor = (action) => {
    const colors = {
      login: 'success',
      logout: 'info',
      create: 'primary',
      update: 'warning',
      delete: 'error',
      download: 'secondary',
      execute: 'info',
    };
    return colors[action.toLowerCase()] || 'default';
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Audit Logs</Typography>
        <IconButton onClick={() => setShowFilters(!showFilters)}>
          {showFilters ? <ExpandLessIcon /> : <FilterListIcon />}
        </IconButton>
      </Box>

      {/* Stats Cards - Admin Only */}
      {user?.role === 'admin' && stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Total Logs</Typography>
                <Typography variant="h4">{stats.total_logs?.toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Last 24 Hours</Typography>
                <Typography variant="h4">{stats.recent_activity_24h?.toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Top Action</Typography>
                <Typography variant="h6">
                  {Object.entries(stats.by_action || {})
                    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Most Active User</Typography>
                <Typography variant="h6">
                  {stats.top_users?.[0]?.username || 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Collapse in={showFilters}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Username"
                value={filters.username}
                onChange={(e) => handleFilterChange('username', e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Action</InputLabel>
                <Select
                  value={filters.action}
                  label="Action"
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="login">Login</MenuItem>
                  <MenuItem value="logout">Logout</MenuItem>
                  <MenuItem value="create">Create</MenuItem>
                  <MenuItem value="update">Update</MenuItem>
                  <MenuItem value="delete">Delete</MenuItem>
                  <MenuItem value="download">Download</MenuItem>
                  <MenuItem value="execute">Execute</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Resource Type</InputLabel>
                <Select
                  value={filters.resource_type}
                  label="Resource Type"
                  onChange={(e) => handleFilterChange('resource_type', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="ssh_key">SSH Key</MenuItem>
                  <MenuItem value="server">Server</MenuItem>
                  <MenuItem value="backup_job">Backup Job</MenuItem>
                  <MenuItem value="file">File</MenuItem>
                  <MenuItem value="folder">Folder</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="From Date"
                type="datetime-local"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="To Date"
                type="datetime-local"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <button
                  onClick={clearFilters}
                  style={{
                    padding: '6px 16px',
                    backgroundColor: '#424242',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Clear Filters
                </button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>

      {/* Logs Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Resource Type</TableCell>
              <TableCell>Resource</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No audit logs found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell>
                    <Tooltip title={formatDateTime(log.created_at)}>
                      <Typography variant="body2" noWrap>
                        {formatDateTime(log.created_at)}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap>
                      {log.username || 'System'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={log.action.toUpperCase()}
                      color={getActionColor(log.action)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap>
                      {log.resource_type || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap>
                      {log.resource_name || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={log.user_agent || 'No user agent'}>
                      <Typography variant="body2" noWrap>
                        {log.ip_address || 'N/A'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={log.description || ''}>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {log.description || 'N/A'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
