import { api } from './axios';

export const reportsApi = {
  submit(data: { reportedId: string; reason: string; description?: string; mediaUrl?: string }) {
    return api.post('/reports', data).then(r => r.data.data);
  },
};
