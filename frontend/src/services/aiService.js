import api from './api';

export const executeAiCommand = (command) => {
  return api.post('/api/ai/command', { command });
};

export const fetchAiPatterns = () => {
  return api.get('/api/ai/patterns');
};
