import api from './api';

export const createRoutineTask = (routine) => {
  return api.post('/api/routines', routine);
};
