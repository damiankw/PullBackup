import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
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

  useEffect(() => {
    fetchStats();
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

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  const statCards = [
    {
      title: 'Servers',
      value: stats?.total_servers || 0,
      icon: <StorageIcon sx={{ fontSize: 40 }} />,
      color: '#1976d2',
    },
    {
      title: 'Backup Jobs',
      value: stats?.total_backup_jobs || 0,
      icon: <BackupIcon sx={{ fontSize: 40 }} />,
      color: '#2e7d32',
    },
    {
      title: 'Successful Backups',
      value: stats?.successful_backups || 0,
      icon: <CheckCircleIcon sx={{ fontSize: 40 }} />,
      color: '#388e3c',
    },
    {
      title: 'Failed Backups',
      value: stats?.failed_backups || 0,
      icon: <ErrorIcon sx={{ fontSize: 40 }} />,
      color: '#d32f2f',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Grid container spacing={3}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      {card.title}
                    </Typography>
                    <Typography variant="h4">
                      {card.value}
                    </Typography>
                  </Box>
                  <Box sx={{ color: card.color }}>
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Paper sx={{ mt: 3, p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Welcome to PullBackup
        </Typography>
        <Typography variant="body1" paragraph>
          Your enterprise backup system is ready. Get started by:
        </Typography>
        <Typography variant="body2" component="div">
          <ol>
            <li>Adding SSH keys for server authentication</li>
            <li>Adding remote servers to backup</li>
            <li>Creating backup jobs with schedules</li>
            <li>Monitoring backup history</li>
          </ol>
        </Typography>
      </Paper>
    </Box>
  );
}
