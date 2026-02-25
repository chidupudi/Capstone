import React from 'react';
import { motion } from 'framer-motion';
import { User, Mail, ShieldAlert, Key, Clock, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Profile = ({ onNavigate }) => {
    const { user, isAdmin } = useAuth();

    const lastSignInTime = user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString() : 'Recent';

    return (
        <div style={{
            minHeight: '100vh',
            background: '#f8fafc',
            padding: '40px 16px',
            fontFamily: "'Inter', -apple-system, sans-serif"
        }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden'
                    }}
                >
                    {/* Cover gradient */}
                    <div style={{
                        height: '160px',
                        background: 'linear-gradient(135deg, #06b6d4 0%, #a855f7 50%, #f97316 100%)'
                    }} />

                    <div style={{ padding: '0 32px 32px', position: 'relative' }}>
                        {/* Profile Avatar */}
                        <div style={{
                            position: 'absolute',
                            top: '-48px',
                            background: '#ffffff',
                            padding: '8px',
                            borderRadius: '50%',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}>
                            <img
                                src={user?.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
                                alt="Avatar"
                                style={{
                                    width: '96px',
                                    height: '96px',
                                    borderRadius: '50%',
                                    objectFit: 'cover'
                                }}
                            />
                        </div>

                        <div style={{ marginTop: '64px' }}>
                            <h2 style={{
                                fontSize: '30px',
                                fontWeight: '700',
                                color: '#0f172a',
                                margin: 0
                            }}>
                                {user?.name || user?.displayName || 'TrainForge User'}
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontWeight: '500' }}>
                                    <Mail style={{ width: '16px', height: '16px' }} />
                                    <span>{user?.email || 'No email provided'}</span>
                                </div>
                                {user?.phone && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontWeight: '500' }}>
                                        <Phone style={{ width: '16px', height: '16px' }} />
                                        <span>{user.phone}</span>
                                    </div>
                                )}
                                {isAdmin && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: 'linear-gradient(135deg, #fef3c7, #fed7aa)',
                                        color: '#ea580c',
                                        padding: '6px 12px',
                                        borderRadius: '9999px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        boxShadow: '0 2px 4px rgba(234, 88, 12, 0.1)'
                                    }}>
                                        <ShieldAlert style={{ width: '14px', height: '14px' }} />
                                        System Admin
                                    </div>
                                )}
                            </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '32px 0' }} />

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: '24px'
                        }}>
                            {/* Account Details Card */}
                            <div style={{
                                background: '#f8fafc',
                                padding: '24px',
                                borderRadius: '16px',
                                border: '1px solid #f1f5f9'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {/* Account ID */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{
                                            padding: '10px',
                                            background: 'rgba(6, 182, 212, 0.1)',
                                            color: '#06b6d4',
                                            borderRadius: '12px'
                                        }}>
                                            <User style={{ width: '20px', height: '20px' }} />
                                        </div>
                                        <div>
                                            <div style={{
                                                fontSize: '11px',
                                                color: '#64748b',
                                                fontWeight: '500',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                marginBottom: '2px'
                                            }}>
                                                Account ID
                                            </div>
                                            <div style={{
                                                fontSize: '13px',
                                                color: '#0f172a',
                                                fontWeight: '600',
                                                fontFamily: "'JetBrains Mono', monospace"
                                            }}>
                                                {user?.uid?.slice(0, 20) || 'N/A'}...
                                            </div>
                                        </div>
                                    </div>

                                    {/* Last Sign In */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{
                                            padding: '10px',
                                            background: 'rgba(168, 85, 247, 0.1)',
                                            color: '#a855f7',
                                            borderRadius: '12px'
                                        }}>
                                            <Clock style={{ width: '20px', height: '20px' }} />
                                        </div>
                                        <div>
                                            <div style={{
                                                fontSize: '11px',
                                                color: '#64748b',
                                                fontWeight: '500',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                marginBottom: '2px'
                                            }}>
                                                Last Sign In
                                            </div>
                                            <div style={{
                                                fontSize: '13px',
                                                color: '#0f172a',
                                                fontWeight: '600'
                                            }}>
                                                {lastSignInTime}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Authentication Card */}
                            <div style={{
                                background: '#f8fafc',
                                padding: '24px',
                                borderRadius: '16px',
                                border: '1px solid #f1f5f9',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                                    <div style={{
                                        padding: '10px',
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        color: '#10b981',
                                        borderRadius: '12px'
                                    }}>
                                        <Key style={{ width: '20px', height: '20px' }} />
                                    </div>
                                    <div>
                                        <div style={{
                                            fontSize: '14px',
                                            color: '#0f172a',
                                            fontWeight: '600'
                                        }}>
                                            Authentication Base
                                        </div>
                                        <div style={{
                                            fontSize: '12px',
                                            color: '#64748b'
                                        }}>
                                            Email & Password Auth
                                        </div>
                                    </div>
                                </div>
                                <p style={{
                                    fontSize: '14px',
                                    color: '#64748b',
                                    lineHeight: '1.6',
                                    margin: 0
                                }}>
                                    Your account is secured via Firebase Authentication. Passwords are encrypted and not stored in plain text.
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Profile;
