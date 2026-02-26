// File: trainforge/dashboard/src/services/api.js
// API service for communicating with TrainForge backend

import axios from 'axios';
import { auth } from './firebase';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging and attaching token
api.interceptors.request.use(
  async (config) => {
    // 1. Admin token takes priority (admin login via API)
    const adminToken = localStorage.getItem('tf_admin_token');
    if (adminToken && adminToken !== 'null' && adminToken !== 'undefined') {
      config.headers.Authorization = `Bearer ${adminToken}`;
    } else {
      // 2. Fall back to Firebase ID token
      const user = auth.currentUser;
      if (user) {
        try {
          const token = await user.getIdToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('Error getting Firebase token:', error);
        }
      }
    }

    console.log(`🔍 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export { api };

export const trainForgeAPI = {
  // Health check
  async checkHealth() {
    const response = await api.get('/health');
    return response.data;
  },

  // Job management
  async getJobs(limit = 50) {
    const response = await api.get(`/api/jobs?limit=${limit}`);
    return response.data;
  },

  async getJob(jobId) {
    const response = await api.get(`/api/jobs/${jobId}`);
    return response.data;
  },

  async submitJob(formData) {
    const response = await api.post('/api/jobs', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async updateJob(jobId, updates) {
    const response = await api.put(`/api/jobs/${jobId}`, updates);
    return response.data;
  },

  async cancelJob(jobId) {
    const response = await api.delete(`/api/jobs/${jobId}`);
    return response.data;
  },

  async addJobLog(jobId, message) {
    const response = await api.post(`/api/jobs/${jobId}/logs`, { message });
    return response.data;
  },

  async getJobLogs(jobId) {
    const response = await api.get(`/api/jobs/${jobId}/logs`);
    return response.data;
  },

  // Statistics and monitoring
  async getJobStats() {
    try {
      const response = await api.get('/api/jobs');
      const jobs = response.data.jobs || [];

      const stats = {
        total: jobs.length,
        pending: jobs.filter(job => job.status === 'pending').length,
        running: jobs.filter(job => job.status === 'running').length,
        completed: jobs.filter(job => job.status === 'completed').length,
        failed: jobs.filter(job => job.status === 'failed').length,
        cancelled: jobs.filter(job => job.status === 'cancelled').length,
      };

      return stats;
    } catch (error) {
      console.error('Failed to get job stats:', error);
      return {
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      };
    }
  },

  // File upload helper
  async getWorkerStats() {
    try {
      const response = await api.get('/api/workers/stats/all');
      return response.data;
    } catch (error) {
      console.error('Failed to get worker stats:', error);
      return {
        total_workers: 0,
        gpu_workers: 0,
        by_status: { busy: 0, idle: 0 }
      };
    }
  },

  createJobFormData(config, files) {
    const formData = new FormData();
    formData.append('config', JSON.stringify(config));

    if (files && files.length > 0) {
      // Create a zip file from multiple files (simplified for demo)
      formData.append('project_zip', files[0]);
    }

    return formData;
  },
};

export default trainForgeAPI;