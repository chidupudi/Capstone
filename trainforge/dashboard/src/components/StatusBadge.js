// File: trainforge/dashboard/src/components/StatusBadge.js
// Reusable status badge component with colors and animations

import React from 'react';
import { motion } from 'framer-motion';
import { Tag } from 'antd';
import { 
  ClockCircleOutlined, 
  SyncOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  StopOutlined 
} from '@ant-design/icons';

const StatusBadge = ({ status, size = 'default', showIcon = true }) => {
  const getStatusConfig = (status) => {
    const configs = {
      pending: {
        color: 'warning',
        icon: <ClockCircleOutlined />,
        label: 'Pending'
      },
      running: {
        color: 'processing',
        icon: <SyncOutlined spin />,
        label: 'Running'
      },
      completed: {
        color: 'success',
        icon: <CheckCircleOutlined />,
        label: 'Completed'
      },
      failed: {
        color: 'error',
        icon: <CloseCircleOutlined />,
        label: 'Failed'
      },
      cancelled: {
        color: 'default',
        icon: <StopOutlined />,
        label: 'Cancelled'
      }
    };

    return configs[status] || configs.pending;
  };

  const config = getStatusConfig(status);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      style={{ display: 'inline-block' }}
    >
      <Tag
        color={config.color}
        icon={showIcon ? config.icon : null}
        style={{ 
          fontSize: size === 'large' ? '14px' : '12px',
          padding: size === 'large' ? '4px 8px' : '2px 6px',
          borderRadius: '12px'
        }}
      >
        {config.label}
      </Tag>
    </motion.div>
  );
};

export default StatusBadge;
