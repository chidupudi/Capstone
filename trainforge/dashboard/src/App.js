import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Spin, Result, Button, Alert, Typography } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SubmitJob from './pages/SubmitJob';
import JobDetails from './pages/JobDetails';
import DistributedMonitor from './pages/DistributedMonitor';
import Workers from './pages/Workers';
import GPUConnect from './pages/GPUConnect';
import AdminPanel from './pages/AdminPanel';
import CliLogin from './pages/CliLogin';
import Profile from './pages/Profile';
import Navbar from './components/Navbar';
import { trainForgeAPI } from './services/api';

// --- Protected Route Wrapper ---
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// --- Main App Wrapper (handles old-style state navigation) ---
function MainApp() {
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
        <div style={{ textAlign: 'center' }}>
          <Spin size="large" style={{ marginBottom: 24 }} />
          <Typography.Title level={2} style={{ marginBottom: 8 }}>TrainForge Dashboard</Typography.Title>
          <Typography.Text type="secondary">Connecting to TrainForge API...</Typography.Text>
        </div>
      </div>
    );
  }

  // API connection error screen
  if (!apiConnected) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: '24px' }}>
        <div style={{ maxWidth: '500px', width: '100%' }}>
          <Result
            status="error"
            title="Connection Failed"
            subTitle="Unable to connect to the TrainForge API server. Please make sure the API server is running."
            extra={[
              <Button type="primary" key="retry" icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
                Retry Connection
              </Button>
            ]}
          />
        </div>
      </div>
    );
  }

  // Main application with routing
  return (
    <div className="App" style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* Toast notifications */}
      <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#363636', color: '#fff' } }} />

      <Navbar currentPage={currentPage} onNavigate={handleNavigate} />

      {/* Page routing */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {currentPage === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
          {currentPage === 'submit' && <SubmitJob onNavigate={handleNavigate} />}
          {currentPage === 'job-details' && currentJobId && <JobDetails jobId={currentJobId} onNavigate={handleNavigate} />}
          {currentPage === 'distributed-monitor' && <DistributedMonitor onNavigate={handleNavigate} />}
          {currentPage === 'workers' && <Workers onNavigate={handleNavigate} />}
          {currentPage === 'gpu-connect' && <GPUConnect onNavigate={handleNavigate} />}
          {currentPage === 'admin' && <AdminPanel onNavigate={handleNavigate} />}
          {currentPage === 'profile' && <Profile onNavigate={handleNavigate} />}
        </motion.div>
      </AnimatePresence>

      {/* Connection status indicator */}
      <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 1000 }}>
        <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}>
          <Alert
            message={apiConnected ? 'Connected' : 'Disconnected'}
            type={apiConnected ? 'success' : 'error'}
            showIcon
            icon={apiConnected ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            style={{ fontSize: '12px', padding: '4px 8px', border: 'none', borderRadius: '16px' }}
          />
        </motion.div>
      </div>
    </div>
  );
}

// --- Root Component ---
function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/cli-login" element={<CliLogin />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <MainApp />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;