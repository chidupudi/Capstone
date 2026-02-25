// File: trainforge/dashboard/src/pages/Workers.js
// Real-time monitoring of connected Colab GPU workers

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Progress, Badge,
  Typography, Space, Button, Alert, Tooltip, Spin
} from 'antd';
import {
  CloudServerOutlined, ThunderboltOutlined, SyncOutlined,
  CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined,
  DesktopOutlined, ClockCircleOutlined, ReloadOutlined, DeleteOutlined
} from '@ant-design/icons';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Workers.css';

const { Title, Text } = Typography;

const Workers = ({ onNavigate }) => {
  const { isAdmin } = useAuth();

  const [workers, setWorkers] = useState([]);
  const [summary, setSummary] = useState({
    total_workers: 0,
    online_workers: 0,
    offline_workers: 0,
    busy_workers: 0,
    idle_workers: 0,
    total_gpus: 0,
    active_jobs: 0,
    completed_jobs: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch workers data
  const fetchWorkers = useCallback(async () => {
    try {
      const response = await api.get('/api/workers/distributed/status');
      const data = response.data;

      if (data.success) {
        setWorkers(data.workers || []);
        setSummary(data.summary || {});
        setLastUpdate(new Date());
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching workers:', err);
      setError('Failed to fetch worker status');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDisconnect = async (workerId) => {
    if (!window.confirm(`Are you sure you want to disconnect worker ${workerId}?`)) return;
    try {
      await api.delete(`/api/workers/${workerId}`);
      fetchWorkers();
    } catch (err) {
      console.error('Failed to disconnect worker:', err);
      alert('Failed to disconnect worker');
    }
  };

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchWorkers();

    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchWorkers, 3000); // Refresh every 3 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchWorkers, autoRefresh]);

  // Get status tag
  const getStatusTag = (status, isOnline) => {
    if (!isOnline) {
      return <Tag icon={<CloseCircleOutlined />} color="default">Offline</Tag>;
    }

    switch (status) {
      case 'busy':
        return <Tag icon={<LoadingOutlined spin />} color="processing">Training</Tag>;
      case 'idle':
        return <Tag icon={<CheckCircleOutlined />} color="success">Ready</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };

  // Format uptime
  const formatUptime = (ms) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Table columns
  const columns = [
    {
      title: 'Shard',
      dataIndex: 'shard_id',
      key: 'shard_id',
      width: 80,
      render: (shard) => (
        <Badge
          count={shard !== null ? shard + 1 : '?'}
          style={{
            backgroundColor: shard !== null ? ['#1890ff', '#52c41a', '#faad14', '#f5222d'][shard % 4] : '#999'
          }}
        />
      )
    },
    {
      title: 'Worker ID',
      dataIndex: 'worker_id',
      key: 'worker_id',
      ellipsis: true,
      render: (id) => (
        <Tooltip title={id}>
          <Text code style={{ fontSize: '12px' }}>{id?.substring(0, 20)}...</Text>
        </Tooltip>
      )
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => getStatusTag(record.status, record.is_online)
    },
    {
      title: 'GPU',
      key: 'gpu',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: '12px' }}>
            {record.gpu?.available ? (
              <><ThunderboltOutlined style={{ color: '#52c41a' }} /> {record.gpu.name}</>
            ) : (
              <><DesktopOutlined /> CPU Only</>
            )}
          </Text>
          {record.gpu?.memory_gb > 0 && (
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {record.gpu.memory_gb} GB VRAM
            </Text>
          )}
        </Space>
      )
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Progress
            percent={record.progress?.current || 0}
            size="small"
            status={record.status === 'busy' ? 'active' : 'normal'}
          />
          {record.progress?.message && (
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {record.progress.message}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: 'Jobs',
      key: 'jobs',
      width: 100,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: '12px' }}>
            Active: <Text strong>{record.jobs?.active || 0}</Text>
          </Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            Done: {record.jobs?.completed || 0}
          </Text>
        </Space>
      )
    },
    {
      title: 'Uptime',
      key: 'uptime',
      width: 100,
      render: (_, record) => (
        <Space>
          <ClockCircleOutlined />
          <Text style={{ fontSize: '12px' }}>
            {formatUptime(record.timing?.uptime_ms)}
          </Text>
        </Space>
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDisconnect(record.worker_id)}
          title="Disconnect Worker"
        />
      )
    }
  ];

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
    <div className="workers-page">
      {/* Header */}
      <div className="workers-header">
        <div className="header-left">
          <Title level={2} style={{ margin: 0 }}>
            <CloudServerOutlined /> Connected Workers
          </Title>
        </div>
        <div className="header-right">
          <Space>
            <Text type="secondary">
              Last update: {lastUpdate?.toLocaleTimeString() || '-'}
            </Text>
            <Button
              icon={autoRefresh ? <SyncOutlined spin /> : <ReloadOutlined />}
              onClick={() => setAutoRefresh(!autoRefresh)}
              type={autoRefresh ? 'primary' : 'default'}
            >
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchWorkers}>
              Refresh
            </Button>
          </Space>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small" className="stat-card">
            <Statistic
              title="Total Workers"
              value={summary.total_workers}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small" className="stat-card online">
            <Statistic
              title="Online"
              value={summary.online_workers}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small" className="stat-card busy">
            <Statistic
              title="Training"
              value={summary.busy_workers}
              prefix={<LoadingOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small" className="stat-card idle">
            <Statistic
              title="Idle"
              value={summary.idle_workers}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small" className="stat-card gpu">
            <Statistic
              title="GPUs"
              value={summary.total_gpus}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small" className="stat-card jobs">
            <Statistic
              title="Jobs Done"
              value={summary.completed_jobs}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Worker Shards Visual */}
      <Card
        title="Worker Shards (Data Distribution)"
        style={{ marginBottom: 24 }}
        extra={<Text type="secondary">Each shard processes 25% of training data</Text>}
      >
        <Row gutter={16}>
          {[0, 1, 2, 3].map(shardId => {
            const worker = workers.find(w => w.shard_id === shardId);
            const isAssigned = !!worker;
            const isOnline = worker?.is_online;
            const isBusy = worker?.status === 'busy';

            return (
              <Col xs={12} sm={6} key={shardId}>
                <Card
                  size="small"
                  className={`shard-card ${isAssigned ? (isOnline ? (isBusy ? 'busy' : 'online') : 'offline') : 'empty'}`}
                >
                  <div className="shard-header">
                    <Badge
                      status={isAssigned ? (isOnline ? (isBusy ? 'processing' : 'success') : 'default') : 'default'}
                      text={<Text strong>Shard {shardId + 1}</Text>}
                    />
                  </div>

                  {isAssigned ? (
                    <div className="shard-content">
                      <div className="gpu-info">
                        {worker.gpu?.available ? (
                          <><ThunderboltOutlined style={{ color: '#52c41a' }} /> {worker.gpu.name}</>
                        ) : (
                          <><DesktopOutlined /> CPU</>
                        )}
                      </div>
                      <Progress
                        percent={worker.progress?.current || 0}
                        size="small"
                        status={isBusy ? 'active' : 'normal'}
                      />
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        {isBusy ? 'Training...' : 'Ready'}
                      </Text>
                    </div>
                  ) : (
                    <div className="shard-empty">
                      <Text type="secondary">No worker assigned</Text>
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        Waiting for Colab connection...
                      </Text>
                    </div>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* Workers Table */}
      <Card title="All Connected Workers">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>Loading workers...</div>
          </div>
        ) : workers.length === 0 ? (
          <Alert
            message="No Workers Connected"
            description={
              <div>
                <p>No Colab workers are currently connected. To connect workers:</p>
                <ol>
                  <li>Start ngrok: <code>ngrok http 3000</code></li>
                  <li>Open Google Colab notebooks</li>
                  <li>Run the worker script with your ngrok URL</li>
                </ol>
              </div>
            }
            type="info"
            showIcon
          />
        ) : (
          <Table
            columns={columns}
            dataSource={workers}
            rowKey="worker_id"
            pagination={false}
            size="small"
            rowClassName={(record) =>
              !record.is_online ? 'row-offline' : record.status === 'busy' ? 'row-busy' : ''
            }
          />
        )}
      </Card>
    </div>
  );
};

export default Workers;
