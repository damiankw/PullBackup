import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Storage as StorageIcon,
  VpnKey as VpnKeyIcon,
  Backup as BackupIcon,
  History as HistoryIcon,
  Logout as LogoutIcon,
  CloudSync as CloudSyncIcon,
  People as PeopleIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useAuth } from '../AuthContext';

const drawerWidth = 280;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Servers', icon: <StorageIcon />, path: '/servers' },
  { text: 'SSH Keys', icon: <VpnKeyIcon />, path: '/ssh-keys' },
  { text: 'Backup Jobs', icon: <BackupIcon />, path: '/backup-jobs' },
  { text: 'History', icon: <HistoryIcon />, path: '/backup-history' },
  { text: 'Users', icon: <PeopleIcon />, path: '/users', adminOnly: true },
  { text: 'Profile', icon: <PersonIcon />, path: '/profile' },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter menu items based on user role
  const visibleMenuItems = menuItems.filter(item => {
    if (item.adminOnly && user?.role !== 'admin') {
      return false;
    }
    return true;
  });

  const drawer = (
    <Box sx={{ 
      height: '100%', 
      background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{
          background: '#14b8a6',
          borderRadius: 3,
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <CloudSyncIcon sx={{ fontSize: 32, color: 'white' }} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ 
            fontWeight: 700,
            background: '#14b8a6',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            PullBackup
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Enterprise Backup System
          </Typography>
        </Box>
      </Box>
      
      <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.1)', mx: 2 }} />
      
      <List sx={{ flex: 1, px: 2, py: 2 }}>
        {visibleMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{
                borderRadius: 2,
                py: 1.5,
                '&.Mui-selected': {
                  background: 'rgba(20, 184, 166, 0.2)',
                  borderLeft: '3px solid #14b8a6',
                  '&:hover': {
                    background: 'rgba(20, 184, 166, 0.3)',
                  },
                },
                '&:hover': {
                  background: 'rgba(148, 163, 184, 0.1)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              <ListItemIcon sx={{ 
                color: location.pathname === item.path ? '#14b8a6' : 'inherit',
                minWidth: 40,
              }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text}
                primaryTypographyProps={{
                  fontWeight: location.pathname === item.path ? 600 : 400,
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.1)', mx: 2 }} />

      <Box sx={{ p: 2 }}>
        <ListItem disablePadding>
          <ListItemButton 
            onClick={handleLogout}
            sx={{
              borderRadius: 2,
              py: 1.5,
              '&:hover': {
                background: 'rgba(239, 68, 68, 0.1)',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </ListItem>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            {visibleMenuItems.find((item) => item.path === location.pathname)?.text || 'PullBackup'}
          </Typography>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
