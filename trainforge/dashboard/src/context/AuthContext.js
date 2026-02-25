import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, setDoc, getDoc } from '../services/firebase';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

const ADMIN_EMAIL = 'rupesh@trainforge.com';
const ADMIN_TOKEN_KEY = 'tf_admin_token';
const ADMIN_USER_KEY = 'tf_admin_user';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Restore admin session from storage if present
        const restoreAdminSession = () => {
            const token = localStorage.getItem(ADMIN_TOKEN_KEY);
            const stored = localStorage.getItem(ADMIN_USER_KEY);
            if (token && stored) {
                try {
                    return JSON.parse(stored);
                } catch {
                    localStorage.removeItem(ADMIN_TOKEN_KEY);
                    localStorage.removeItem(ADMIN_USER_KEY);
                }
            }
            return null;
        };

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Firebase user signed in — clear any stored admin session
                localStorage.removeItem(ADMIN_TOKEN_KEY);
                localStorage.removeItem(ADMIN_USER_KEY);

                // Fetch additional user details from Firestore
                try {
                    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setUser({ ...firebaseUser, ...userData });
                    } else {
                        setUser(firebaseUser);
                    }
                } catch (err) {
                    console.error("Error fetching user details:", err);
                    setUser(firebaseUser);
                }

                setIsAdmin(firebaseUser.email === ADMIN_EMAIL);
            } else {
                // No Firebase user — check for stored admin session
                const adminUser = restoreAdminSession();
                if (adminUser) {
                    setUser(adminUser);
                    setIsAdmin(true);
                } else {
                    setUser(null);
                    setIsAdmin(false);
                }
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const registerWithEmail = async (name, email, phone, password) => {
        setError(null);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save additional details to Firestore
            await setDoc(doc(db, 'users', user.uid), {
                name: name,
                email: email,
                phone: phone,
                createdAt: new Date().toISOString()
            });

            return user;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const loginWithEmail = async (email, password) => {
        setError(null);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return userCredential.user;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const loginAsAdmin = async (email, password) => {
        setError(null);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Admin login failed');
            }

            const adminUser = {
                uid: `admin-${email}`,
                email: data.email,
                displayName: 'Admin',
                isAdmin: true,
                photoURL: null,
                authType: 'admin'
            };

            localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
            localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(adminUser));

            setUser(adminUser);
            setIsAdmin(true);

            return data;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const logout = async () => {
        setError(null);
        try {
            // Clear admin session
            localStorage.removeItem(ADMIN_TOKEN_KEY);
            localStorage.removeItem(ADMIN_USER_KEY);
            setUser(null);
            setIsAdmin(false);
            // Sign out from Firebase if active
            if (auth.currentUser) {
                await signOut(auth);
            }
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const value = {
        user,
        isAdmin,
        loginWithEmail,
        registerWithEmail,
        loginAsAdmin,
        logout,
        loading,
        error,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
