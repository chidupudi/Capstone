// File: trainforge/dashboard/src/pages/DistributedMonitor.js
// Real-time monitoring dashboard for distributed K8s training

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './DistributedMonitor.css';

const DistributedMonitor = () => {
  const { isAdmin } = useAuth();

  const [clusterData, setClusterData] = useState({
    pods: [],
    jobs: [],
    nodes: [],
    metrics: {
      totalCPU: 0,
      usedCPU: 0,
      totalMemory: 0,
      usedMemory: 0,
      activeWorkers: 0,
      completedJobs: 0
    }
  });

  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [lastUpdate, setLastUpdate] = useState(null);

  // Simulate real-time data fetching from K8s API
  useEffect(() => {
    const fetchClusterData = async () => {
      try {
        // In real implementation, this would call K8s API through proxy
        // kubectl proxy --port=8001 enables API access

        // Simulate pod data
        const mockPods = [
          {
            name: 'trainforge-cpu-workers-75665b8c48-bmsql',
            status: 'Running',
            cpu: Math.random() * 0.8 + 0.2, // 0.2-1.0 CPU usage
            memory: Math.random() * 400 + 100, // 100-500 MB
            node: 'docker-desktop',
            type: 'worker',
            restarts: Math.floor(Math.random() * 3),
            age: '5m23s'
          },
          {
            name: 'trainforge-cpu-workers-75665b8c48-gbj65',
            status: 'Running',
            cpu: Math.random() * 0.8 + 0.2,
            memory: Math.random() * 400 + 100,
            node: 'docker-desktop',
            type: 'worker',
            restarts: Math.floor(Math.random() * 3),
            age: '5m23s'
          },
          {
            name: 'trainforge-cpu-workers-75665b8c48-qwwtt',
            status: 'Running',
            cpu: Math.random() * 0.8 + 0.2,
            memory: Math.random() * 400 + 100,
            node: 'docker-desktop',
            type: 'worker',
            restarts: Math.floor(Math.random() * 3),
            age: '5m23s'
          },
          {
            name: 'trainforge-cpu-workers-75665b8c48-wpt2l',
            status: 'Running',
            cpu: Math.random() * 0.8 + 0.2,
            memory: Math.random() * 400 + 100,
            node: 'docker-desktop',
            type: 'worker',
            restarts: Math.floor(Math.random() * 3),
            age: '5m23s'
          },
          {
            name: 'trainforge-scheduler-79bbc4f546-2qslt',
            status: 'Running',
            cpu: Math.random() * 0.3 + 0.1,
            memory: Math.random() * 200 + 50,
            node: 'docker-desktop',
            type: 'scheduler',
            restarts: 1,
            age: '4m45s'
          },
          {
            name: 'trainforge-monitor-74c99d446b-hknpd',
            status: 'Running',
            cpu: Math.random() * 0.2 + 0.05,
            memory: Math.random() * 150 + 30,
            node: 'docker-desktop',
            type: 'monitor',
            restarts: 0,
            age: '3m12s'
          }
        ];

        // Simulate job data
        const mockJobs = [
          {
            name: 'trainforge-traditional-training',
            type: 'traditional',
            status: Math.random() > 0.3 ? 'Running' : 'Completed',
            completions: '1/1',
            duration: '2m15s',
            cpuUsage: 1.8, // High CPU for single process
            parallelism: 1
          },
          {
            name: 'trainforge-distributed-training',
            type: 'distributed',
            status: 'Running',
            completions: '3/4',
            duration: '1m42s',
            cpuUsage: 2.1, // Distributed across 4 workers
            parallelism: 4
          }
        ];

        // Calculate metrics
        const totalCPU = mockPods.reduce((sum, pod) => sum + 1, 0); // 1 CPU limit per pod
        const usedCPU = mockPods.reduce((sum, pod) => sum + pod.cpu, 0);
        const totalMemory = mockPods.reduce((sum, pod) => sum + 512, 0); // 512MB limit per pod
        const usedMemory = mockPods.reduce((sum, pod) => sum + pod.memory, 0);
        const activeWorkers = mockPods.filter(pod => pod.type === 'worker' && pod.status === 'Running').length;
        const completedJobs = mockJobs.filter(job => job.status === 'Completed').length;

        setClusterData({
          pods: mockPods,
          jobs: mockJobs,
          nodes: [{ name: 'docker-desktop', status: 'Ready', cpu: '8', memory: '7.7Gi' }],
          metrics: {
            totalCPU,
            usedCPU,
            totalMemory,
            usedMemory,
            activeWorkers,
            completedJobs
          }
        });

        setConnectionStatus('connected');
        setLastUpdate(new Date().toLocaleTimeString());

      } catch (error) {
        console.error('Error fetching cluster data:', error);
        setConnectionStatus('error');
      }
    };

    // Initial fetch
    fetchClusterData();

    // Set up real-time updates every 3 seconds
    const interval = setInterval(fetchClusterData, 3000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Running': return '#4CAF50';
      case 'Completed': return '#2196F3';
      case 'Pending': return '#FF9800';
      case 'Failed': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const formatCPU = (cpu) => `${cpu.toFixed(3)}`;
  const formatMemory = (memory) => `${Math.round(memory)}Mi`;
  const formatPercent = (used, total) => `${((used / total) * 100).toFixed(1)}%`;

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ background: '#1e293b', padding: 40, borderRadius: 16, textAlign: 'center', maxWidth: 400, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ margin: '0 0 8px', color: '#f1f5f9', fontSize: 24 }}>Access Denied</h2>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: '0' }}>You do not have permission to access the admin portal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="distributed-monitor">
      <div className="monitor-header">
        <h1>🚀 TrainForge Distributed Training Monitor</h1>
        <div className="connection-status">
          <span className={`status-indicator ${connectionStatus}`}></span>
          <span>K8s Cluster: {connectionStatus}</span>
          <span className="last-update">Last update: {lastUpdate}</span>
        </div>
      </div>

      {/* Real-time Metrics Overview */}
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>CPU Usage</h3>
          <div className="metric-value">
            {formatCPU(clusterData.metrics.usedCPU)} / {clusterData.metrics.totalCPU}
          </div>
          <div className="metric-percent">
            {formatPercent(clusterData.metrics.usedCPU, clusterData.metrics.totalCPU)}
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill cpu"
              style={{ width: `${(clusterData.metrics.usedCPU / clusterData.metrics.totalCPU) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="metric-card">
          <h3>Memory Usage</h3>
          <div className="metric-value">
            {formatMemory(clusterData.metrics.usedMemory)} / {formatMemory(clusterData.metrics.totalMemory)}
          </div>
          <div className="metric-percent">
            {formatPercent(clusterData.metrics.usedMemory, clusterData.metrics.totalMemory)}
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill memory"
              style={{ width: `${(clusterData.metrics.usedMemory / clusterData.metrics.totalMemory) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="metric-card">
          <h3>Active Workers</h3>
          <div className="metric-value">
            {clusterData.metrics.activeWorkers}
          </div>
          <div className="metric-label">Distributed CPU Workers</div>
        </div>

        <div className="metric-card">
          <h3>Training Jobs</h3>
          <div className="metric-value">
            {clusterData.jobs.length}
          </div>
          <div className="metric-label">
            {clusterData.metrics.completedJobs} Completed
          </div>
        </div>
      </div>

      {/* Training Jobs Comparison */}
      <div className="jobs-section">
        <h2>🏋️ Training Jobs Comparison</h2>
        <div className="jobs-grid">
          {clusterData.jobs.map((job, index) => (
            <div key={index} className={`job-card ${job.type}`}>
              <div className="job-header">
                <h3>{job.type === 'traditional' ? '🐌 Traditional Training' : '⚡ Distributed Training'}</h3>
                <span
                  className="job-status"
                  style={{ color: getStatusColor(job.status) }}
                >
                  {job.status}
                </span>
              </div>
              <div className="job-details">
                <div className="job-metric">
                  <span>Parallelism:</span>
                  <span>{job.parallelism} {job.parallelism === 1 ? 'process' : 'processes'}</span>
                </div>
                <div className="job-metric">
                  <span>Completion:</span>
                  <span>{job.completions}</span>
                </div>
                <div className="job-metric">
                  <span>Duration:</span>
                  <span>{job.duration}</span>
                </div>
                <div className="job-metric">
                  <span>CPU Usage:</span>
                  <span>{formatCPU(job.cpuUsage)} cores</span>
                </div>
              </div>
              <div className="job-progress">
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${job.type}`}
                    style={{
                      width: `${(parseFloat(job.completions.split('/')[0]) / parseFloat(job.completions.split('/')[1])) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Distributed Workers Status */}
      <div className="workers-section">
        <h2>👥 Distributed Workers Status</h2>
        <div className="workers-table">
          <div className="table-header">
            <div>Pod Name</div>
            <div>Status</div>
            <div>CPU</div>
            <div>Memory</div>
            <div>Type</div>
            <div>Restarts</div>
            <div>Age</div>
          </div>
          {clusterData.pods.map((pod, index) => (
            <div key={index} className={`table-row ${pod.type}`}>
              <div className="pod-name">{pod.name}</div>
              <div className="pod-status">
                <span
                  className="status-dot"
                  style={{ backgroundColor: getStatusColor(pod.status) }}
                ></span>
                {pod.status}
              </div>
              <div className="pod-cpu">{formatCPU(pod.cpu)}</div>
              <div className="pod-memory">{formatMemory(pod.memory)}</div>
              <div className="pod-type">{pod.type}</div>
              <div className="pod-restarts">{pod.restarts}</div>
              <div className="pod-age">{pod.age}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Comparison */}
      <div className="comparison-section">
        <h2>📊 Traditional vs Distributed Performance</h2>
        <div className="comparison-cards">
          <div className="comparison-card traditional">
            <h3>🐌 Traditional Approach</h3>
            <ul>
              <li>✅ Single process execution</li>
              <li>✅ 2 CPU cores allocated</li>
              <li>✅ Sequential model training</li>
              <li>⚠️ Limited parallelization</li>
              <li>⚠️ Higher memory per process</li>
            </ul>
          </div>
          <div className="comparison-card distributed">
            <h3>⚡ Distributed Approach</h3>
            <ul>
              <li>✅ 4 parallel workers</li>
              <li>✅ 0.5 CPU cores per worker</li>
              <li>✅ Simultaneous training</li>
              <li>✅ Better resource utilization</li>
              <li>✅ Fault tolerance</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Commands Section */}
      <div className="commands-section">
        <h2>🔧 Monitoring Commands</h2>
        <div className="command-grid">
          <div className="command-card">
            <h4>View All Pods</h4>
            <code>kubectl get pods</code>
          </div>
          <div className="command-card">
            <h4>Worker Logs</h4>
            <code>kubectl logs -l app=trainforge-worker -f</code>
          </div>
          <div className="command-card">
            <h4>Job Status</h4>
            <code>kubectl get jobs</code>
          </div>
          <div className="command-card">
            <h4>Resource Usage</h4>
            <code>kubectl top pods</code>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DistributedMonitor;