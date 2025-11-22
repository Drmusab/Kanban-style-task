import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { Add, ChevronLeft, ChevronRight, Event, Refresh } from '@mui/icons-material';
import dayjs from 'dayjs';

import { useNotification } from '../contexts/NotificationContext';
import { getTasks, createTask, updateTask, deleteTask } from '../services/taskService';
import { createRoutine, deleteRoutine, getRoutines, updateRoutine } from '../services/routineService';
import { getBoard, getBoards } from '../services/boardService';
import TaskDialog from '../components/TaskDialog';
import RoutineDialog from '../components/RoutineDialog';

const priorityColors = {
  high: '#e74c3c',
  medium: '#f1c40f',
  low: '#2ecc71',
};

const incrementDate = (date, frequency, interval) => {
  switch (frequency) {
    case 'weekly':
      return date.add(interval, 'week');
    case 'monthly':
      return date.add(interval, 'month');
    case 'yearly':
      return date.add(interval, 'year');
    case 'daily':
    default:
      return date.add(interval, 'day');
  }
};

const buildRoutineOccurrences = (routine, monthStart, monthEnd) => {
  const { recurringRule } = routine;
  if (!recurringRule || recurringRule.status === 'paused') {
    return [];
  }

  const startDate = routine.dueDate ? dayjs(routine.dueDate) : dayjs();
  if (!startDate.isValid()) {
    return [];
  }

  const frequency = recurringRule.frequency || 'daily';
  const interval = recurringRule.interval || 1;
  const maxOccurrences = recurringRule.maxOccurrences;
  const endDate = recurringRule.endDate ? dayjs(recurringRule.endDate).endOf('day') : null;

  let occurrence = startDate.startOf('day');
  let processed = 0;
  const occurrences = [];

  while (occurrence.isBefore(monthStart)) {
    occurrence = incrementDate(occurrence, frequency, interval);
    processed += 1;
    if (maxOccurrences && processed >= maxOccurrences) {
      return [];
    }
    if (endDate && occurrence.isAfter(endDate)) {
      return [];
    }
  }

  while (occurrence.isSame(monthEnd, 'day') || occurrence.isBefore(monthEnd)) {
    if (endDate && occurrence.isAfter(endDate)) {
      break;
    }
    if (maxOccurrences && processed >= maxOccurrences) {
      break;
    }

    occurrences.push(occurrence);
    occurrence = incrementDate(occurrence, frequency, interval);
    processed += 1;
  }

  return occurrences;
};

