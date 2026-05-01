import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  Storage as StorageIcon,
  Backup as BackupIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import api from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentFailures, setRecentFailures] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchRecentFailures();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentFailures = async () => {
    try {
      const response = await api.get('/backup-history/?limit=20');
      // Filter for failed backups on the frontend
      const failed = response.data.filter(item => item.status === 'FAILED').slice(0, 3);
      setRecentFailures(failed);
    } catch (error) {
      console.error('Failed to fetch recent failures:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress sx={{
          background: 'rgba(20, 184, 166, 0.1)',
          '& .MuiLinearProgress-bar': {
            background: '#14b8a6',
          },
        }} />
      </Box>
    );
  }

  const successRate = stats?.total_backups > 0 
    ? ((stats?.successful_backups || 0) / stats?.total_backups * 100).toFixed(1)
    : 0;

  const statCards = [
    {
      title: 'Total Servers',
      value: stats?.total_servers || 0,
      icon: <StorageIcon sx={{ fontSize: 40 }} />,
      gradient: '#14b8a6',
      iconBg: 'rgba(102, 126, 234, 0.1)',
    },
    {
      title: 'Backup Jobs',
      value: stats?.total_backup_jobs || 0,
      icon: <BackupIcon sx={{ fontSize: 40 }} />,
      gradient: '#f093fb',
      iconBg: 'rgba(240, 147, 251, 0.1)',
    },
    {
      title: 'Successful Backups',
      value: stats?.successful_backups || 0,
      icon: <CheckCircleIcon sx={{ fontSize: 40 }} />,
      gradient: '#4facfe',
      iconBg: 'rgba(79, 172, 254, 0.1)',
    },
    {
      title: 'Failed Backups',
      value: stats?.failed_backups || 0,
      icon: <ErrorIcon sx={{ fontSize: 40 }} />,
      gradient: '#fa709a',
      iconBg: 'rgba(250, 112, 154, 0.1)',
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ 
          fontWeight: 700, 
          mb: 1,
          background: '#14b8a6',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome back! Here's your backup overview
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} lg={3} key={index}>
            <Card sx={{
              height: '100%',
              background: `${card.gradient}`,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(10px)',
              },
            }}>
              <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                      {card.title}
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>
                      {card.value}
                    </Typography>
                  </Box>
                  <Box sx={{
                    background: card.iconBg,
                    borderRadius: 3,
                    p: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {React.cloneElement(card.icon, {
                      sx: {
                        ...card.icon.props.sx,
                        background: card.gradient,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }
                    })}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              Backup Success Rate
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Overall Performance
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {successRate}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={parseFloat(successRate)}
                sx={{
                  height: 12,
                  borderRadius: 6,
                  background: 'rgba(148, 163, 184, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 6,
                    background: '#10b981',
                  },
                }}
              />
            </Box>
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={6}>
                <Box sx={{ 
                  p: 2, 
                  borderRadius: 2, 
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Successful
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#10b981' }}>
                    {stats?.successful_backups || 0}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ 
                  p: 2, 
                  borderRadius: 2, 
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Failed
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#ef4444' }}>
                    {stats?.failed_backups || 0}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Recent Failures */}
            <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5, color: 'text.secondary' }}>
                Recent Failures
              </Typography>
              {recentFailures.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 1 }}>
                  No failed backups
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {recentFailures.map((failure, index) => (
                    <Box 
                      key={index}
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1,
                        py: 0.5,
                      }}
                    >
                      <Box sx={{ 
                        width: 6, 
                        height: 6, 
                        borderRadius: '50%', 
                        background: '#ef4444',
                        flexShrink: 0,
                      }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                          {failure.backup_job?.name || `Job #${failure.backup_job_id}`}
                        </Typography>
                        {failure.backup_job?.server?.name && (
                          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', display: 'block' }} noWrap>
                            {failure.backup_job.server.name}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem', flexShrink: 0, ml: 1 }}>
                        {failure.started_at ? new Date(failure.started_at).toLocaleDateString() : 'N/A'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{
                p: 2,
                borderRadius: 2,
                background: 'rgba(20, 184, 166, 0.1)',
                border: '1px solid rgba(20, 184, 166, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  background: 'rgba(20, 184, 166, 0.15)',
                  borderColor: 'rgba(20, 184, 166, 0.4)',
                },
              }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Add New Server
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Configure a new backup source
                </Typography>
              </Box>
              <Box sx={{
                p: 2,
                borderRadius: 2,
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  background: 'rgba(16, 185, 129, 0.15)',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                },
              }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Create Backup Job
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Set up automated backups
                </Typography>
              </Box>
              <Box sx={{
                p: 2,
                borderRadius: 2,
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  background: 'rgba(245, 158, 11, 0.15)',
                  borderColor: 'rgba(245, 158, 11, 0.4)',
                },
              }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  View History
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Check recent backup logs
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          System Status
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          All systems operational. Next scheduled backup in 2 hours.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            label="API: Online" 
            color="success" 
            size="small"
            sx={{ fontWeight: 600 }}
          />
          <Chip 
            label="Scheduler: Active" 
            color="success" 
            size="small"
            sx={{ fontWeight: 600 }}
          />
          <Chip 
            label="Storage: 45% Used" 
            color="info" 
            size="small"
            sx={{ fontWeight: 600 }}
          />
        </Box>
      </Paper>
    </Box>
  );
}
