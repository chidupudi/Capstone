// File: trainforge/dashboard/src/pages/JobDetails.js
// Detailed view of a specific training job with logs and metrics

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Download, Terminal, BarChart3, Settings, Calendar, Clock, FileText, File, FileJson, FileSpreadsheet, Package } from 'lucide-react';
import toast from 'react-hot-toast';

import StatusBadge from '../components/StatusBadge';
import { trainForgeAPI } from '../services/api';

const JobDetails = ({ jobId, onNavigate }) => {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [resultFiles, setResultFiles] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);

  // Extract progress from logs
  const extractProgressFromLogs = (logs) => {
    if (!logs || logs.length === 0) return 0;

    // Look for patterns like "Epoch 5/10" or "Progress: 50%" in logs
    for (let i = logs.length - 1; i >= 0; i--) {
      const message = logs[i].message || '';

      // Pattern 1: "Epoch X/Y" or "Epoch [X/Y]"
      const epochMatch = message.match(/Epoch\s*[\[\(]?(\d+)\s*\/\s*(\d+)[\]\)]?/i);
      if (epochMatch) {
        const current = parseInt(epochMatch[1]);
        const total = parseInt(epochMatch[2]);
        return Math.round((current / total) * 100);
      }

      // Pattern 2: "Progress: XX%" or "XX% complete"
      const percentMatch = message.match(/(\d+)%/);
      if (percentMatch) {
        return parseInt(percentMatch[1]);
      }

      // Pattern 3: "Step XXX/YYY"
      const stepMatch = message.match(/Step\s*(\d+)\s*\/\s*(\d+)/i);
      if (stepMatch) {
        const current = parseInt(stepMatch[1]);
        const total = parseInt(stepMatch[2]);
        return Math.round((current / total) * 100);
      }
    }

    return 0;
  };

  // Fetch job details
  const fetchJobDetails = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setRefreshing(true);

      const response = await trainForgeAPI.getJob(jobId);
      setJob(response);

      // Extract progress from logs
      if (response.status === 'running') {
        const progress = extractProgressFromLogs(response.logs);
        setTrainingProgress(progress);
      } else if (response.status === 'completed') {
        setTrainingProgress(100);
      }

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

  // Fetch result files
  const fetchResultFiles = async () => {
    try {
      setLoadingResults(true);
      const response = await fetch(`http://localhost:3000/api/jobs/${jobId}/results/files`);
      if (response.ok) {
        const data = await response.json();
        setResultFiles(data.files || []);
      }
    } catch (error) {
      console.error('Failed to fetch result files:', error);
    } finally {
      setLoadingResults(false);
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

  // Fetch result files when job is completed
  useEffect(() => {
    if (job && job.status === 'completed' && job.results_uploaded) {
      fetchResultFiles();
    }
  }, [job?.status, job?.results_uploaded]);

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-slate-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Job Not Found</h2>
          <p className="text-slate-600 mb-6">
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
    <div className="min-h-screen bg-slate-50" style={{ paddingBottom: 64 }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate && onNavigate('dashboard')}
              className="p-2 text-slate-400 hover:text-blue-600 bg-white border border-slate-200 shadow-sm rounded-xl transition-all hover:scale-105"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 tracking-tight">
                {job.project_name}
              </h1>
              <p className="text-slate-500 mt-1 font-mono text-sm">
                Job ID: {job.job_id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Auto-refresh
            </label>

            <button
              onClick={() => fetchJobDetails(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-xl transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Status and Progress */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-xl shadow-lg p-6 border border-slate-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Job Status
                </h2>
                <StatusBadge status={job.status} size="md" />
              </div>

              {/* Progress Bar for Running Jobs */}
              {job.status === 'running' && (
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-600">Training Progress</span>
                    <span className="font-medium text-slate-900">
                      {trainingProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <motion.div
                      className="h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full relative"
                      initial={{ width: 0 }}
                      animate={{ width: `${trainingProgress}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    >
                      {/* Animated shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse" />
                    </motion.div>
                  </div>
                  {trainingProgress > 0 && (
                    <p className="text-xs text-slate-500 mt-2">
                      Extracted from training logs
                    </p>
                  )}
                </div>
              )}

              {/* Progress Bar for Completed Jobs */}
              {job.status === 'completed' && (
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-600">Training Progress</span>
                    <span className="font-medium text-green-600">
                      100% Complete
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3">
                    <div className="h-3 bg-gradient-to-r from-green-500 to-green-600 rounded-full w-full" />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {job.error_message && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-medium text-red-800 mb-2">
                    Error Details
                  </h4>
                  <p className="text-sm text-red-700 font-mono">
                    {job.error_message}
                  </p>
                </div>
              )}

              {/* Timing Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-purple-500" />
                  <span className="text-slate-600">Created:</span>
                  <span className="font-medium text-slate-900">
                    {formatDate(job.created_at)}
                  </span>
                </div>

                {job.started_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span className="text-slate-600">Duration:</span>
                    <span className="font-medium text-slate-900">
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
              className="bg-white rounded-xl shadow-lg border border-slate-200"
            >
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-green-500" />
                    <h2 className="text-lg font-semibold text-slate-900">
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
                  <div className="bg-slate-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div className="font-mono text-sm space-y-1">
                      {job.logs.map((log, index) => (
                        <div key={index} className="flex gap-3">
                          <span className="text-slate-500 text-xs flex-shrink-0 mt-0.5">
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
                    <Terminal className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500">
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
              className="bg-white rounded-xl shadow-lg p-6 border border-slate-200"
            >
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-slate-900">
                  Configuration
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-500">
                    Training Script
                  </label>
                  <p className="text-sm font-mono text-slate-900 mt-1">
                    {job.training_script || 'train.py'}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-500">
                    Resources
                  </label>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">GPU:</span>
                      <span className="font-medium text-slate-900">
                        {job.resources?.gpu || 1}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">CPU:</span>
                      <span className="font-medium text-slate-900">
                        {job.resources?.cpu || 2}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Memory:</span>
                      <span className="font-medium text-slate-900">
                        {job.resources?.memory || '4Gi'}
                      </span>
                    </div>
                  </div>
                </div>

                {job.gpu_id && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">
                      Assigned GPU
                    </label>
                    <p className="text-sm font-mono text-slate-900 mt-1">
                      {job.gpu_id}
                    </p>
                  </div>
                )}

                {job.worker_node && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">
                      Worker Node
                    </label>
                    <p className="text-sm font-mono text-slate-900 mt-1">
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
              className="bg-white rounded-xl shadow-lg p-6 border border-slate-200"
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Actions
              </h3>

              <div className="space-y-3">
                {/* Download Results Button */}
                {job.status === 'completed' && (
                  <button
                    onClick={async () => {
                      try {
                        toast.loading('Downloading results...', { id: 'download' });

                        const response = await fetch(`http://localhost:3000/api/jobs/${job.job_id}/results`);

                        if (!response.ok) {
                          if (response.status === 404) {
                            toast.error('Results not uploaded yet', { id: 'download' });
                            return;
                          }
                          throw new Error('Download failed');
                        }

                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${job.project_name}-results.zip`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);

                        toast.success('Results downloaded successfully!', { id: 'download' });
                      } catch (error) {
                        console.error('Download error:', error);
                        toast.error('Failed to download results', { id: 'download' });
                      }
                    }}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Results
                  </button>
                )}

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
                  className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200:bg-slate-600 text-slate-900 text-sm font-medium rounded-lg transition-colors"
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
                  className="w-full px-4 py-2 bg-blue-100 hover:bg-blue-200:bg-blue-800 text-blue-900 text-sm font-medium rounded-lg transition-colors"
                >
                  Export Details
                </button>
              </div>
            </motion.div>

            {/* Results Files Section */}
            {job.status === 'completed' && job.results_uploaded && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="bg-white rounded-xl shadow-lg p-6 border border-slate-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-500" />
                    <h3 className="text-lg font-semibold text-slate-900">
                      Result Files
                    </h3>
                  </div>
                  <button
                    onClick={fetchResultFiles}
                    disabled={loadingResults}
                    className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200:bg-purple-800 transition-colors disabled:opacity-50"
                  >
                    {loadingResults ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {loadingResults ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : resultFiles.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {resultFiles.map((file, index) => {
                      const getFileIcon = (type) => {
                        if (type === 'json') return <FileJson className="w-4 h-4 text-yellow-500" />;
                        if (type === 'csv') return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
                        if (['txt', 'log'].includes(type)) return <FileText className="w-4 h-4 text-slate-500" />;
                        return <File className="w-4 h-4 text-blue-500" />;
                      };

                      const formatFileSize = (bytes) => {
                        if (bytes < 1024) return `${bytes} B`;
                        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                      };

                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100:bg-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {getFileIcon(file.type)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {file.path} • {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                toast.loading('Downloading file...', { id: 'file-download' });

                                const response = await fetch(
                                  `http://localhost:3000/api/jobs/${job.job_id}/results/file/${encodeURIComponent(file.path)}`
                                );

                                if (!response.ok) throw new Error('Download failed');

                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = file.name;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                window.URL.revokeObjectURL(url);

                                toast.success(`Downloaded ${file.name}!`, { id: 'file-download' });
                              } catch (error) {
                                console.error('Download error:', error);
                                toast.error('Failed to download file', { id: 'file-download' });
                              }
                            }}
                            className="p-2 text-purple-600 hover:bg-purple-100:bg-purple-900/50 rounded-lg transition-colors"
                            title="Download file"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No result files found</p>
                    <p className="text-sm mt-1">Results may not have been uploaded yet</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-white rounded-xl shadow-lg p-6 border border-slate-200"
            >
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-semibold text-slate-900">
                  Quick Stats
                </h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Log Entries:</span>
                  <span className="font-medium text-slate-900">
                    {job.logs?.length || 0}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Progress:</span>
                  <span className="font-medium text-slate-900">
                    {trainingProgress}%
                  </span>
                </div>

                {job.started_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Running Time:</span>
                    <span className="font-medium text-slate-900">
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