const Calendar = () => {
  const { showError, showSuccess } = useNotification();
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [tasks, setTasks] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [boards, setBoards] = useState([]);
  const [selectedBoardId, setSelectedBoardId] = useState(null);
  const [boardColumns, setBoardColumns] = useState([]);
  const [boardSwimlanes, setBoardSwimlanes] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [routineDialogOpen, setRoutineDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [loading, setLoading] = useState(true);

  const monthStart = currentMonth.startOf('month');
  const monthEnd = currentMonth.endOf('month');

  const loadBoards = useCallback(async () => {
    try {
      const response = await getBoards();
      setBoards(response.data || []);
      if (!selectedBoardId && response.data?.[0]?.id) {
        setSelectedBoardId(response.data[0].id);
      } else if (!response.data?.length) {
        setLoading(false);
      }
    } catch (error) {
      showError('Unable to load boards');
      setLoading(false);
    }
  }, [selectedBoardId, showError]);

  const loadBoardDetails = useCallback(async (boardId) => {
    if (!boardId) return;
    try {
      const boardResponse = await getBoard(boardId);
      setBoardColumns(boardResponse.data?.columns || []);
      setBoardSwimlanes(boardResponse.data?.swimlanes || []);
    } catch (error) {
      showError('Unable to load board details');
    }
  }, [showError]);

  const loadData = useCallback(async () => {
    if (!selectedBoardId) return;
    try {
      setLoading(true);
      const [taskResponse, routineResponse] = await Promise.all([
        getTasks({ boardId: selectedBoardId }),
        getRoutines(),
      ]);
      setTasks(taskResponse.data || []);
      setRoutines(routineResponse.data || []);
    } catch (error) {
      showError('Unable to load calendar data');
    } finally {
      setLoading(false);
    }
  }, [selectedBoardId, showError]);

  const broadcastTasksChange = () => {
    window.dispatchEvent(new Event('tasks:changed'));
  };

  const broadcastRoutinesChange = () => {
    window.dispatchEvent(new Event('routines:changed'));
  };

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    loadBoardDetails(selectedBoardId);
  }, [selectedBoardId, loadBoardDetails]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleExternalUpdate = () => loadData();
    window.addEventListener('tasks:changed', handleExternalUpdate);
    window.addEventListener('routines:changed', handleExternalUpdate);
    return () => {
      window.removeEventListener('tasks:changed', handleExternalUpdate);
      window.removeEventListener('routines:changed', handleExternalUpdate);
    };
  }, [loadData]);

  const handleMonthChange = (direction) => {
    setCurrentMonth(prev => prev.add(direction, 'month'));
  };

  const handleSaveTask = async (taskPayload) => {
    const normalizedTask = {
      ...taskPayload,
      column_id: taskPayload.column_id || boardColumns[0]?.id || taskPayload.columnId,
    };

    if (!normalizedTask.column_id) {
      showError('Please select a column for the task');
      return;
    }

    try {
      if (normalizedTask.id) {
        await updateTask(normalizedTask.id, normalizedTask);
        showSuccess('Task updated');
      } else {
        await createTask(normalizedTask);
        showSuccess('Task created');
      }
      setTaskDialogOpen(false);
      setEditingTask(null);
      setSelectedItem(null);
      broadcastTasksChange();
      loadData();
    } catch (error) {
      showError('Unable to save task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(taskId);
      showSuccess('Task deleted');
      setSelectedItem(null);
      broadcastTasksChange();
      loadData();
    } catch (error) {
      showError('Unable to delete task');
    }
  };

  const handleSaveRoutine = async (payload) => {
    try {
      if (payload.id) {
        await updateRoutine(payload.id, payload);
        showSuccess('Routine updated');
      } else {
        await createRoutine(payload);
        showSuccess('Routine created');
      }
      setRoutineDialogOpen(false);
      setEditingRoutine(null);
      setSelectedItem(null);
      broadcastRoutinesChange();
      loadData();
    } catch (error) {
      showError('Unable to save routine');
    }
  };

  const handleDeleteRoutine = async (id) => {
    try {
      await deleteRoutine(id);
      showSuccess('Routine deleted');
      setSelectedItem(null);
      broadcastRoutinesChange();
      loadData();
    } catch (error) {
      showError('Unable to delete routine');
    }
  };

  const calendarDays = useMemo(() => {
    const start = monthStart.startOf('week');
    const end = monthEnd.endOf('week');
    const days = [];
    let current = start;

    while (current.isBefore(end) || current.isSame(end, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }

    return days;
  }, [monthStart, monthEnd]);

  const tasksByDate = useMemo(() => {
    return tasks
      .filter(task => task.due_date)
      .reduce((acc, task) => {
        const dateKey = dayjs(task.due_date).format('YYYY-MM-DD');
        acc[dateKey] = acc[dateKey] ? [...acc[dateKey], task] : [task];
        return acc;
      }, {});
  }, [tasks]);

  const routineOccurrences = useMemo(() => {
    const occurrences = [];
    routines.forEach(routine => {
      const dates = buildRoutineOccurrences(routine, monthStart, monthEnd);
      dates.forEach(date => {
        occurrences.push({ date: date.format('YYYY-MM-DD'), routine });
      });
    });
    return occurrences;
  }, [routines, monthStart, monthEnd]);

  const routinesByDate = useMemo(() => {
    return routineOccurrences.reduce((acc, occurrence) => {
      acc[occurrence.date] = acc[occurrence.date]
        ? [...acc[occurrence.date], occurrence.routine]
        : [occurrence.routine];
      return acc;
    }, {});
  }, [routineOccurrences]);

  const renderDayCell = (day) => {
    const dateKey = day.format('YYYY-MM-DD');
    const dayTasks = tasksByDate[dateKey] || [];
    const dayRoutines = routinesByDate[dateKey] || [];
    const isCurrentMonth = day.month() === currentMonth.month();

    return (
      <Grid item xs={1} sm={1} md={1} lg={1} xl={1} key={dateKey}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <Box sx={{ p: 1.5, opacity: isCurrentMonth ? 1 : 0.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" fontWeight={600}>
                {day.format('D')}
              </Typography>
              <Button
                size="small"
                startIcon={<Add />}
                onClick={() => {
                  setEditingTask({
                    column_id: boardColumns[0]?.id || '',
                    swimlane_id: null,
                    priority: 'medium',
                    tags: [],
                    subtasks: [],
                    due_date: day.toDate(),
                  });
                  setTaskDialogOpen(true);
                }}
              >
                Task
              </Button>
            </Stack>

            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {dayTasks.map(task => (
                <Box
                  key={task.id}
                  onClick={() => setSelectedItem({ type: 'task', data: task })}
                  sx={{
                    cursor: 'pointer',
                    backgroundColor: priorityColors[task.priority] || '#95a5a6',
                    color: '#fff',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1.5,
                    fontSize: '0.875rem',
                  }}
                >
                  {task.title}
                </Box>
              ))}

              {dayRoutines.map(routine => (
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  key={`${routine.id}-${dateKey}`}
                  onClick={() => setSelectedItem({ type: 'routine', data: routine })}
                  sx={{ cursor: 'pointer' }}
                >
                  <Avatar sx={{ width: 22, height: 22, bgcolor: '#8e44ad' }}>
                    <Event fontSize="inherit" />
                  </Avatar>
                  <Typography variant="body2" sx={{ color: '#8e44ad' }}>
                    {routine.title}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Card>
      </Grid>
    );
  };

  const renderQuickView = () => {
    if (!selectedItem) return null;

    const { type, data } = selectedItem;
    const isTask = type === 'task';
    const dateValue = isTask ? data.due_date : data.dueDate;

    return (
      <Dialog open onClose={() => setSelectedItem(null)} fullWidth maxWidth="sm">
        <DialogTitle>{isTask ? 'Task' : 'Routine'} details</DialogTitle>
        <DialogContent dividers>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {data.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {data.description || 'No description provided'}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Event fontSize="small" />
            <Typography variant="body2">
              {dateValue ? dayjs(dateValue).format('MMM D, YYYY h:mm A') : 'No date set'}
            </Typography>
          </Stack>
          {isTask && (
            <Typography variant="body2">Priority: {data.priority || 'medium'}</Typography>
          )}
          {!isTask && (
            <Typography variant="body2">
              Frequency: {data.recurringRule?.frequency || 'daily'} every {data.recurringRule?.interval || 1} time(s)
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedItem(null)}>Close</Button>
          <Button
            onClick={() => {
              if (isTask) {
                setEditingTask(data);
                setTaskDialogOpen(true);
              } else {
                setEditingRoutine(data);
                setRoutineDialogOpen(true);
              }
              setSelectedItem(null);
            }}
          >
            Edit
          </Button>
          <Button
            color="error"
            onClick={() => {
              if (isTask) {
                handleDeleteTask(data.id);
              } else {
                handleDeleteRoutine(data.id);
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" sx={{ mb: 3 }} spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton onClick={() => handleMonthChange(-1)} aria-label="Previous month">
            <ChevronLeft />
          </IconButton>
          <Typography variant="h4">{currentMonth.format('MMMM YYYY')}</Typography>
          <IconButton onClick={() => handleMonthChange(1)} aria-label="Next month">
            <ChevronRight />
          </IconButton>
          <IconButton onClick={() => loadData()} aria-label="Refresh calendar" disabled={loading}>
            <Refresh />
          </IconButton>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="calendar-board-select">Board</InputLabel>
            <Select
              labelId="calendar-board-select"
              label="Board"
              value={selectedBoardId || ''}
              onChange={(event) => setSelectedBoardId(event.target.value)}
            >
              {boards.map(board => (
                <MenuItem key={board.id} value={board.id}>{board.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            startIcon={<Add />}
            variant="contained"
            onClick={() => {
              setEditingTask({
                column_id: boardColumns[0]?.id || '',
                swimlane_id: null,
                priority: 'medium',
                tags: [],
                subtasks: [],
              });
              setTaskDialogOpen(true);
            }}
          >
            New Task
          </Button>
          <Button
            startIcon={<Add />}
            variant="outlined"
            onClick={() => setRoutineDialogOpen(true)}
          >
            New Routine
          </Button>
        </Stack>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Grid container spacing={2} columns={{ xs: 1, sm: 7, md: 7, lg: 7, xl: 7 }}>
        {calendarDays.map(day => renderDayCell(day))}
      </Grid>

      {renderQuickView()}

      <TaskDialog
        open={taskDialogOpen}
        task={editingTask}
        onClose={() => { setTaskDialogOpen(false); setEditingTask(null); }}
        onSave={handleSaveTask}
        availableColumns={boardColumns}
        availableSwimlanes={boardSwimlanes}
        availableTags={[]}
        availableUsers={[]}
      />

      <RoutineDialog
        open={routineDialogOpen}
        onClose={() => { setRoutineDialogOpen(false); setEditingRoutine(null); }}
        onSave={handleSaveRoutine}
        initialValues={editingRoutine}
        columns={boardColumns}
      />
    </Box>
  );
};

export default Calendar;
