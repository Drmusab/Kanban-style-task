import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Typography,
  Switch,
  FormControlLabel,
  Divider,
  Grid,
  Paper
} from '@mui/material';
import {
  Add,
  Delete,
  CalendarToday,
  Flag,
  Person,
  Close
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const TaskDialog = ({ open, task, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    column_id: '',
    swimlane_id: null,
    priority: 'medium',
    due_date: null,
    recurring_rule: null,
    pinned: false,
    assigned_to: null,
    tags: [],
    subtasks: []
  });
  const [newSubtask, setNewSubtask] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [availableSwimlanes, setAvailableSwimlanes] = useState([]);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        ...task,
        due_date: task.due_date ? new Date(task.due_date) : null,
        recurring_rule: task.recurring_rule ? JSON.parse(task.recurring_rule) : null
      });
    } else {
      setFormData({
        title: '',
        description: '',
        column_id: '',
        swimlane_id: null,
        priority: 'medium',
        due_date: null,
        recurring_rule: null,
        pinned: false,
        assigned_to: null,
        tags: [],
        subtasks: []
      });
    }
    setNewSubtask('');
    setShowMarkdownPreview(false);
  }, [task, open]);

  useEffect(() => {
    // Fetch available data
    const fetchAvailableData = async () => {
      try {
        // In a real app, you would fetch these from the API
        // For now, we'll use mock data
        setAvailableTags([
          { id: 1, name: 'Bug', color: '#e74c3c' },
          { id: 2, name: 'Feature', color: '#2ecc71' },
          { id: 3, name: 'Enhancement', color: '#3498db' },
          { id: 4, name: 'Urgent', color: '#e67e22' }
        ]);
        
        setAvailableUsers([
          { id: 1, username: 'user1' },
          { id: 2, username: 'user2' }
        ]);
        
        setAvailableColumns([
          { id: 1, name: 'To Do' },
          { id: 2, name: 'In Progress' },
          { id: 3, name: 'Review' },
          { id: 4, name: 'Done' }
        ]);
        
        setAvailableSwimlanes([
          { id: 1, name: 'High Priority' },
          { id: 2, name: 'Medium Priority' },
          { id: 3, name: 'Low Priority' }
        ]);
      } catch (error) {
        console.error('Error fetching available data:', error);
      }
    };
    
    if (open) {
      fetchAvailableData();
    }
  }, [open]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({
      ...prev,
      due_date: date
    }));
  };

  const handleAddSubtask = () => {
    if (newSubtask.trim()) {
      setFormData(prev => ({
        ...prev,
        subtasks: [
          ...prev.subtasks,
          {
            id: Date.now(),
            title: newSubtask,
            completed: false,
            position: prev.subtasks.length
          }
        ]
      }));
      setNewSubtask('');
    }
  };

  const handleDeleteSubtask = (index) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter((_, i) => i !== index)
    }));
  };

  const handleToggleSubtask = (index) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.map((subtask, i) =>
        i === index ? { ...subtask, completed: !subtask.completed } : subtask
      )
    }));
  };

  const handleAddTag = (tag) => {
    if (!formData.tags.find(t => t.id === tag.id)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
  };

  const handleDeleteTag = (tagId) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t.id !== tagId)
    }));
  };

  const handleRecurringRuleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      recurring_rule: {
        ...prev.recurring_rule,
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    const dataToSave = {
      ...formData,
      due_date: formData.due_date ? formData.due_date.toISOString() : null,
      recurring_rule: formData.recurring_rule ? JSON.stringify(formData.recurring_rule) : null
    };
    onSave(dataToSave);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {task?.id ? 'Edit Task' : 'Create New Task'}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              name="title"
              label="Title"
              value={formData.title}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1">Description</Typography>
              <Button
                size="small"
                onClick={() => setShowMarkdownPreview(!showMarkdownPreview)}
              >
                {showMarkdownPreview ? 'Edit' : 'Preview'}
              </Button>
            </Box>
            {showMarkdownPreview ? (
              <Paper sx={{ p: 2, minHeight: 100, backgroundColor: '#f9f9f9' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {formData.description || '*No description*'}
                </ReactMarkdown>
              </Paper>
            ) : (
              <TextField
                name="description"
                label="Description (Markdown supported)"
                value={formData.description}
                onChange={handleChange}
                fullWidth
                multiline
                rows={4}
                helperText="You can use Markdown for formatting (bold, italic, lists, links, etc.)"
              />
            )}
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Column</InputLabel>
              <Select
                name="column_id"
                value={formData.column_id}
                onChange={handleChange}
                label="Column"
              >
                {availableColumns.map(column => (
                  <MenuItem key={column.id} value={column.id}>
                    {column.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Swimlane</InputLabel>
              <Select
                name="swimlane_id"
                value={formData.swimlane_id || ''}
                onChange={handleChange}
                label="Swimlane"
              >
                <MenuItem value="">None</MenuItem>
                {availableSwimlanes.map(swimlane => (
                  <MenuItem key={swimlane.id} value={swimlane.id}>
                    {swimlane.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                label="Priority"
              >
                <MenuItem value="critical">Critical</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DateTimePicker
                label="Due Date"
                value={formData.due_date}
                onChange={handleDateChange}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </LocalizationProvider>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Assigned To</InputLabel>
              <Select
                name="assigned_to"
                value={formData.assigned_to || ''}
                onChange={handleChange}
                label="Assigned To"
              >
                <MenuItem value="">Unassigned</MenuItem>
                {availableUsers.map(user => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.username}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  name="pinned"
                  checked={formData.pinned}
                  onChange={handleChange}
                />
              }
              label="Pin to top"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>
              Tags
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {formData.tags.map(tag => (
                <Chip
                  key={tag.id}
                  label={tag.name}
                  onDelete={() => handleDeleteTag(tag.id)}
                  sx={{
                    backgroundColor: tag.color + '20',
                    color: tag.color,
                    border: `1px solid ${tag.color}`
                  }}
                />
              ))}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {availableTags
                .filter(tag => !formData.tags.find(t => t.id === tag.id))
                .map(tag => (
                  <Chip
                    key={tag.id}
                    label={tag.name}
                    onClick={() => handleAddTag(tag)}
                    sx={{
                      backgroundColor: tag.color + '20',
                      color: tag.color,
                      border: `1px dashed ${tag.color}`,
                      cursor: 'pointer'
                    }}
                  />
                ))}
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>
              Subtasks
            </Typography>
            <Box sx={{ display: 'flex', mb: 2 }}>
              <TextField
                label="New Subtask"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddSubtask()}
                fullWidth
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={handleAddSubtask}>
                      <Add />
                    </IconButton>
                  )
                }}
              />
            </Box>
            {formData.subtasks.map((subtask, index) => (
              <Box key={subtask.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <input
                  type="checkbox"
                  checked={subtask.completed}
                  onChange={() => handleToggleSubtask(index)}
                  style={{ marginRight: 8 }}
                />
                <Typography
                  sx={{
                    flexGrow: 1,
                    textDecoration: subtask.completed ? 'line-through' : 'none'
                  }}
                >
                  {subtask.title}
                </Typography>
                <IconButton size="small" onClick={() => handleDeleteSubtask(index)}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>
              Recurring Task
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Frequency</InputLabel>
              <Select
                value={formData.recurring_rule?.frequency || ''}
                onChange={(e) => handleRecurringRuleChange('frequency', e.target.value)}
                label="Frequency"
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="yearly">Yearly</MenuItem>
              </Select>
            </FormControl>
            
            {formData.recurring_rule?.frequency && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Interval"
                    type="number"
                    value={formData.recurring_rule?.interval || 1}
                    onChange={(e) => handleRecurringRuleChange('interval', parseInt(e.target.value) || 1)}
                    fullWidth
                    helperText="Repeat every X days/weeks/months/years"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="End Date"
                    type="date"
                    value={formData.recurring_rule?.endDate || ''}
                    onChange={(e) => handleRecurringRuleChange('endDate', e.target.value)}
                    fullWidth
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>
              </Grid>
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          {task?.id ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TaskDialog;