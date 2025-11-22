import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  Chip,
  TextField,
  MenuItem,
  Divider,
  Stack,
  LinearProgress,
  Tooltip,
  Paper,
} from '@mui/material';
import {
  Refresh,
  Bolt,
  Timeline,
  NotificationsActive,
  ViewKanban,
  AutoAwesome,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { formatDistanceToNow, parseISO } from 'date-fns';

import { getBoards, getBoard } from '../services/boardService';
import { getTasks, updateTask } from '../services/taskService';
import { executeAiCommand } from '../services/aiService';
import { getWeeklyReport } from '../services/reportService';
import { createRoutineTask } from '../services/routineService';
import { useNotification } from '../contexts/NotificationContext';
import {
  buildDroppableId,
  parseDroppableId,
  reorderTasksAfterMove,
} from '../utils/boardUtils';

const StatCard = ({ label, value, icon, color = 'primary.main' }) => (
  <Card>
    <CardContent>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${color}15`,
            color,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h5">{value}</Typography>
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const { showError, showSuccess } = useNotification();

  const [boards, setBoards] = useState([]);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [board, setBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiCommand, setAiCommand] = useState('');
  const [aiStatus, setAiStatus] = useState(null);
  const [routineForm, setRoutineForm] = useState({
    title: '',
    description: '',
    columnId: '',
    startAt: '',
    frequency: 'daily',
    interval: 1,
    occurrences: '',
  });

  const loadBoards = async () => {
    try {
      const response = await getBoards();
      setBoards(response.data);

      if (!selectedBoardId && response.data.length > 0) {
        setSelectedBoardId(String(response.data[0].id));
      }
    } catch (error) {
      showError('Failed to load boards');
    }
  };

  const loadWeeklyReport = async () => {
    try {
      const response = await getWeeklyReport();
      setWeeklyReport(response.data);
    } catch (error) {
      showError('Unable to load weekly report');
    }
  };

  const loadBoardData = async (boardId, { silent = false } = {}) => {
    if (!boardId) {
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    try {
      const [boardResponse, tasksResponse] = await Promise.all([
        getBoard(boardId),
        getTasks({ boardId }),
      ]);

      setBoard(boardResponse.data);
      setTasks(tasksResponse.data);
    } catch (error) {
      showError('Failed to load board data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoards();
    loadWeeklyReport();
  }, []);

  useEffect(() => {
    if (selectedBoardId) {
      loadBoardData(selectedBoardId);
    }
  }, [selectedBoardId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedBoardId) {
        loadBoardData(selectedBoardId, { silent: true });
        loadWeeklyReport();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedBoardId]);

  const groupedByColumn = useMemo(() => {
    const columns = board?.columns || [];
    const grouped = {};

    columns.forEach(column => {
      grouped[column.id] = tasks
        .filter(task => task.column_id === column.id)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    });

    return grouped;
  }, [board, tasks]);

  const upcomingTasks = useMemo(() => {
    const now = new Date();
    const soon = new Date(now.getTime() + 1000 * 60 * 60 * 48);

    return tasks
      .filter(task => task.due_date)
      .filter(task => {
        const due = parseISO(task.due_date);
        return due >= now && due <= soon;
      })
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 6);
  }, [tasks]);

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const reordered = reorderTasksAfterMove(
      tasks,
      draggableId,
      source.droppableId,
      destination.droppableId,
      destination.index
    );

    setTasks(reordered);

    const parsedDestination = parseDroppableId(destination.droppableId);

    if (!parsedDestination) {
      return;
    }

    try {
      await updateTask(draggableId, {
        column_id: parsedDestination.columnId,
        position: destination.index,
        swimlane_id: parsedDestination.swimlaneId,
      });
    } catch (error) {
      showError('Failed to move task');
      loadBoardData(selectedBoardId, { silent: true });
    }
  };

  const handleAiSubmit = async (event) => {
    event.preventDefault();

    if (!aiCommand.trim()) {
      return;
    }

    setAiStatus('working');

    try {
      const response = await executeAiCommand(aiCommand.trim());
      setAiStatus(response.data.message || 'Command executed successfully');
      showSuccess(response.data.message || 'AI command executed');
      setAiCommand('');
      await loadBoardData(selectedBoardId, { silent: true });
      await loadWeeklyReport();
    } catch (error) {
      const message = error?.response?.data?.error || 'AI command failed';
      setAiStatus(message);
      showError(message);
    }
  };

  const handleRoutineSubmit = async (event) => {
    event.preventDefault();

    if (!routineForm.title || !routineForm.columnId || !routineForm.startAt) {
      showError('Title, column, and start date are required');
      return;
    }

    try {
      await createRoutineTask({
        title: routineForm.title,
        description: routineForm.description,
        columnId: Number(routineForm.columnId),
        startAt: routineForm.startAt,
        frequency: routineForm.frequency,
        interval: Number(routineForm.interval) || 1,
        occurrences: routineForm.occurrences ? Number(routineForm.occurrences) : undefined,
      });

      showSuccess('Routine task created');
      setRoutineForm({
        title: '',
        description: '',
        columnId: '',
        startAt: '',
        frequency: 'daily',
        interval: 1,
        occurrences: '',
      });
      await loadBoardData(selectedBoardId, { silent: true });
      await loadWeeklyReport();
    } catch (error) {
      const message = error?.response?.data?.error || 'Failed to create routine';
      showError(message);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Loading dashboard...
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Command Center
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Control your Kanban, routines, AI commands, and reporting from one place.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField
            select
            size="small"
            label="Board"
            value={selectedBoardId}
            onChange={(e) => setSelectedBoardId(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            {boards.map(boardItem => (
              <MenuItem key={boardItem.id} value={String(boardItem.id)}>
                {boardItem.name}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => {
              loadBoardData(selectedBoardId);
              loadWeeklyReport();
            }}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={3}>
          <StatCard
            label="Created (7d)"
            value={weeklyReport?.created ?? 0}
            icon={<Bolt />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard
            label="Completed (7d)"
            value={weeklyReport?.completed ?? 0}
            icon={<Timeline />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard
            label="Overdue"
            value={weeklyReport?.overdue ?? 0}
            icon={<NotificationsActive />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard
            label="Columns"
            value={board?.columns?.length ?? 0}
            icon={<ViewKanban />}
            color="info.main"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              title="Interactive Kanban"
              subheader="Drag tasks to update their status in real time"
              action={<Chip label="Live" color="success" size="small" />}
            />
            <CardContent>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Grid container spacing={2}>
                  {board?.columns?.map(column => (
                    <Grid item xs={12} md={4} key={column.id}>
                      <Paper elevation={1} sx={{ p: 1, height: '100%', backgroundColor: '#fafafa' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                          <Typography variant="subtitle1">{column.name}</Typography>
                          <Chip label={`${groupedByColumn[column.id]?.length || 0} tasks`} size="small" />
                        </Stack>
                        <Droppable droppableId={buildDroppableId(column.id)}>
                          {(provided) => (
                            <Box
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              sx={{
                                minHeight: 200,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                              }}
                            >
                              {groupedByColumn[column.id]?.map((task, index) => (
                                <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                                  {(dragProvided) => (
                                    <Card
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      {...dragProvided.dragHandleProps}
                                      sx={{ p: 1 }}
                                    >
                                      <Stack spacing={0.5}>
                                        <Typography variant="subtitle1">{task.title}</Typography>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                          <Chip
                                            label={task.priority || 'medium'}
                                            size="small"
                                            color="default"
                                            variant="outlined"
                                          />
                                          {task.due_date && (
                                            <Tooltip title={`Due ${formatDistanceToNow(parseISO(task.due_date), { addSuffix: true })}`}>
                                              <Chip label={formatDistanceToNow(parseISO(task.due_date), { addSuffix: true })} size="small" />
                                            </Tooltip>
                                          )}
                                        </Stack>
                                      </Stack>
                                    </Card>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </Box>
                          )}
                        </Droppable>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </DragDropContext>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="AI Command" subheader="Delegate board updates using natural language" />
            <CardContent>
              <form onSubmit={handleAiSubmit}>
                <TextField
                  label="Ask the AI to update your board"
                  multiline
                  minRows={3}
                  fullWidth
                  value={aiCommand}
                  onChange={(e) => setAiCommand(e.target.value)}
                  placeholder="e.g., Create task 'Demo' in To Do"
                />
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button type="submit" variant="contained" startIcon={<AutoAwesome />}>
                    Send Command
                  </Button>
                  {aiStatus && (
                    <Chip
                      label={aiStatus}
                      color={aiStatus === 'working' ? 'info' : 'default'}
                      variant="outlined"
                    />
                  )}
                </Stack>
              </form>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardHeader title="Routine Builder" subheader="Create recurring work with reminders" />
            <CardContent>
              <form onSubmit={handleRoutineSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="Title"
                    value={routineForm.title}
                    onChange={(e) => setRoutineForm(prev => ({ ...prev, title: e.target.value }))}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Description"
                    value={routineForm.description}
                    onChange={(e) => setRoutineForm(prev => ({ ...prev, description: e.target.value }))}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                  <TextField
                    select
                    label="Column"
                    value={routineForm.columnId}
                    onChange={(e) => setRoutineForm(prev => ({ ...prev, columnId: e.target.value }))}
                    required
                  >
                    {board?.columns?.map(column => (
                      <MenuItem key={column.id} value={column.id}>
                        {column.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    type="datetime-local"
                    label="Start"
                    value={routineForm.startAt}
                    onChange={(e) => setRoutineForm(prev => ({ ...prev, startAt: e.target.value }))}
                    required
                    InputLabelProps={{ shrink: true }}
                  />
                  <Stack direction="row" spacing={2}>
                    <TextField
                      select
                      label="Frequency"
                      value={routineForm.frequency}
                      onChange={(e) => setRoutineForm(prev => ({ ...prev, frequency: e.target.value }))}
                      sx={{ flex: 1 }}
                    >
                      <MenuItem value="daily">Daily</MenuItem>
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                      <MenuItem value="yearly">Yearly</MenuItem>
                    </TextField>
                    <TextField
                      label="Interval"
                      type="number"
                      value={routineForm.interval}
                      onChange={(e) => setRoutineForm(prev => ({ ...prev, interval: e.target.value }))}
                      sx={{ width: 120 }}
                      inputProps={{ min: 1 }}
                    />
                  </Stack>
                  <TextField
                    label="Occurrences (optional)"
                    type="number"
                    value={routineForm.occurrences}
                    onChange={(e) => setRoutineForm(prev => ({ ...prev, occurrences: e.target.value }))}
                    inputProps={{ min: 1 }}
                  />
                  <Button type="submit" variant="contained">
                    Schedule Routine
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader title="Upcoming & Due Soon" />
            <CardContent>
              {upcomingTasks.length === 0 && (
                <Typography color="text.secondary">No upcoming tasks in the next 48 hours.</Typography>
              )}
              <Stack spacing={1}>
                {upcomingTasks.map(task => (
                  <Paper key={task.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="subtitle1">{task.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {task.column_name || 'Unassigned column'} · {task.priority || 'medium'}
                        </Typography>
                      </Box>
                      <Chip
                        color="warning"
                        label={`Due ${formatDistanceToNow(parseISO(task.due_date), { addSuffix: true })}`}
                      />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Weekly Breakdown" />
            <CardContent>
              {weeklyReport?.byColumn?.length ? (
                <Stack spacing={1}>
                  {weeklyReport.byColumn.map(column => (
                    <Box key={column.column}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography>{column.column}</Typography>
                        <Typography fontWeight={600}>{column.count}</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, (column.count / Math.max(1, weeklyReport.created)) * 100)}
                        sx={{ height: 8, borderRadius: 4, mt: 0.5 }}
                      />
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography color="text.secondary">No activity to report yet.</Typography>
              )}
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Reports and reminders are also dispatched to n8n so your automations stay in sync.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
