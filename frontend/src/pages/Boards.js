import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Menu,
  MenuItem,
  Divider
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  ContentCopy
} from '@mui/icons-material';
import { getBoards, createBoard, deleteBoard, duplicateBoard } from '../services/boardService';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

const Boards = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedBoard, setSelectedBoard] = useState(null);

  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const response = await getBoards();
        setBoards(response.data);
        setLoading(false);
      } catch (error) {
        showError('Failed to load boards');
        setLoading(false);
      }
    };

    fetchBoards();
  }, [showError]);

  const handleCreateBoard = async () => {
    try {
      await createBoard({
        name: boardName,
        description: boardDescription,
        created_by: user.id
      });
      
      showSuccess('Board created successfully');
      setDialogOpen(false);
      setBoardName('');
      setBoardDescription('');
      
      // Refresh boards
      const response = await getBoards();
      setBoards(response.data);
    } catch (error) {
      showError('Failed to create board');
    }
  };

  const handleDeleteBoard = async (boardId) => {
    try {
      await deleteBoard(boardId);
      showSuccess('Board deleted successfully');
      
      // Refresh boards
      const response = await getBoards();
      setBoards(response.data);
    } catch (error) {
      showError('Failed to delete board');
    }
    
    setMenuAnchor(null);
  };

  const handleDuplicateBoard = async (boardId) => {
    try {
      const board = boards.find(b => b.id === boardId);
      await duplicateBoard(boardId, `${board.name} (Copy)`, user.id);
      
      showSuccess('Board duplicated successfully');
      
      // Refresh boards
      const response = await getBoards();
      setBoards(response.data);
    } catch (error) {
      showError('Failed to duplicate board');
    }
    
    setMenuAnchor(null);
  };

  const handleMenuClick = (event, board) => {
    setMenuAnchor(event.currentTarget);
    setSelectedBoard(board);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedBoard(null);
  };

  if (loading) {
    return <Typography>Loading boards...</Typography>;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        My Boards
      </Typography>
      
      <Grid container spacing={3}>
        {boards.map(board => (
          <Grid item xs={12} sm={6} md={4} key={board.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                '&:hover': {
                  boxShadow: 4
                }
              }}
              onClick={() => navigate(`/board/${board.id}`)}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="h5" component="h2">
                    {board.name}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuClick(e, board);
                    }}
                  >
                    <MoreVert />
                  </IconButton>
                </Box>
                {board.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {board.description.substring(0, 100)}
                    {board.description.length > 100 && '...'}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  Created: {new Date(board.created_at).toLocaleDateString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16
        }}
        onClick={() => setDialogOpen(true)}
      >
        <Add />
      </Fab>
      
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Board</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Board Name"
            fullWidth
            variant="outlined"
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            sx={{ mt: 1 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            variant="outlined"
            multiline
            rows={4}
            value={boardDescription}
            onChange={(e) => setBoardDescription(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateBoard} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
      
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          navigate(`/board/${selectedBoard.id}`);
          handleMenuClose();
        }}>
          Open
        </MenuItem>
        <MenuItem onClick={() => {
          handleDuplicateBoard(selectedBoard.id);
        }}>
          <ContentCopy sx={{ mr: 1 }} /> Duplicate
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          handleDeleteBoard(selectedBoard.id);
        }}>
          <Delete sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Boards;