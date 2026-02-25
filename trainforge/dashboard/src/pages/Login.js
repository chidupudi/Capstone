import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Server, Zap, Shield, User, Lock, Mail } from 'lucide-react';

export default function Login() {
    const { loginWithEmail, loginAsAdmin, error } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const redirectUrl = new URLSearchParams(location.search).get('redirect') || '/';

    const [loading, setLoading] = useState(false);
    const [loginMode, setLoginMode] = useState('user'); // 'user' or 'admin'
    const [adminCredentials, setAdminCredentials] = useState({ email: '', password: '' });
    const [adminError, setAdminError] = useState('');

    const [userCredentials, setUserCredentials] = useState({ email: '', password: '' });

    const handleUserLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await loginWithEmail(userCredentials.email, userCredentials.password);
            navigate(redirectUrl);
        } catch (err) {
            console.error('Login failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdminLogin = async (e) => {
        e.preventDefault();
        setAdminError('');
        setLoading(true);
        try {
            await loginAsAdmin(adminCredentials.email, adminCredentials.password);
            navigate(redirectUrl);
        } catch (err) {
            setAdminError(err.message || 'Invalid admin credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #fef3c7 100%)',
            position: 'relative',
            overflow: 'hidden',
            padding: '24px',
            fontFamily: "'Inter', -apple-system, sans-serif"
        }}>

            {/* Animated Background Shapes */}
            <div style={{
                position: 'absolute',
                top: '-10%',
                left: '-5%',
                width: '400px',
                height: '400px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #06b6d4, #a855f7)',
                filter: 'blur(80px)',
                opacity: 0.3,
                animation: 'float 20s ease-in-out infinite'
            }} />

            <div style={{
                position: 'absolute',
                bottom: '-10%',
                right: '-5%',
                width: '500px',
                height: '500px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f97316, #a855f7)',
                filter: 'blur(80px)',
                opacity: 0.3,
                animation: 'float 20s ease-in-out infinite 2s'
            }} />

            <div style={{
                position: 'absolute',
                top: '30%',
                right: '10%',
                width: '300px',
                height: '300px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
                filter: 'blur(80px)',
                opacity: 0.3,
                animation: 'float 20s ease-in-out infinite 4s'
            }} />

            {/* Login Card */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                width: '100%',
                maxWidth: '480px',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                padding: '48px',
            }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    {/* Logo */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '80px',
                        height: '80px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #06b6d4, #a855f7)',
                        boxShadow: '0 10px 30px rgba(6, 182, 212, 0.3)',
                        marginBottom: '24px',
                    }}>
                        <Server style={{ width: '40px', height: '40px', color: '#ffffff' }} />
                    </div>

                    {/* Title */}
                    <h1 style={{
                        fontSize: '36px',
                        fontWeight: '800',
                        background: 'linear-gradient(135deg, #06b6d4, #a855f7)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        marginBottom: '8px',
                        letterSpacing: '-0.5px'
                    }}>
                        TrainForge
                    </h1>

                    {/* Subtitle */}
                    <p style={{
                        fontSize: '16px',
                        color: '#64748b',
                        fontWeight: '500',
                        margin: 0
                    }}>
                        AI Training Platform
                    </p>
                </div>

                {/* Login Mode Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '32px',
                    padding: '4px',
                    background: '#f1f5f9',
                    borderRadius: '12px'
                }}>
                    <button
                        onClick={() => { setLoginMode('user'); setAdminError(''); }}
                        style={{
                            flex: 1,
                            padding: '12px',
                            fontSize: '14px',
                            fontWeight: '600',
                            border: 'none',
                            borderRadius: '8px',
                            background: loginMode === 'user' ? '#ffffff' : 'transparent',
                            color: loginMode === 'user' ? '#06b6d4' : '#64748b',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: loginMode === 'user' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <User style={{ width: '16px', height: '16px' }} />
                        User Login
                    </button>
                    <button
                        onClick={() => { setLoginMode('admin'); setAdminError(''); }}
                        style={{
                            flex: 1,
                            padding: '12px',
                            fontSize: '14px',
                            fontWeight: '600',
                            border: 'none',
                            borderRadius: '8px',
                            background: loginMode === 'admin' ? '#ffffff' : 'transparent',
                            color: loginMode === 'admin' ? '#f97316' : '#64748b',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: loginMode === 'admin' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <Shield style={{ width: '16px', height: '16px' }} />
                        Admin Login
                    </button>
                </div>

                {/* User Login (Email/Password) */}
                {loginMode === 'user' && (
                    <form onSubmit={handleUserLogin}>
                        {/* Feature Pills */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '8px',
                            marginBottom: '24px',
                            flexWrap: 'wrap'
                        }}>
                            <span style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: '#64748b',
                                background: '#f1f5f9',
                                borderRadius: '9999px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <Zap style={{ width: '14px', height: '14px', color: '#06b6d4' }} />
                                Fast & Scalable
                            </span>
                            <span style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: '#64748b',
                                background: '#f1f5f9',
                                borderRadius: '9999px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <Shield style={{ width: '14px', height: '14px', color: '#10b981' }} />
                                Secure
                            </span>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div style={{
                                marginBottom: '16px',
                                padding: '12px',
                                borderRadius: '10px',
                                background: 'rgba(244, 63, 94, 0.1)',
                                border: '1px solid rgba(244, 63, 94, 0.2)',
                                color: '#e11d48',
                                fontSize: '13px',
                                textAlign: 'center'
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Email Input */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#0f172a'
                            }}>
                                Email Address
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Mail style={{
                                    position: 'absolute',
                                    left: '14px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '18px',
                                    height: '18px',
                                    color: '#94a3b8'
                                }} />
                                <input
                                    type="email"
                                    required
                                    value={userCredentials.email}
                                    onChange={(e) => setUserCredentials({ ...userCredentials, email: e.target.value })}
                                    placeholder="you@company.com"
                                    style={{
                                        width: '100%',
                                        padding: '12px 12px 12px 44px',
                                        fontSize: '14px',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '10px',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        fontFamily: "'Inter', sans-serif"
                                    }}
                                    onFocus={(e) => e.currentTarget.style.borderColor = '#06b6d4'}
                                    onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#0f172a'
                            }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Lock style={{
                                    position: 'absolute',
                                    left: '14px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '18px',
                                    height: '18px',
                                    color: '#94a3b8'
                                }} />
                                <input
                                    type="password"
                                    required
                                    value={userCredentials.password}
                                    onChange={(e) => setUserCredentials({ ...userCredentials, password: e.target.value })}
                                    placeholder="••••••••"
                                    style={{
                                        width: '100%',
                                        padding: '12px 12px 12px 44px',
                                        fontSize: '14px',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '10px',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        fontFamily: "'Inter', sans-serif"
                                    }}
                                    onFocus={(e) => e.currentTarget.style.borderColor = '#06b6d4'}
                                    onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                padding: '14px 24px',
                                fontSize: '15px',
                                fontWeight: '600',
                                color: '#ffffff',
                                background: 'linear-gradient(135deg, #06b6d4, #a855f7)',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)',
                                opacity: loading ? 0.7 : 1
                            }}
                            onMouseEnter={(e) => {
                                if (!loading) {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(6, 182, 212, 0.4)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(6, 182, 212, 0.3)';
                            }}
                        >
                            {loading ? (
                                <>
                                    <div style={{
                                        width: '18px',
                                        height: '18px',
                                        border: '3px solid rgba(255,255,255,0.3)',
                                        borderTopColor: '#ffffff',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite'
                                    }} />
                                    Authenticating...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>

                        {/* Footer */}
                        <div style={{
                            marginTop: '24px',
                            textAlign: 'center'
                        }}>
                            <p style={{
                                fontSize: '14px',
                                color: '#64748b',
                                margin: 0
                            }}>
                                Don't have an account?{' '}
                                <Link
                                    to="/register"
                                    style={{
                                        color: '#06b6d4',
                                        fontWeight: '600',
                                        textDecoration: 'none'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#0891b2'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#06b6d4'}
                                >
                                    Sign up
                                </Link>
                            </p>
                        </div>
                    </form>
                )}

                {/* Admin Login (Email/Password) */}
                {loginMode === 'admin' && (
                    <form onSubmit={handleAdminLogin}>
                        {/* Admin Error Message */}
                        {adminError && (
                            <div style={{
                                marginBottom: '20px',
                                padding: '12px',
                                borderRadius: '10px',
                                background: 'rgba(244, 63, 94, 0.1)',
                                border: '1px solid rgba(244, 63, 94, 0.2)',
                                color: '#e11d48',
                                fontSize: '13px',
                                textAlign: 'center'
                            }}>
                                {adminError}
                            </div>
                        )}

                        {/* Email Input */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#0f172a'
                            }}>
                                Admin Email
                            </label>
                            <div style={{ position: 'relative' }}>
                                <User style={{
                                    position: 'absolute',
                                    left: '14px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '18px',
                                    height: '18px',
                                    color: '#94a3b8'
                                }} />
                                <input
                                    type="email"
                                    required
                                    value={adminCredentials.email}
                                    onChange={(e) => setAdminCredentials({ ...adminCredentials, email: e.target.value })}
                                    placeholder="admin@trainforge.com"
                                    style={{
                                        width: '100%',
                                        padding: '12px 12px 12px 44px',
                                        fontSize: '14px',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '10px',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        fontFamily: "'Inter', sans-serif"
                                    }}
                                    onFocus={(e) => e.currentTarget.style.borderColor = '#f97316'}
                                    onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#0f172a'
                            }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Lock style={{
                                    position: 'absolute',
                                    left: '14px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '18px',
                                    height: '18px',
                                    color: '#94a3b8'
                                }} />
                                <input
                                    type="password"
                                    required
                                    value={adminCredentials.password}
                                    onChange={(e) => setAdminCredentials({ ...adminCredentials, password: e.target.value })}
                                    placeholder="Enter admin password"
                                    style={{
                                        width: '100%',
                                        padding: '12px 12px 12px 44px',
                                        fontSize: '14px',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '10px',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        fontFamily: "'Inter', sans-serif"
                                    }}
                                    onFocus={(e) => e.currentTarget.style.borderColor = '#f97316'}
                                    onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                        </div>

                        {/* Admin Login Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                padding: '14px 24px',
                                fontSize: '15px',
                                fontWeight: '600',
                                color: '#ffffff',
                                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)',
                                opacity: loading ? 0.7 : 1
                            }}
                            onMouseEnter={(e) => {
                                if (!loading) {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(249, 115, 22, 0.4)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.3)';
                            }}
                        >
                            {loading ? (
                                <>
                                    <div style={{
                                        width: '18px',
                                        height: '18px',
                                        border: '3px solid rgba(255,255,255,0.3)',
                                        borderTopColor: '#ffffff',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite'
                                    }} />
                                    Authenticating...
                                </>
                            ) : (
                                <>
                                    <Shield style={{ width: '18px', height: '18px' }} />
                                    Admin Sign In
                                </>
                            )}
                        </button>

                        {/* Admin Footer */}
                        <div style={{
                            marginTop: '32px',
                            paddingTop: '20px',
                            borderTop: '1px solid #e2e8f0',
                            textAlign: 'center'
                        }}>
                            <p style={{
                                fontSize: '12px',
                                color: '#94a3b8',
                                lineHeight: '1.6',
                                margin: 0
                            }}>
                                🔒 Admin access restricted to authorized personnel
                            </p>
                        </div>
                    </form>
                )}
            </div>

            {/* Add keyframes animation */}
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(30px, -30px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
