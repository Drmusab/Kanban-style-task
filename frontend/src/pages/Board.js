import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
  Menu,
  MenuItem,
  Divider,
  useTheme
} from '@mui/material';
import {
  Add,
  MoreVert,
  DragIndicator,
  Edit,
  Delete,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { getBoard, getTasks, updateTask } from '../services/taskService';
import { updateColumn, updateSwimlane } from '../services/boardService';
import { useNotification } from '../contexts/NotificationContext';
import TaskCard from '../components/TaskCard';
import TaskDialog from '../components/TaskDialog';
import ColumnDialog from '../components/ColumnDialog';
import SwimlaneDialog from '../components/SwimlaneDialog';

const Board = () => {
  const { id } = useParams();
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  
  const [board, setBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [swimlaneDialogOpen, setSwimlaneDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [swimlaneMenuAnchor, setSwimlaneMenuAnchor] = useState(null);
  const [selectedColumnForMenu, setSelectedColumnForMenu] = useState(null);
  const [selectedSwimlaneForMenu, setSelectedSwimlaneForMenu] = useState(null);

  useEffect(() => {
    const fetchBoardData = async () => {
      try {
        const boardResponse = await getBoard(id);
        setBoard(boardResponse.data);
        
        const tasksResponse = await getTasks({ boardId: id });
        setTasks(tasksResponse.data);
        
        setLoading(false);
      } catch (error) {
        showError('Failed to load board data');
        setLoading(false);
      }
    };

    fetchBoardData();
  }, [id, showError]);

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    if (type === 'column') {
      // Reordering columns
      const newColumns = Array.from(board.columns);
      const [movedColumn] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, movedColumn);

      // Update positions in the database
      const updatePromises = newColumns.map((column, index) => {
        return updateColumn(board.id, column.id, { position: index });
      });

      try {
        await Promise.all(updatePromises);
        setBoard({ ...board, columns: newColumns });
        showSuccess('Columns reordered successfully');
      } catch (error) {
        showError('Failed to reorder columns');
      }
      return;
    }

    // Moving tasks between columns or swimlanes
    const [columnId, swimlaneId] = destination.droppableId.split('-');
    const [sourceColumnId, sourceSwimlaneId] = source.droppableId.split('-');

    // Find the task
    const task = tasks.find(t => t.id === draggableId);
    if (!task) return;

    // Update the task
    const updatedTask = {
      ...task,
      column_id: parseInt(columnId),
      swimlane_id: swimlaneId === 'null' ? null : parseInt(swimlaneId),
      position: destination.index
    };

    try {
      await updateTask(task.id, updatedTask);
      
      // Update local state
      const newTasks = Array.from(tasks);
      const taskIndex = newTasks.findIndex(t => t.id === draggableId);
      newTasks[taskIndex] = updatedTask;
      
      // Reorder tasks in the destination column/swimlane
      const destinationTasks = newTasks.filter(t => 
        t.column_id === parseInt(columnId) && 
        (swimlaneId === 'null' ? t.swimlane_id === null : t.swimlane_id === parseInt(swimlaneId))
      );
      
      destinationTasks.sort((a, b) => a.position - b.position);
      
      // Update positions
      destinationTasks.forEach((t, index) => {
        if (t.id === draggableId) {
          t.position = destination.index;
        } else if (t.position >= destination.index) {
          t.position += 1;
        }
      });
      
      setTasks(newTasks);
      showSuccess('Task moved successfully');
    } catch (error) {
      showError('Failed to move task');
    }
  };

  const handleAddTask = (columnId, swimlaneId = null) => {
    setSelectedTask({
      title: '',
      description: '',
      column_id: columnId,
      swimlane_id: swimlaneId,
      priority: 'medium',
      tags: [],
      subtasks: []
    });
    setTaskDialogOpen(true);
  };

  const handleEditTask = (task) => {
    setSelectedTask(task);
    setTaskDialogOpen(true);
  };

  const handleSaveTask = async (task) => {
    try {
      if (task.id) {
        await updateTask(task.id, task);
        showSuccess('Task updated successfully');
      } else {
        // Create new task
        const response = await createTask(task);
        showSuccess('Task created successfully');
      }
      
      // Refresh tasks
      const tasksResponse = await getTasks({ boardId: id });
      setTasks(tasksResponse.data);
      
      setTaskDialogOpen(false);
      setSelectedTask(null);
    } catch (error) {
      showError('Failed to save task');
    }
  };

  const handleAddColumn = () => {
    setSelectedColumn({
      name: '',
      color: '#3498db',
      icon: '',
      position: board.columns.length
    });
    setColumnDialogOpen(true);
  };

  const handleEditColumn = (column) => {
    setSelectedColumn(column);
    setColumnDialogOpen(true);
  };

  const handleSaveColumn = async (column) => {
    try {
      if (column.id) {
        await updateColumn(board.id, column.id, column);
        showSuccess('Column updated successfully');
      } else {
        // Create new column
        const response = await createColumn(board.id, column);
        showSuccess('Column created successfully');
      }
      
      // Refresh board
      const boardResponse = await getBoard(id);
      setBoard(boardResponse.data);
      
      setColumnDialogOpen(false);
      setSelectedColumn(null);
    } catch (error) {
      showError('Failed to save column');
    }
  };

  const handleAddSwimlane = () => {
    setSelectedSwimlane({
      name: '',
      color: '#ecf0f1',
      position: board.swimlanes.length,
      collapsed: false
    });
    setSwimlaneDialogOpen(true);
  };

  const handleEditSwimlane = (swimlane) => {
    setSelectedSwimlane(swimlane);
    setSwimlaneDialogOpen(true);
  };

  const handleSaveSwimlane = async (swimlane) => {
    try {
      if (swimlane.id) {
        await updateSwimlane(board.id, swimlane.id, swimlane);
        showSuccess('Swimlane updated successfully');
      } else {
        // Create new swimlane
        const response = await createSwimlane(board.id, swimlane);
        showSuccess('Swimlane created successfully');
      }
      
      // Refresh board
      const boardResponse = await getBoard(id);
      setBoard(boardResponse.data);
      
      setSwimlaneDialogOpen(false);
      setSelectedSwimlane(null);
    } catch (error) {
      showError('Failed to save swimlane');
    }
  };

  const handleColumnMenuClick = (event, column) => {
    setColumnMenuAnchor(event.currentTarget);
    setSelectedColumnForMenu(column);
  };

  const handleColumnMenuClose = () => {
    setColumnMenuAnchor(null);
    setSelectedColumnForMenu(null);
  };

  const handleSwimlaneMenuClick = (event, swimlane) => {
    setSwimlaneMenuAnchor(event.currentTarget);
    setSelectedSwimlaneForMenu(swimlane);
  };

  const handleSwimlaneMenuClose = () => {
    setSwimlaneMenuAnchor(null);
    setSelectedSwimlaneForMenu(null);
  };

  const toggleSwimlaneCollapse = async (swimlane) => {
    try {
      await updateSwimlane(board.id, swimlane.id, { collapsed: !swimlane.collapsed });
      
      // Refresh board
      const boardResponse = await getBoard(id);
      setBoard(boardResponse.data);
      
      showSuccess(`Swimlane ${swimlane.collapsed ? 'expanded' : 'collapsed'} successfully`);
    } catch (error) {
      showError('Failed to toggle swimlane');
    }
  };

  if (loading) {
    return <Typography>Loading board...</Typography>;
  }

  if (!board) {
    return <Typography>Board not found</Typography>;
  }

  // Group tasks by column and swimlane
  const tasksByColumnAndSwimlane = {};
  
  board.columns.forEach(column => {
    tasksByColumnAndSwimlane[column.id] = {};
    
    // Initialize with null swimlane (tasks without swimlane)
    tasksByColumnAndSwimlane[column.id]['null'] = [];
    
    // Initialize with all swimlanes
    board.swimlanes.forEach(swimlane => {
      tasksByColumnAndSwimlane[column.id][swimlane.id] = [];
    });
  });
  
  // Populate tasks
  tasks.forEach(task => {
    const columnId = task.column_id;
    const swimlaneId = task.swimlane_id || 'null';
    
    if (tasksByColumnAndSwimlane[columnId] && tasksByColumnAndSwimlane[columnId][swimlaneId]) {
      tasksByColumnAndSwimlane[columnId][swimlaneId].push(task);
    }
  });
  
  // Sort tasks by position
  Object.keys(tasksByColumnAndSwimlane).forEach(columnId => {
    Object.keys(tasksByColumnAndSwimlane[columnId]).forEach(swimlaneId => {
      tasksByColumnAndSwimlane[columnId][swimlaneId].sort((a, b) => a.position - b.position);
    });
  });

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">{board.name}</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={handleAddSwimlane}
            sx={{ mr: 1 }}
          >
            Add Swimlane
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAddColumn}
          >
            Add Column
          </Button>
        </Box>
      </Box>
      
      {board.description && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {board.description}
          </ReactMarkdown>
        </Paper>
      )}
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="columns" direction="horizontal" type="column">
          {(provided) => (
            <Box
              {...provided.droppableProps}
              ref={provided.innerRef}
              sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}
            >
              {board.columns.map((column, columnIndex) => (
                <Draggable key={column.id} draggableId={column.id} index={columnIndex}>
                  {(provided, snapshot) => (
                    <Paper
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      sx={{
                        minWidth: 300,
                        maxWidth: 300,
                        backgroundColor: column.color + '20',
                        borderLeft: `4px solid ${column.color}`,
                        opacity: snapshot.isDragging ? 0.8 : 1
                      }}
                    >
                      <Box
                        {...provided.dragHandleProps}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          p: 1,
                          borderBottom: '1px solid #eee'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <DragIndicator sx={{ mr: 1, color: '#999' }} />
                          <Typography variant="h6">{column.name}</Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => handleColumnMenuClick(e, column)}
                        >
                          <MoreVert />
                        </IconButton>
                      </Box>
                      
                      <Box sx={{ p: 1 }}>
                        <Button
                          fullWidth
                          variant="outlined"
                          startIcon={<Add />}
                          onClick={() => handleAddTask(column.id)}
                          sx={{ mb: 1 }}
                        >
                          Add Task
                        </Button>
                      </Box>
                      
                      {board.swimlanes.length > 0 ? (
                        // Render swimlanes
                        board.swimlanes.map(swimlane => (
                          <Box
                            key={swimlane.id}
                            sx={{
                              p: 1,
                              borderTop: '1px solid #eee',
                              backgroundColor: swimlane.collapsed ? '#f5f5f5' : 'transparent'
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 1
                              }}
                            >
                              <Typography variant="subtitle2">{swimlane.name}</Typography>
                              <Box>
                                <IconButton
                                  size="small"
                                  onClick={() => toggleSwimlaneCollapse(swimlane)}
                                >
                                  {swimlane.collapsed ? <Visibility /> : <VisibilityOff />}
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleSwimlaneMenuClick(e, swimlane)}
                                >
                                  <MoreVert />
                                </IconButton>
                              </Box>
                            </Box>
                            
                            {!swimlane.collapsed && (
                              <Droppable
                                droppableId={`${column.id}-${swimlane.id}`}
                                type="task"
                              >
                                {(provided, snapshot) => (
                                  <Box
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    sx={{
                                      minHeight: 100,
                                      backgroundColor: snapshot.isDraggingOver ? '#f0f0f0' : 'transparent',
                                      borderRadius: 1,
                                      p: 1
                                    }}
                                  >
                                    {tasksByColumnAndSwimlane[column.id][swimlane.id].map((task, index) => (
                                      <TaskCard
                                        key={task.id}
                                        task={task}
                                        index={index}
                                        onEdit={handleEditTask}
                                      />
                                    ))}
                                    {provided.placeholder}
                                  </Box>
                                )}
                              </Droppable>
                            )}
                          </Box>
                        ))
                      ) : (
                        // Render tasks without swimlanes
                        <Droppable droppableId={`${column.id}-null`} type="task">
                          {(provided, snapshot) => (
                            <Box
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              sx={{
                                minHeight: 200,
                                backgroundColor: snapshot.isDraggingOver ? '#f0f0f0' : 'transparent',
                                borderRadius: 1,
                                p: 1
                              }}
                            >
                              {tasksByColumnAndSwimlane[column.id]['null'].map((task, index) => (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  index={index}
                                  onEdit={handleEditTask}
                                />
                              ))}
                              {provided.placeholder}
                            </Box>
                          )}
                        </Droppable>
                      )}
                    </Paper>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </Box>
          )}
        </Droppable>
      </DragDropContext>
      
      {/* Task Dialog */}
      <TaskDialog
        open={taskDialogOpen}
        task={selectedTask}
        onClose={() => setTaskDialogOpen(false)}
        onSave={handleSaveTask}
      />
      
      {/* Column Dialog */}
      <ColumnDialog
        open={columnDialogOpen}
        column={selectedColumn}
        onClose={() => setColumnDialogOpen(false)}
        onSave={handleSaveColumn}
      />
      
      {/* Swimlane Dialog */}
      <SwimlaneDialog
        open={swimlaneDialogOpen}
        swimlane={selectedSwimlane}
        onClose={() => setSwimlaneDialogOpen(false)}
        onSave={handleSaveSwimlane}
      />
      
      {/* Column Menu */}
      <Menu
        anchorEl={columnMenuAnchor}
        open={Boolean(columnMenuAnchor)}
        onClose={handleColumnMenuClose}
      >
        <MenuItem onClick={() => {
          handleEditColumn(selectedColumnForMenu);
          handleColumnMenuClose();
        }}>
          <Edit sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          // Handle delete column
          handleColumnMenuClose();
        }}>
          <Delete sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
      
      {/* Swimlane Menu */}
      <Menu
        anchorEl={swimlaneMenuAnchor}
        open={Boolean(swimlaneMenuAnchor)}
        onClose={handleSwimlaneMenuClose}
      >
        <MenuItem onClick={() => {
          handleEditSwimlane(selectedSwimlaneForMenu);
          handleSwimlaneMenuClose();
        }}>
          <Edit sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          // Handle delete swimlane
          handleSwimlaneMenuClose();
        }}>
          <Delete sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Board;