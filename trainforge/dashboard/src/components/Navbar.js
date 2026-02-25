import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Users, Cpu, Plus, LayoutDashboard, User, LogOut, Network, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar = ({ currentPage, onNavigate }) => {
    const { user, isAdmin, logout } = useAuth();

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
        { id: 'submit', label: 'Submit Job', icon: Plus, adminOnly: false },
        { id: 'distributed-monitor', label: 'Monitor', icon: Activity, adminOnly: true },
        { id: 'workers', label: 'Workers', icon: Users, adminOnly: true },
        { id: 'gpu-connect', label: 'Configure GPUs', icon: Cpu, adminOnly: true },
        { id: 'admin', label: 'Admin Panel', icon: Settings, adminOnly: true },
    ];

    return (
        <div style={{
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px -5px rgba(0, 0, 0, 0.05)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
            padding: '0 24px',
            fontFamily: "'Inter', -apple-system, sans-serif"
        }}>
            <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', height: 72, justifyContent: 'space-between' }}>

                {/* Logo & Brand */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => onNavigate('dashboard')}>
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        style={{
                            background: 'linear-gradient(135deg, #06b6d4, #a855f7)',
                            borderRadius: '12px',
                            padding: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 15px rgba(6, 182, 212, 0.3)'
                        }}
                    >
                        <Network style={{ width: 24, height: 24, color: '#ffffff' }} />
                    </motion.div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #06b6d4, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>
                            TrainForge
                        </h1>
                        <p style={{ fontSize: 11, margin: 0, color: '#64748b', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                            AI Compute Engine
                        </p>
                    </div>
                </div>

                {/* Navigation Links */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {navItems.filter(item => !item.adminOnly || isAdmin).map(item => {
                        const isActive = currentPage === item.id;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '8px 16px',
                                    borderRadius: 12,
                                    border: 'none',
                                    background: isActive ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(168, 85, 247, 0.1))' : 'transparent',
                                    color: isActive ? '#06b6d4' : '#64748b',
                                    fontWeight: isActive ? 600 : 500,
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    position: 'relative'
                                }}
                                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; } }}
                                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; } }}
                            >
                                <Icon style={{ width: 16, height: 16 }} />
                                {item.label}
                                {isActive && (
                                    <motion.div
                                        layoutId="nav-indicator"
                                        style={{ position: 'absolute', bottom: -24, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #06b6d4, #a855f7)', borderRadius: '3px 3px 0 0' }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* User Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {isAdmin && (
                        <div style={{ fontSize: 10, fontWeight: 700, padding: '6px 12px', background: 'linear-gradient(135deg, #fef3c7, #fed7aa)', color: '#ea580c', borderRadius: '9999px', letterSpacing: '0.5px', textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(234, 88, 12, 0.1)' }}>
                            Admin
                        </div>
                    )}

                    <div style={{ height: 32, width: 1, background: '#e2e8f0' }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                            onClick={() => onNavigate('profile')}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 10, transition: 'all 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <img src={user?.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt="Avatar" style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{user?.displayName || 'User'}</div>
                            </div>
                        </button>
                        <button
                            onClick={logout}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 10, border: '1px solid #fecaca', background: '#fff', color: '#f43f5e', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'scale(1)'; }}
                            title="Log Out"
                        >
                            <LogOut style={{ width: 18, height: 18 }} />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Navbar;
