// File: trainforge/dashboard/src/pages/Dashboard.js
// Complete main dashboard page with job overview and stats

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, RefreshCw, BarChart3, Clock, CheckCircle, XCircle, AlertCircle, Activity, Cpu, HardDrive, Calendar } from 'lucide-react';
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

  // Mock system metrics for demo (in real system, get from API)
  const [systemMetrics] = useState({
    cpuUsage: 45,
    memoryUsage: 68,
    gpuUsage: 23,
    activeWorkers: 2
  });

  // Fetch jobs and stats
  const fetchData = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setRefreshing(true);
      
      const [jobsResponse, statsData] = await Promise.all([
        trainForgeAPI.getJobs(50),
        trainForgeAPI.getJobStats()
      ]);

      setJobs(jobsResponse.jobs || []);
      setStats(statsData);
      
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
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      title: 'Running',
      value: stats.running,
      icon: Activity,
      color: 'bg-gradient-to-r from-yellow-500 to-orange-600',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20'
    },
    {
      title: 'Completed',
      value: stats.completed,
      icon: CheckCircle,
      color: 'bg-gradient-to-r from-green-500 to-green-600',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      title: 'Failed',
      value: stats.failed,
      icon: XCircle,
      color: 'bg-gradient-to-r from-red-500 to-red-600',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20'
    }
  ];

  // System metrics cards
  const systemCards = [
    {
      title: 'CPU Usage',
      value: `${systemMetrics.cpuUsage}%`,
      icon: Cpu,
      color: systemMetrics.cpuUsage > 80 ? 'text-red-500' : systemMetrics.cpuUsage > 60 ? 'text-yellow-500' : 'text-green-500'
    },
    {
      title: 'Memory',
      value: `${systemMetrics.memoryUsage}%`,
      icon: HardDrive,
      color: systemMetrics.memoryUsage > 80 ? 'text-red-500' : systemMetrics.memoryUsage > 60 ? 'text-yellow-500' : 'text-green-500'
    },
    {
      title: 'GPU Usage',
      value: `${systemMetrics.gpuUsage}%`,
      icon: Activity,
      color: systemMetrics.gpuUsage > 80 ? 'text-red-500' : systemMetrics.gpuUsage > 60 ? 'text-yellow-500' : 'text-green-500'
    },
    {
      title: 'Workers',
      value: systemMetrics.activeWorkers,
      icon: Clock,
      color: 'text-blue-500'
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-6"
          />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            TrainForge Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-300">Loading dashboard...</p>
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                TrainForge Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage and monitor your AI training jobs
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              
              <button
                onClick={() => onNavigate && onNavigate('submit')}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-medium rounded-lg transition-all transform hover:scale-105 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                Submit Job
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${stat.color} shadow-lg`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className={`mt-4 p-2 rounded-lg ${stat.bgColor}`}>
                <p className={`text-xs font-medium ${stat.textColor}`}>
                  {stat.value > 0 ? `${stat.value} active` : 'No active jobs'}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* System Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {systemCards.map((metric, index) => (
            <motion.div
              key={metric.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {metric.title}
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                    {metric.value}
                  </p>
                </div>
                <metric.icon className={`w-5 h-5 ${metric.color}`} />
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
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
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
                  <BarChart3 className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No data available</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Status Bar Chart */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
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
                  <BarChart3 className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No data available</p>
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
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Training Jobs
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {filteredJobs.length} of {jobs.length} jobs
                </p>
              </div>
              
              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilter(option.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      filter === option.value
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
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
                <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {filter === 'all' ? 'No jobs yet' : `No ${filter} jobs`}
                </h4>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
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
                  className="flex items-center gap-2 px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:bg-gray-50 transition-all transform hover:scale-105 shadow-lg"
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