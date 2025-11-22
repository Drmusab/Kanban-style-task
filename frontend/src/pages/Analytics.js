import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { getTasks } from '../services/taskService';
import { getBoards } from '../services/boardService';
import { useNotification } from '../contexts/NotificationContext';

const Analytics = () => {
  const { showError } = useNotification();
  
  const [tasks, setTasks] = useState([]);
  const [boards, setBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState('');
  const [timeRange, setTimeRange] = useState('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksResponse, boardsResponse] = await Promise.all([
          getTasks(),
          getBoards()
        ]);
        
        setTasks(tasksResponse.data);
        setBoards(boardsResponse.data);
        setLoading(false);
      } catch (error) {
        showError('فشل تحميل بيانات التحليلات');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [showError]);

  const filteredTasks = selectedBoard 
    ? tasks.filter(task => {
        // In a real app, you would filter by board ID
        return true;
      })
    : tasks;

  // Task completion by column
  const tasksByColumn = [];
  const columns = [...new Set(filteredTasks.map(task => task.column_name))];
  
  columns.forEach(column => {
    const columnTasks = filteredTasks.filter(task => task.column_name === column);
    tasksByColumn.push({
      name: column,
      total: columnTasks.length,
      completed: columnTasks.filter(task => task.column_name === 'Done').length
    });
  });

  // Task distribution by priority
  const tasksByPriority = [];
  const priorities = ['critical', 'high', 'medium', 'low'];
  
  priorities.forEach(priority => {
    const priorityTasks = filteredTasks.filter(task => task.priority === priority);
    tasksByPriority.push({
      name: priority.charAt(0).toUpperCase() + priority.slice(1),
      value: priorityTasks.length
    });
  });

  // Task completion over time (mock data for now)
  const completionOverTime = [
    { date: 'Mon', completed: 4, created: 6 },
    { date: 'Tue', completed: 3, created: 5 },
    { date: 'Wed', completed: 5, created: 8 },
    { date: 'Thu', completed: 7, created: 4 },
    { date: 'Fri', completed: 6, created: 7 },
    { date: 'Sat', completed: 2, created: 3 },
    { date: 'Sun', completed: 1, created: 2 }
  ];

  // Overdue tasks
  const now = new Date();
  const overdueTasks = filteredTasks.filter(task => 
    task.due_date && new Date(task.due_date) < now && task.column_name !== 'Done'
  );

  // Average time in columns (mock data for now)
  const avgTimeInColumns = [
    { name: 'To Do', days: 2.5 },
    { name: 'In Progress', days: 4.2 },
    { name: 'Review', days: 1.8 },
    { name: 'Done', days: 0 }
  ];

  const COLORS = ['#e74c3c', '#e67e22', '#f39c12', '#2ecc71'];

  if (loading) {
    return <Typography>جاري تحميل بيانات التحليلات...</Typography>;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        التحليلات
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>اللوحة</InputLabel>
          <Select
            value={selectedBoard}
            onChange={(e) => setSelectedBoard(e.target.value)}
            label="اللوحة"
          >
            <MenuItem value="">جميع اللوحات</MenuItem>
            {boards.map(board => (
              <MenuItem key={board.id} value={board.id}>
                {board.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>النطاق الزمني</InputLabel>
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            label="النطاق الزمني"
          >
            <MenuItem value="day">اليوم</MenuItem>
            <MenuItem value="week">هذا الأسبوع</MenuItem>
            <MenuItem value="month">هذا الشهر</MenuItem>
            <MenuItem value="year">هذه السنة</MenuItem>
          </Select>
        </FormControl>

        <Button variant="outlined">تصدير التقرير</Button>
      </Box>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                المهام حسب العمود
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tasksByColumn}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#3498db" name="الإجمالي" />
                  <Bar dataKey="completed" fill="#2ecc71" name="المكتملة" />
              </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                توزيع المهام حسب الأولوية
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={tasksByPriority}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {tasksByPriority.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                نشاط المهام عبر الزمن
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={completionOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="completed" stroke="#2ecc71" name="المكتملة" />
                  <Line type="monotone" dataKey="created" stroke="#3498db" name="المضافة" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                متوسط الوقت في الأعمدة (أيام)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={avgTimeInColumns} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" />
                  <Tooltip />
                  <Bar dataKey="days" fill="#9b59b6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                إجمالي المهام
              </Typography>
              <Typography variant="h4">
                {filteredTasks.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                المهام المكتملة
              </Typography>
              <Typography variant="h4">
                {filteredTasks.filter(task => task.column_name === 'Done').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                المهام المتأخرة
              </Typography>
              <Typography variant="h4" color="error">
                {overdueTasks.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                نسبة الإكمال
              </Typography>
              <Typography variant="h4">
                {filteredTasks.length > 0 
                  ? `${Math.round((filteredTasks.filter(task => task.column_name === 'Done').length / filteredTasks.length) * 100)}%`
                  : '0%'
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Analytics;