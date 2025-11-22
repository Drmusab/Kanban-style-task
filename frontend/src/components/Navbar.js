import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Avatar,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  AccountCircle,
  Dashboard,
  Settings,
  Analytics,
  ExitToApp
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleClose();
  };

  const handleNavigation = (path) => {
    navigate(path);
    handleClose();
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Kanban Task Manager
        </Typography>
        
        {!isMobile && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              color="inherit"
              startIcon={<Dashboard />}
              onClick={() => navigate('/dashboard')}
              variant={location.pathname === '/dashboard' ? 'outlined' : 'text'}
            >
              Dashboard
            </Button>
            <Button
              color="inherit"
              startIcon={<Dashboard />}
              onClick={() => navigate('/boards')}
              variant={location.pathname === '/boards' ? 'outlined' : 'text'}
            >
              Boards
            </Button>
            <Button 
              color="inherit" 
              startIcon={<Analytics />}
              onClick={() => navigate('/analytics')}
              variant={location.pathname === '/analytics' ? 'outlined' : 'text'}
            >
              Analytics
            </Button>
            <Button 
              color="inherit" 
              startIcon={<Settings />}
              onClick={() => navigate('/settings')}
              variant={location.pathname === '/settings' ? 'outlined' : 'text'}
            >
              Settings
            </Button>
          </Box>
        )}
        
        <div>
          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenu}
            color="inherit"
          >
            {user?.avatar ? (
              <Avatar src={user.avatar} alt={user.username} sx={{ width: 32, height: 32 }} />
            ) : (
              <AccountCircle />
            )}
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            {isMobile && (
              <>
                <MenuItem onClick={() => handleNavigation('/dashboard')}>
                  <Dashboard sx={{ mr: 1 }} /> Dashboard
                </MenuItem>
                <MenuItem onClick={() => handleNavigation('/boards')}>
                  <Dashboard sx={{ mr: 1 }} /> Boards
                </MenuItem>
                <MenuItem onClick={() => handleNavigation('/analytics')}>
                  <Analytics sx={{ mr: 1 }} /> Analytics
                </MenuItem>
                <MenuItem onClick={() => handleNavigation('/settings')}>
                  <Settings sx={{ mr: 1 }} /> Settings
                </MenuItem>
              </>
            )}
            <MenuItem onClick={handleLogout}>
              <ExitToApp sx={{ mr: 1 }} /> Logout
            </MenuItem>
          </Menu>
        </div>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;