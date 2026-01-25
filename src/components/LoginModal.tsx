import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [step, setStep] = useState(1); // 1 = Email/Pass, 2 = DisplayName (Signup only)

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');

    const [error, setError] = useState('');
    const { login } = useAuth();

    // Clear error and reset form when modal opens/closes
    React.useEffect(() => {
        if (isOpen) {
            resetForm();
        }
    }, [isOpen]);

    const resetForm = () => {
        setError('');
        setEmail('');
        setPassword('');
        setDisplayName('');
        setStep(1);
    }

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (isLogin) {
            // LOGIN FLOW
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email.trim(), password }),
                });

                const data = await res.json();

                if (!res.ok) throw new Error(data.error || 'Authentication failed');

                login(data.token, data.user);
                onClose();
            } catch (err: any) {
                setError(err.message);
            }
        } else {
            // SIGNUP FLOW
            if (step === 1) {
                // Validate Step 1
                if (!email || !password) {
                    setError('Please fill in all fields');
                    return;
                }
                if (password.length < 6) {
                    setError('Password must be at least 6 characters');
                    return;
                }
                // Move to Step 2
                setStep(2);
            } else {
                // Finalize Signup (Step 2)
                if (!displayName.trim()) {
                    setError('Display Name is required');
                    return;
                }

                try {
                    const res = await fetch('/api/auth/signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: email.trim(),
                            password,
                            display_name: displayName.trim()
                        }),
                    });

                    const data = await res.json();

                    if (!res.ok) throw new Error(data.error || 'Signup failed');

                    login(data.token, data.user);
                    onClose();
                } catch (err: any) {
                    setError(err.message);
                }
            }
        }
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        resetForm();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#1e1e1e] p-6 rounded-xl border border-gray-700 w-full max-w-md relative shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <X size={20} />
                </button>

                <h2 className="text-2xl font-bold mb-6 text-white">
                    {isLogin ? 'Welcome Back' : (step === 1 ? 'Create Account' : 'Choose Display Name')}
                </h2>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Step 1: Email & Password (Always shown for login, shown for step 1 signup) */}
                    {(isLogin || step === 1) && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                    required
                                    placeholder="name@example.com"
                                    autoComplete="off"
                                    name="email_off"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                    required
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    name="password_off"
                                />
                            </div>
                        </>
                    )}

                    {/* Step 2: Display Name (Only for Signup Step 2) */}
                    {(!isLogin && step === 2) && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Display Name</label>
                            <div className="text-xs text-gray-500 mb-2">This is how you will appear on leaderboards.</div>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                autoFocus
                                required
                                placeholder="e.g. FPLManager2025"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-colors"
                    >
                        {isLogin ? 'Login' : (step === 1 ? 'Next' : 'Create Account')}
                    </button>

                    {(!isLogin && step === 2) && (
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 rounded-lg transition-colors mt-2"
                        >
                            Back
                        </button>
                    )}
                </form>

                <div className="mt-4 text-center text-sm text-gray-400">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        onClick={toggleMode}
                        className="text-blue-400 hover:underline"
                    >
                        {isLogin ? 'Sign up' : 'Login'}
                    </button>
                </div>
            </div>
        </div>
    );
};
