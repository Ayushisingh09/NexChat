import { api } from './axios';

export interface SendOtpPayload {
  email?: string;
  phone?: string;
}

export interface VerifyOtpPayload {
  email?: string;
  phone?: string;
  code: string;
}

export interface RegisterPayload {
  email?: string;
  phone?: string;
  password?: string;
  displayName: string;
  username?: string;
  avatar?: string;
}

export interface LoginPayload {
  email?: string;
  phone?: string;
  password?: string;
  code?: string;
}

export const authApi = {
  sendOtp: async (payload: SendOtpPayload) => {
    const res = await api.post('/auth/send-otp', payload);
    return res.data;
  },

  verifyOtp: async (payload: VerifyOtpPayload) => {
    const res = await api.post('/auth/verify-otp', payload);
    return res.data;
  },

  register: async (payload: RegisterPayload) => {
    const res = await api.post('/auth/register', payload);
    return res.data;
  },

  login: async (payload: LoginPayload) => {
    const res = await api.post('/auth/login', payload);
    return res.data;
  },

  logout: async (refreshToken: string) => {
    const res = await api.post('/auth/logout', { refreshToken });
    return res.data;
  },

  forgotPassword: async (email: string) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },

  resetPassword: async (token: string, newPassword: string) => {
    const res = await api.post('/auth/reset-password', { token, newPassword });
    return res.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await api.put('/auth/password', { currentPassword, newPassword });
    return res.data;
  },
};
