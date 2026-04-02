import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface User {
    id: number;
    displayname: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    fplEntryId: number | null;
    fplConnected: boolean;
    showFplConnectedModal: boolean;
    dismissFplConnectedModal: () => void;
    showFplDisconnectedToast: boolean;
    dismissFplDisconnectedToast: () => void;
    loginGlow: boolean;
    setFplEntryId: (id: number | null) => void;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
    extensionDetected: boolean;
    isLoginOpen: boolean;
    setIsLoginOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [fplEntryId, setFplEntryId] = useState<number | null>(null);
    const [fplConnected, setFplConnected] = useState(false);
    const [showFplConnectedModal, setShowFplConnectedModal] = useState(false);
    const [showFplDisconnectedToast, setShowFplDisconnectedToast] = useState(false);
    const [loginGlow, setLoginGlow] = useState(false);
    const [extensionDetected, setExtensionDetected] = useState(false);
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const prevFplConnected = useRef(false);
    const initialFplCheckDone = useRef(false);

    useEffect(() => {
        const check = () => {
            if (document.documentElement.getAttribute('data-fpw-extension') === 'installed') {
                setExtensionDetected(true);
                return true;
            }
            return false;
        };

        if (check()) return;

        const interval = setInterval(() => {
            if (check()) clearInterval(interval);
        }, 1000);

        const timeout = setTimeout(() => clearInterval(interval), 5000);
        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, []);

    useEffect(() => {
        if (token && !user) {
            fetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Invalid token');
                })
                .then(data => {
                    setUser(data.user);
                })
                .catch(() => {
                    logout();
                });
        }
    }, [token]);

    useEffect(() => {
        if (!token || !user) {
            setFplEntryId(null);
            setFplConnected(false);
            prevFplConnected.current = false;
            initialFplCheckDone.current = false;
            return;
        }

        const checkStatus = () => {
            fetch('/api/fpl/status', { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.ok ? r.json() : null)
                .then(d => {
                    if (d) {
                        setFplEntryId(d.fpl_entry_id);
                        const connected = !!d.fpl_connected;
                        setFplConnected(connected);
                        if (!initialFplCheckDone.current) {
                            // First check after login — show modal if already connected (once per session)
                            if (connected && !sessionStorage.getItem('fpl_modal_shown')) {
                                setShowFplConnectedModal(true);
                                sessionStorage.setItem('fpl_modal_shown', 'true');
                            }
                        } else {
                            // Subsequent checks — only fire on genuine transitions
                            if (connected && !prevFplConnected.current) {
                                setShowFplConnectedModal(true);
                            }
                            if (!connected && prevFplConnected.current) {
                                setShowFplDisconnectedToast(true);
                                setTimeout(() => setShowFplDisconnectedToast(false), 5000);
                            }
                        }
                        prevFplConnected.current = connected;
                        initialFplCheckDone.current = true;
                    }
                })
                .catch(() => {});
        };

        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, [token, user]);

    const login = (newToken: string, newUser: User) => {
        localStorage.setItem('token', newToken);
        sessionStorage.removeItem('fpl_modal_shown');
        window.dispatchEvent(new CustomEvent('fpw-login', { detail: { token: newToken } }));
        setToken(newToken);
        setUser(newUser);
        setLoginGlow(true);
        setTimeout(() => setLoginGlow(false), 2500);
    };

    const logout = () => {
        const currentToken = localStorage.getItem('token');
        if (currentToken) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: { Authorization: `Bearer ${currentToken}` }
            }).catch(() => {});
        }
        localStorage.removeItem('token');
        sessionStorage.removeItem('fpl_modal_shown');
        setToken(null);
        setUser(null);
        setFplEntryId(null);
        setFplConnected(false);
        prevFplConnected.current = false;
        initialFplCheckDone.current = false;
        window.location.href = '/';
    };

    return (
        <AuthContext.Provider value={{
            user, token, fplEntryId, fplConnected,
            showFplConnectedModal,
            dismissFplConnectedModal: () => setShowFplConnectedModal(false),
            showFplDisconnectedToast,
            dismissFplDisconnectedToast: () => setShowFplDisconnectedToast(false),
            loginGlow,
            extensionDetected,
            isLoginOpen,
            setIsLoginOpen,
            setFplEntryId, login, logout, isAuthenticated: !!user
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
