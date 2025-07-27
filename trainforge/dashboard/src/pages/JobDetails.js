// File: trainforge/dashboard/src/pages/JobDetails.js
// Detailed view of a specific training job with logs and metrics

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Download, Terminal, BarChart3, Settings, Calendar, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

import StatusBadge from '../components/StatusBadge';
import { trainForgeAPI } from '../services/api';

const JobDetails = ({ jobId, onNavigate }) => {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch job details
  const fetchJobDetails = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setRefreshing(true);
      
      const response = await trainForgeAPI.getJob(jobId);
      setJob(response);
      
      if (showRefreshIndicator) {
        toast.success('Job details refreshed');
      }
    } catch (error) {
      console.error('Failed to fetch job details:', error);
      toast.error('Failed to load job details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Auto-refresh for running jobs
  useEffect(() => {
    fetchJobDetails();
    
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      if (job && (job.status === 'running' || job.status === 'pending')) {
        fetchJobDetails();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [jobId, autoRefresh, job?.status]);

  // Format duration
  const formatDuration = (startTime, endTime) => {
    if (!startTime) return 'N/A';
    
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end - start) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-gray-600 dark:text-gray-300">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Job Not Found</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            The requested job could not be found.
          </p>
          <button
            onClick={() => onNavigate && onNavigate('dashboard')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => onNavigate && onNavigate('dashboard')}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {job.project_name}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Job ID: {job.job_id}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                Auto-refresh
              </label>
              
              <button
                onClick={() => fetchJobDetails(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Status and Progress */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Job Status
                </h2>
                <StatusBadge status={job.status} size="md" />
              </div>

              {/* Progress Bar for Running Jobs */}
              {job.status === 'running' && (
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-300">Training Progress</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {job.progress || 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <motion.div
                      className="h-3 bg-blue-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${job.progress || 0}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {job.error_message && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                    Error Details
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-300 font-mono">
                    {job.error_message}
                  </p>
                </div>
              )}

              {/* Timing Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-purple-500" />
                  <span className="text-gray-600 dark:text-gray-300">Created:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatDate(job.created_at)}
                  </span>
                </div>
                
                {job.started_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span className="text-gray-600 dark:text-gray-300">Duration:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatDuration(job.started_at, job.completed_at)}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Training Logs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-green-500" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Training Logs
                    </h2>
                  </div>
                  {job.logs && job.logs.length > 0 && (
                    <button
                      onClick={() => {
                        const logsText = job.logs.map(log => 
                          `[${new Date(log.timestamp).toISOString()}] ${log.message}`
                        ).join('\n');
                        const blob = new Blob([logsText], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${job.project_name}-logs.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6">
                {job.logs && job.logs.length > 0 ? (
                  <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div className="font-mono text-sm space-y-1">
                      {job.logs.map((log, index) => (
                        <div key={index} className="flex gap-3">
                          <span className="text-gray-500 text-xs flex-shrink-0 mt-0.5">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="text-green-400 whitespace-pre-wrap break-words">
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Terminal className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      No logs available yet
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Job Configuration */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Configuration
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Training Script
                  </label>
                  <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">
                    {job.training_script || 'train.py'}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Resources
                  </label>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">GPU:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {job.resources?.gpu || 1}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">CPU:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {job.resources?.cpu || 2}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Memory:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {job.resources?.memory || '4Gi'}
                      </span>
                    </div>
                  </div>
                </div>

                {job.gpu_id && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Assigned GPU
                    </label>
                    <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">
                      {job.gpu_id}
                    </p>
                  </div>
                )}

                {job.worker_node && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Worker Node
                    </label>
                    <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">
                      {job.worker_node}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Job Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Actions
              </h3>

              <div className="space-y-3">
                {job.status === 'running' && (
                  <button
                    onClick={async () => {
                      try {
                        await trainForgeAPI.cancelJob(job.job_id);
                        toast.success('Job cancelled successfully');
                        fetchJobDetails();
                      } catch (error) {
                        toast.error('Failed to cancel job');
                      }
                    }}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Cancel Job
                  </button>
                )}

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(job.job_id);
                    toast.success('Job ID copied to clipboard');
                  }}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Copy Job ID
                </button>

                <button
                  onClick={() => {
                    const jobData = {
                      job_id: job.job_id,
                      project_name: job.project_name,
                      status: job.status,
                      created_at: job.created_at,
                      logs: job.logs
                    };
                    const blob = new Blob([JSON.stringify(jobData, null, 2)], 
                      { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${job.project_name}-details.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full px-4 py-2 bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-900 dark:text-blue-100 text-sm font-medium rounded-lg transition-colors"
                >
                  Export Details
                </button>
              </div>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Quick Stats
                </h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Log Entries:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {job.logs?.length || 0}
                  </span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Progress:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {job.progress || 0}%
                  </span>
                </div>

                {job.started_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Running Time:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatDuration(job.started_at, job.completed_at)}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetails;