import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import { Spin, Result, Button } from 'antd';
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

export default function CliLogin() {
    const [searchParams] = useSearchParams();
    const port = searchParams.get('port');

    const { user, loading: authLoading } = useAuth();
    const [status, setStatus] = useState('waiting'); // waiting, logged_in, sending, success, error
    const [errorMsg, setErrorMsg] = useState(null);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            setStatus('waiting');
            return;
        }

        // User is logged in, send token to CLI server
        const sendToken = async () => {
            setStatus('sending');
            try {
                let token;
                if (user.authType === 'admin') {
                    token = localStorage.getItem('tf_admin_token');
                } else if (auth.currentUser) {
                    token = await auth.currentUser.getIdToken();
                } else {
                    throw new Error("No valid authentication token found.");
                }

                if (!token) {
                    throw new Error("Token is empty or invalid.");
                }

                // Use an invisible img or standard fetch to send it back to localhost CLI
                await fetch(`http://localhost:${port}/callback?token=${token}`, {
                    mode: 'no-cors' // The CLI won't send CORS headers, so we blindly send it
                });

                setStatus('success');

                // Automatically close tab after a few seconds
                setTimeout(() => {
                    window.close();
                }, 3000);
            } catch (err) {
                console.error('Failed to send token to CLI:', err);
                setStatus('error');
                setErrorMsg(err.message);
            }
        };

        if (port) {
            sendToken();
        } else {
            setStatus('error');
            setErrorMsg('No port provided. How did you get here without the CLI?');
        }
    }, [user, authLoading, port]);

    if (status === 'waiting') {
        const redirectUrl = port ? `/login?redirect=${encodeURIComponent('/cli-login?port=' + port)}` : '/login';

        return (
            <div style={css.container}>
                <div style={css.box}>
                    <h1 style={css.title}>TrainForge CLI Login</h1>
                    <p style={css.subtitle}>Sign in to authenticate your terminal session.</p>
                    <Button
                        type="primary"
                        size="large"
                        block
                        onClick={() => window.location.href = redirectUrl}
                    >
                        Go to Login Page
                    </Button>
                </div>
            </div>
        );
    }

    if (status === 'sending') {
        return (
            <div style={css.container}>
                <div style={css.box}>
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 48, color: '#e2e8f0' }} spin />} />
                    <h2 style={{ ...css.title, marginTop: 24 }}>Authenticating CLI...</h2>
                    <p style={css.subtitle}>Please wait while we connect to your terminal.</p>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div style={{ ...css.container, background: '#064e3b' }}>
                <div style={{ ...css.box, background: '#022c22', borderColor: '#059669' }}>
                    <CheckCircleOutlined style={{ fontSize: 64, color: '#34d399', marginBottom: 16 }} />
                    <h2 style={{ ...css.title, color: '#a7f3d0' }}>CLI Authenticated!</h2>
                    <p style={{ ...css.subtitle, color: '#6ee7b7' }}>You can close this tab and return to your terminal.</p>
                </div>
            </div>
        );
    }

    return (
        <div style={css.container}>
            <div style={css.box}>
                <Result
                    status="error"
                    title={<span style={{ color: '#f8fafc' }}>Authentication Failed</span>}
                    subTitle={<span style={{ color: '#94a3b8' }}>{errorMsg}</span>}
                    extra={[
                        <Button type="primary" key="retry" onClick={() => window.location.reload()}>
                            Try Again
                        </Button>
                    ]}
                />
            </div>
        </div>
    );
}

const css = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        fontFamily: "'Inter',system-ui,sans-serif",
    },
    box: {
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 16,
        padding: '40px',
        maxWidth: 400,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
    },
    title: {
        fontSize: 24,
        fontWeight: 600,
        color: '#f8fafc',
        margin: '0 0 8px 0',
    },
    subtitle: {
        fontSize: 14,
        color: '#94a3b8',
        margin: '0 0 32px 0',
        lineHeight: 1.5,
    },
    googleBtn: {
        width: '100%',
        padding: '12px',
        borderRadius: 8,
        border: 'none',
        background: '#f8fafc',
        color: '#0f172a',
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.2s',
    },
};
