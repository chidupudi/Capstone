// File: trainforge/dashboard/src/components/JobCard.js
// Individual job card component for the dashboard

import React from 'react';
import { motion } from 'framer-motion';
import { Card, Progress, Button, Typography, Space, Row, Col, Alert, Tag } from 'antd';
import { 
  ClockCircleOutlined, 
  DatabaseOutlined, 
  CalendarOutlined, 
  LinkOutlined, 
  PlayCircleOutlined, 
  StopOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import StatusBadge from './StatusBadge';

const JobCard = ({ job, onClick, onCancel, onRestart }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime) return 'N/A';
    
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end - start) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  const getProgressStatus = (status) => {
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'exception';
    if (status === 'running') return 'active';
    return 'normal';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        hoverable
        onClick={() => onClick && onClick(job)}
        style={{ 
          marginBottom: 16,
          borderRadius: 12,
          overflow: 'hidden'
        }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Typography.Title level={4} style={{ margin: 0, fontSize: '18px' }}>
                {job.project_name}
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                Job ID: {job.job_id?.slice(0, 8)}...
              </Typography.Text>
            </div>
            <Space>
              <StatusBadge status={job.status} />
              <Button
                type="text"
                icon={<LinkOutlined />}
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick && onClick(job);
                }}
                title="View Details"
              />
            </Space>
          </div>
        }
      >
        {/* Progress Bar */}
        {job.status === 'running' && (
          <div style={{ marginBottom: 16, padding: '8px 0', backgroundColor: '#fafafa', borderRadius: 6, padding: 12 }}>
            <Typography.Text strong style={{ fontSize: '12px' }}>Progress: {job.progress || 0}%</Typography.Text>
            <Progress 
              percent={job.progress || 0} 
              status={getProgressStatus(job.status)}
              size="small"
              style={{ marginTop: 4 }}
            />
          </div>
        )}

        {/* Resources */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Space size="small">
              <ThunderboltOutlined style={{ color: '#1890ff' }} />
              <Typography.Text type="secondary">GPU:</Typography.Text>
              <Typography.Text strong>{job.resources?.gpu || 1}</Typography.Text>
            </Space>
          </Col>
          <Col span={12}>
            <Space size="small">
              <DatabaseOutlined style={{ color: '#52c41a' }} />
              <Typography.Text type="secondary">Memory:</Typography.Text>
              <Typography.Text strong>{job.resources?.memory || '4Gi'}</Typography.Text>
            </Space>
          </Col>
        </Row>

        {/* Timing Info */}
        <Space direction="vertical" size="small" style={{ width: '100%', marginBottom: 16 }}>
          <Space size="small">
            <CalendarOutlined style={{ color: '#722ed1' }} />
            <Typography.Text type="secondary">Created:</Typography.Text>
            <Typography.Text>{formatDate(job.created_at)}</Typography.Text>
          </Space>
          
          {job.started_at && (
            <Space size="small">
              <ClockCircleOutlined style={{ color: '#fa8c16' }} />
              <Typography.Text type="secondary">Duration:</Typography.Text>
              <Typography.Text>{formatDuration(job.started_at, job.completed_at)}</Typography.Text>
            </Space>
          )}
        </Space>

        {/* Error Message */}
        {job.error_message && (
          <Alert
            message={<><strong>Error:</strong> {job.error_message}</>}
            type="error"
            style={{ marginBottom: 16 }}
            size="small"
          />
        )}

        {/* Training Script */}
        <div style={{ 
          backgroundColor: '#fafafa', 
          padding: 12, 
          borderRadius: 6, 
          marginBottom: job.status === 'running' || job.status === 'failed' ? 16 : 0 
        }}>
          <Typography.Text type="secondary">Script: </Typography.Text>
          <Typography.Text code strong style={{ marginLeft: 8 }}>
            {job.training_script || 'train.py'}
          </Typography.Text>
        </div>

        {/* Actions */}
        {(job.status === 'running' || job.status === 'failed') && (
          <div style={{ 
            borderTop: '1px solid #f0f0f0', 
            paddingTop: 12, 
            marginTop: 12,
            textAlign: 'right' 
          }}>
            <Space>
              {job.status === 'running' && onCancel && (
                <Button
                  size="small"
                  danger
                  icon={<StopOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel(job.job_id);
                  }}
                >
                  Cancel
                </Button>
              )}
              
              {job.status === 'failed' && onRestart && (
                <Button
                  size="small"
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestart(job.job_id);
                  }}
                >
                  Restart
                </Button>
              )}
            </Space>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

export default JobCard;