// File: trainforge/dashboard/src/services/api.js
// API service for communicating with TrainForge backend

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
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