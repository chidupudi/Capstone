// File: trainforge/dashboard/src/pages/Dashboard.js
// Complete main dashboard page with job overview and stats

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, RefreshCw, BarChart3, Clock, CheckCircle, XCircle, AlertCircle, Activity, Cpu, HardDrive } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import toast from 'react-hot-toast';

import JobCard from '../components/JobCard';
import StatusBadge from '../components/StatusBadge';
import { trainForgeAPI } from '../services/api';

const Dashboard = ({ onNavigate }) => {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, running, completed, failed

  // Real-time worker and GPU metrics from API
  const [systemMetrics, setSystemMetrics] = useState({
    total_workers: 0,
    gpu_workers: 0,
    by_status: { busy: 0, idle: 0 }
  });

  // Fetch jobs and stats
  const fetchData = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setRefreshing(true);

      const [jobsResponse, statsData, workerStats] = await Promise.all([
        trainForgeAPI.getJobs(50),
        trainForgeAPI.getJobStats(),
        trainForgeAPI.getWorkerStats()
      ]);

      setJobs(jobsResponse.jobs || []);
      setStats(statsData);
      if (workerStats) {
        setSystemMetrics(workerStats);
      }

      if (showRefreshIndicator) {
        toast.success('Dashboard refreshed');
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 10000);
    return () => clearInterval(interval);
  }, []);

  // Handle job cancellation
  const handleCancelJob = async (jobId) => {
    try {
      await trainForgeAPI.cancelJob(jobId);
      toast.success('Job cancelled successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to cancel job');
    }
  };

  // Handle job restart (mock implementation)
  const handleRestartJob = async (jobId) => {
    try {
      // In real implementation, this would restart the job
      toast.success('Job restart initiated');
      fetchData();
    } catch (error) {
      toast.error('Failed to restart job');
    }
  };

  // Filter jobs based on selected filter
  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true;
    return job.status === filter;
  });

  // Stats cards data
  const statsCards = [
    {
      title: 'Total Jobs',
      value: stats.total,
      icon: BarChart3,
      color: 'bg-gradient-to-r from-blue-500 to-blue-600',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Running',
      value: stats.running,
      icon: Activity,
      color: 'bg-gradient-to-r from-yellow-500 to-orange-600',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: 'Completed',
      value: stats.completed,
      icon: CheckCircle,
      color: 'bg-gradient-to-r from-green-500 to-green-600',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Failed',
      value: stats.failed,
      icon: XCircle,
      color: 'bg-gradient-to-r from-red-500 to-red-600',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ];

  // System metrics cards
  const systemCards = [
    {
      title: 'Total Active GPUs',
      value: systemMetrics.gpu_workers || 0,
      icon: Cpu,
      color: systemMetrics.gpu_workers > 0 ? 'text-emerald-600' : 'text-blue-600',
      bgColor: systemMetrics.gpu_workers > 0 ? 'bg-emerald-50' : 'bg-blue-50',
      status: systemMetrics.gpu_workers > 0 ? 'Running' : '0 GPUs',
      gradient: 'bg-gradient-to-r from-emerald-500 to-teal-500'
    },
    {
      title: 'Connected Workers',
      value: systemMetrics.total_workers || 0,
      icon: HardDrive,
      color: systemMetrics.total_workers > 0 ? 'text-blue-600' : 'text-gray-600',
      bgColor: systemMetrics.total_workers > 0 ? 'bg-blue-50' : 'bg-gray-50',
      status: systemMetrics.total_workers > 0 ? 'Online' : 'Offline',
      gradient: 'bg-gradient-to-r from-blue-500 to-cyan-500'
    },
    {
      title: 'Busy Workers',
      value: systemMetrics.by_status?.busy || 0,
      icon: Activity,
      color: systemMetrics.by_status?.busy > 0 ? 'text-yellow-600' : 'text-emerald-600',
      bgColor: systemMetrics.by_status?.busy > 0 ? 'bg-yellow-50' : 'bg-emerald-50',
      status: systemMetrics.by_status?.busy > 0 ? 'Computing' : 'Idle',
      gradient: 'bg-gradient-to-r from-yellow-500 to-orange-500'
    },
    {
      title: 'Idle Workers',
      value: systemMetrics.by_status?.idle || 0,
      icon: Clock,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      status: 'Standby',
      gradient: 'bg-gradient-to-r from-indigo-500 to-blue-500'
    }
  ];

  // Chart data for status distribution
  const chartData = [
    { name: 'Pending', value: stats.pending, color: '#f59e0b' },
    { name: 'Running', value: stats.running, color: '#3b82f6' },
    { name: 'Completed', value: stats.completed, color: '#10b981' },
    { name: 'Failed', value: stats.failed, color: '#ef4444' },
    { name: 'Cancelled', value: stats.cancelled, color: '#6b7280' }
  ];

  // Filter options
  const filterOptions = [
    { value: 'all', label: 'All Jobs', count: stats.total },
    { value: 'running', label: 'Running', count: stats.running },
    { value: 'completed', label: 'Completed', count: stats.completed },
    { value: 'failed', label: 'Failed', count: stats.failed },
    { value: 'pending', label: 'Pending', count: stats.pending }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-6"
          />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            TrainForge Dashboard
          </h2>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" style={{ paddingBottom: 64 }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page Title & Refresh */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 tracking-tight">
              Overview
            </h1>
            <p className="text-slate-500 mt-1">Platform analytics and job status monitor</p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-xl transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
        {/* Stats Cards */}
        <h2 className="text-xl font-bold text-slate-900 mb-4">Job Statistics</h2>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm p-5 border border-slate-200 hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-extrabold text-slate-900">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color} shadow-sm`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className={`mt-auto p-2 rounded-md ${stat.bgColor} flex items-center justify-center`}>
                <p className={`text-xs font-bold uppercase tracking-wide ${stat.textColor}`}>
                  {stat.value > 0 ? `${stat.value} active tasks` : 'No active tasks'}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* System Metrics */}
        <h2 className="text-xl font-bold text-slate-900 mb-4">System Metrics</h2>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {systemCards.map((metric, index) => (
            <motion.div
              key={metric.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
              className="bg-white rounded-xl shadow-sm p-5 border border-slate-200 hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {metric.title}
                  </p>
                  <p className="text-3xl font-extrabold text-slate-900">
                    {metric.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${metric.gradient} shadow-sm`}>
                  <metric.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className={`mt-auto p-2 rounded-md ${metric.bgColor} flex items-center justify-center`}>
                <p className={`text-xs font-bold uppercase tracking-wide ${metric.color}`}>
                  Status: {metric.status}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Status Distribution Pie Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-xl shadow-lg p-6 border border-slate-100"
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Job Status Distribution
            </h3>
            {stats.total > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chartData.filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value, percent }) =>
                      `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                    }
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">No data available</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Status Bar Chart */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-xl shadow-lg p-6 border border-slate-100"
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Job Statistics
            </h3>
            {stats.total > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData.filter(item => item.value > 0)}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="name"
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--tooltip-bg)',
                      border: '1px solid var(--tooltip-border)',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">No data available</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Jobs List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-xl shadow-lg border border-slate-100"
        >
          <div className="p-6 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Training Jobs
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {filteredJobs.length} of {jobs.length} jobs
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilter(option.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === option.value
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {option.label} ({option.count})
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6">
            {filteredJobs.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-slate-900 mb-2">
                  {filter === 'all' ? 'No jobs yet' : `No ${filter} jobs`}
                </h4>
                <p className="text-slate-500 mb-6">
                  {filter === 'all'
                    ? 'Submit your first training job to get started'
                    : `No jobs with status "${filter}" found`
                  }
                </p>
                {filter === 'all' && (
                  <button
                    onClick={() => onNavigate && onNavigate('submit')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all transform hover:scale-105 shadow-lg"
                  >
                    <Plus className="w-4 h-4" />
                    Submit First Job
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredJobs.map((job, index) => (
                  <motion.div
                    key={job.job_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <JobCard
                      job={job}
                      onClick={(job) => onNavigate && onNavigate('job-details', job.job_id)}
                      onCancel={handleCancelJob}
                      onRestart={handleRestartJob}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-8"
        >
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-xl shadow-lg p-8 text-white relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>

            <div className="relative">
              <div className="flex flex-col md:flex-row md:items-center justify-between">
                <div className="mb-6 md:mb-0">
                  <h3 className="text-2xl font-bold mb-2">Ready to train your model?</h3>
                  <p className="text-blue-100 text-lg">
                    Upload your training script and let TrainForge handle the infrastructure
                  </p>
                  <div className="flex items-center gap-4 mt-4">
                    <div className="flex items-center gap-2 text-blue-100">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Auto-scaling</span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-100">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">GPU optimized</span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-100">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Real-time monitoring</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate && onNavigate('submit')}
                  className="flex items-center gap-2 px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:bg-slate-50 transition-all transform hover:scale-105 shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  New Training Job
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;