import api from './api';

export const getWeeklyReport = () => api.get('/api/reports/weekly');

export const dispatchWeeklyReport = (includeBreakdown = false) =>
  api.post('/api/reports/weekly/dispatch', { includeBreakdown });
