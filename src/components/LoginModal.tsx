import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, LogIn, UserPlus, ChevronRight, ChevronLeft, Mail } from 'lucide-react';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [step, setStep] = useState(1);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState('');
    const [emailTaken, setEmailTaken] = useState(false);
    const [awaitingVerification, setAwaitingVerification] = useState(false);
    const { login } = useAuth();

    React.useEffect(() => {
        if (isOpen) resetForm();
    }, [isOpen]);

    const resetForm = () => {
        setError('');
        setEmail('');
        setPassword('');
        setDisplayName('');
        setEmailTaken(false);
        setAwaitingVerification(false);
        setStep(1);
    };

    const handleEmailBlur = async () => {
        if (!email || isLogin) return;
        try {
            const res = await fetch('/api/auth/check-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await res.json();
            setEmailTaken(data.taken);
        } catch {
            // silently ignore — server will catch it on submit
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (isLogin) {
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
            if (step === 1) {
                if (!email || !password) { setError('Please fill in all fields'); return; }
                if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
                setStep(2);
            } else {
                if (!displayName.trim()) { setError('Display Name is required'); return; }
                try {
                    const res = await fetch('/api/auth/signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: email.trim(), password, display_name: displayName.trim() }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Signup failed');
                    login(data.token, data.user);
                    setAwaitingVerification(true);
                } catch (err: any) {
                    setError(err.message);
                    if (err.message.includes('already registered')) setStep(1);
                }
            }
        }
    };

    const toggleMode = (preserveEmail = false) => {
        const savedEmail = email;
        setIsLogin(!isLogin);
        resetForm();
        if (preserveEmail) setEmail(savedEmail);
    };

    /* ── LOGIN MODAL ── */
    if (isLogin) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 border border-fpl-green/30 rounded-2xl w-full max-w-sm relative shadow-[0_0_40px_rgba(0,255,135,0.08)]">

                    {/* Green top bar */}
                    <div className="h-1 bg-gradient-to-r from-fpl-green to-[#02efff] rounded-t-2xl" />

                    <div className="p-7">
                        <button onClick={onClose} className="absolute top-5 right-5 text-gray-500 hover:text-white transition-colors">
                            <X size={18} />
                        </button>

                        {/* Header */}
                        <div className="flex items-center gap-3 mb-7">
                            <div className="w-10 h-10 bg-fpl-green/10 border border-fpl-green/30 rounded-xl flex items-center justify-center">
                                <LogIn className="text-fpl-green w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white leading-none">Welcome Back</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Sign in to your Wolf account</p>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-5 text-xs">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-fpl-green/60 focus:ring-1 focus:ring-fpl-green/20 transition-all placeholder:text-gray-600"
                                    required
                                    placeholder="name@example.com"
                                    autoComplete="off"
                                    name="email_off"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-fpl-green/60 focus:ring-1 focus:ring-fpl-green/20 transition-all placeholder:text-gray-600"
                                    required
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-fpl-green hover:bg-fpl-green/90 text-slate-900 font-black text-sm uppercase tracking-wider py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(0,255,135,0.2)] active:scale-95 mt-2"
                            >
                                Sign In
                            </button>
                        </form>

                        <p className="mt-5 text-center text-xs text-gray-500">
                            No account?{' '}
                            <button onClick={() => toggleMode()} className="text-fpl-green hover:underline font-semibold">
                                Create one free
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    /* ── AWAITING VERIFICATION ── */
    if (awaitingVerification) {
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-[#160020] border border-[#e90052]/30 rounded-2xl w-full max-w-sm relative shadow-[0_0_50px_rgba(233,0,82,0.12)] text-center">
                    <div className="h-1 bg-gradient-to-r from-[#e90052] to-[#37003c] rounded-t-2xl" />
                    <div className="p-8 flex flex-col items-center gap-5">
                        <div className="w-16 h-16 bg-[#e90052]/10 border border-[#e90052]/30 rounded-2xl flex items-center justify-center">
                            <Mail className="text-[#e90052] w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white">Check your inbox</h2>
                            <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                                We've sent an activation link to<br />
                                <span className="text-white font-semibold">{email}</span>
                            </p>
                            <p className="text-gray-600 text-xs mt-3">Click the link in the email to activate your account and unlock full access.</p>
                        </div>
                        <button onClick={onClose} className="w-full py-3 bg-[#e90052] hover:bg-[#e90052]/90 text-white font-black text-sm uppercase tracking-wider rounded-xl transition-all">
                            Got it
                        </button>
                        <p className="text-xs text-gray-600">Didn't receive it? Check your spam folder.</p>
                    </div>
                </div>
            </div>
        );
    }

    /* ── SIGN UP MODAL ── */
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#160020] border border-[#e90052]/30 rounded-2xl w-full max-w-sm relative shadow-[0_0_50px_rgba(233,0,82,0.12)]">

                {/* Pink top bar */}
                <div className="h-1 bg-gradient-to-r from-[#e90052] to-[#37003c] rounded-t-2xl" />

                <div className="p-7">
                    <button onClick={onClose} className="absolute top-5 right-5 text-gray-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-[#e90052]/10 border border-[#e90052]/30 rounded-xl flex items-center justify-center">
                            <UserPlus className="text-[#e90052] w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white leading-none">Join the Wolf</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Free account — takes 30 seconds</p>
                        </div>
                    </div>

                    {/* Step indicator */}
                    <div className="flex items-center gap-2 mb-6 mt-4">
                        <div className={`h-1 flex-1 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-[#e90052]' : 'bg-slate-700'}`} />
                        <div className={`h-1 flex-1 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-[#e90052]' : 'bg-slate-700'}`} />
                        <span className="text-xs text-gray-500 ml-1">{step}/2</span>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-5 text-xs">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {step === 1 && (
                            <>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setEmailTaken(false); }}
                                        onBlur={handleEmailBlur}
                                        className={`w-full bg-[#1a0028]/80 border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none transition-all placeholder:text-gray-700 ${emailTaken ? 'border-[#e90052] focus:border-[#e90052]' : 'border-[#37003c] focus:border-[#e90052]/60 focus:ring-1 focus:ring-[#e90052]/20'}`}
                                        required
                                        placeholder="name@example.com"
                                        autoComplete="off"
                                        name="email_off"
                                    />
                                    {emailTaken && (
                                        <p className="text-[#e90052] text-xs mt-1.5 flex items-center gap-1">
                                            Email already registered —{' '}
                                            <button type="button" onClick={() => toggleMode(true)} className="underline font-semibold">sign in instead?</button>
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-[#1a0028]/80 border border-[#37003c] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#e90052]/60 focus:ring-1 focus:ring-[#e90052]/20 transition-all placeholder:text-gray-700"
                                        required
                                        placeholder="Min. 6 characters"
                                        autoComplete="new-password"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={emailTaken}
                                    className="w-full bg-[#e90052] hover:bg-[#e90052]/90 text-white font-black text-sm uppercase tracking-wider py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(233,0,82,0.25)] active:scale-95 flex items-center justify-center gap-2 mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Continue <ChevronRight size={16} />
                                </button>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Display Name</label>
                                    <p className="text-xs text-gray-600 mb-2">How you'll appear on leaderboards.</p>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full bg-[#1a0028]/80 border border-[#37003c] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#e90052]/60 focus:ring-1 focus:ring-[#e90052]/20 transition-all placeholder:text-gray-700"
                                        autoFocus
                                        required
                                        placeholder="e.g. FPLManager2025"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-[#e90052] hover:bg-[#e90052]/90 text-white font-black text-sm uppercase tracking-wider py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(233,0,82,0.25)] active:scale-95 mt-2"
                                >
                                    Create Account
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setStep(1); setError(''); }}
                                    className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors py-2"
                                >
                                    <ChevronLeft size={14} /> Back
                                </button>
                            </>
                        )}
                    </form>

                    <p className="mt-5 text-center text-xs text-gray-500">
                        Already have an account?{' '}
                        <button onClick={() => toggleMode()} className="text-[#e90052] hover:underline font-semibold">
                            Sign in
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};
