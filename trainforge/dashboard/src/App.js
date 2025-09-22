// File: trainforge/dashboard/src/App.js
// Main application component with routing and navigation

import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Spin, Result, Button, Alert, Typography } from 'antd';
import { ExclamationCircleOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

import Dashboard from './pages/Dashboard';
import SubmitJob from './pages/SubmitJob';
import JobDetails from './pages/JobDetails';
import DistributedMonitor from './pages/DistributedMonitor';
import { trainForgeAPI } from './services/api';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [currentJobId, setCurrentJobId] = useState(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);

  // Check API connection on startup
  useEffect(() => {
    const checkApiConnection = async () => {
      try {
        await trainForgeAPI.checkHealth();
        setApiConnected(true);
      } catch (error) {
        console.error('API connection failed:', error);
        setApiConnected(false);
      } finally {
        setCheckingConnection(false);
      }
    };

    checkApiConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkApiConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  // Navigation handler
  const handleNavigate = (page, jobId = null) => {
    setCurrentPage(page);
    setCurrentJobId(jobId);
  };

  // Loading screen while checking API connection
  if (checkingConnection) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5f5f5' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <Spin size="large" style={{ marginBottom: 24 }} />
          <Typography.Title level={2} style={{ marginBottom: 8 }}>
            TrainForge Dashboard
          </Typography.Title>
          <Typography.Text type="secondary">
            Connecting to TrainForge API...
          </Typography.Text>
        </div>
      </div>
    );
  }

  // API connection error screen
  if (!apiConnected) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5f5f5',
        padding: '24px'
      }}>
        <div style={{ maxWidth: '500px', width: '100%' }}>
          <Result
            status="error"
            title="Connection Failed"
            subTitle="Unable to connect to the TrainForge API server. Please make sure the API server is running."
            extra={[
              <Button 
                type="primary" 
                key="retry"
                icon={<ReloadOutlined />}
                onClick={() => window.location.reload()}
              >
                Retry Connection
              </Button>
            ]}
          />
          
          <Alert
            message="Quick Fix"
            description={
              <ol style={{ marginBottom: 0, paddingLeft: '20px' }}>
                <li>Open terminal in <code>trainforge/api</code></li>
                <li>Run <code>npm start</code></li>
                <li>Ensure API is running on <code>http://localhost:3000</code></li>
              </ol>
            }
            type="info"
            showIcon
            style={{ marginTop: '16px' }}
          />
        </div>
      </div>
    );
  }

  // Main application with routing
  return (
    <div className="App">
      {/* Toast notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />

      {/* Page routing */}
      <motion.div
        key={currentPage}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
      >
        {currentPage === 'dashboard' && (
          <Dashboard onNavigate={handleNavigate} />
        )}
        
        {currentPage === 'submit' && (
          <SubmitJob onNavigate={handleNavigate} />
        )}
        
        {currentPage === 'job-details' && currentJobId && (
          <JobDetails 
            jobId={currentJobId} 
            onNavigate={handleNavigate} 
          />
        )}
        
        {currentPage === 'distributed-monitor' && (
          <DistributedMonitor onNavigate={handleNavigate} />
        )}
      </motion.div>

      {/* Connection status indicator */}
      <div style={{ 
        position: 'fixed', 
        bottom: '16px', 
        right: '16px', 
        zIndex: 1000 
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Alert
            message={apiConnected ? 'Connected' : 'Disconnected'}
            type={apiConnected ? 'success' : 'error'}
            showIcon
            icon={apiConnected ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            style={{
              fontSize: '12px',
              padding: '4px 8px',
              border: 'none',
              borderRadius: '16px'
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}

export default App;