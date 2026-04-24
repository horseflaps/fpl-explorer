import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { track } from '../utils/analytics';
import { X, LogIn, UserPlus, ChevronRight, ChevronLeft, Mail, CheckCircle } from 'lucide-react';

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
    const [countrySelected, setCountrySelected] = useState('');
    const [error, setError] = useState('');
    const [emailTaken, setEmailTaken] = useState(false);
    const [awaitingVerification, setAwaitingVerification] = useState(false);
    const [loginSuccess, setLoginSuccess] = useState(false);

    // Forgot / reset password state
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotSent, setForgotSent] = useState(false);
    const [forgotError, setForgotError] = useState('');
    const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('reset_token') || '');
    const [newPassword, setNewPassword] = useState('');
    const [resetDone, setResetDone] = useState(false);
    const [resetError, setResetError] = useState('');

    const { login } = useAuth();

    React.useEffect(() => {
        if (isOpen) resetForm();
    }, [isOpen]);

    const resetForm = () => {
        setError('');
        setEmail('');
        setPassword('');
        setDisplayName('');
        setCountrySelected('');
        setEmailTaken(false);
        setAwaitingVerification(false);
        setStep(1);
        setForgotMode(false);
        setForgotEmail('');
        setForgotSent(false);
        setForgotError('');
    };

    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotError('');
        try {
            await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: forgotEmail.trim() }),
            });
            setForgotSent(true);
        } catch {
            setForgotError('Something went wrong. Please try again.');
        }
    };

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetError('');
        if (newPassword.length < 6) { setResetError('Password must be at least 6 characters'); return; }
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: resetToken, password: newPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Reset failed');
            setResetDone(true);
            // Remove reset_token from URL without reload
            const url = new URL(window.location.href);
            url.searchParams.delete('reset_token');
            window.history.replaceState({}, '', url.toString());
        } catch (err: any) {
            setResetError(err.message);
        }
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
                track('User Logged In', { method: 'email' });
                setLoginSuccess(true);
                setTimeout(onClose, 1800);
            } catch (err: any) {
                setError(err.message);
            }
        } else {
            if (step === 1) {
                if (!email || !password) { setError('Please fill in all fields'); return; }
                if (!email.includes('@') || !email.includes('.')) { setError('Please enter a valid email address'); return; }
                if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
                setStep(2);
            } else {
                if (!displayName.trim()) { setError('Display Name is required'); return; }
                try {
                    const res = await fetch('/api/auth/signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: email.trim(), password, display_name: displayName.trim(), country_selected: countrySelected || null }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Signup failed');
                    login(data.token, data.user);
                    track('User Signed Up', { method: 'email' });
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

    /* ── RESET PASSWORD (from email link) ── */
    if (resetToken && isOpen) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 border border-fpl-green/30 rounded-2xl w-full max-w-sm relative shadow-[0_0_40px_rgba(0,255,135,0.08)]">
                    <div className="h-1 bg-gradient-to-r from-fpl-green to-[#02efff] rounded-t-2xl" />
                    <div className="p-7">
                        <button onClick={onClose} className="absolute top-5 right-5 text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
                        <div className="flex items-center gap-3 mb-7">
                            <div className="w-10 h-10 bg-fpl-green/10 border border-fpl-green/30 rounded-xl flex items-center justify-center">
                                <LogIn className="text-fpl-green w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white leading-none">Set New Password</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Choose a new password for your account</p>
                            </div>
                        </div>
                        {resetDone ? (
                            <div className="text-center py-4">
                                <CheckCircle className="text-fpl-green w-10 h-10 mx-auto mb-3" />
                                <p className="text-white font-bold">Password updated!</p>
                                <p className="text-gray-400 text-xs mt-1 mb-4">You can now sign in with your new password.</p>
                                <button onClick={() => { setForgotMode(false); }} className="text-fpl-green text-sm underline" type="button">Sign in</button>
                            </div>
                        ) : (
                            <form onSubmit={handleResetSubmit} className="space-y-4">
                                {resetError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs">{resetError}</div>}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">New Password</label>
                                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-fpl-green/60 focus:ring-1 focus:ring-fpl-green/20 transition-all placeholder:text-gray-600" required placeholder="Min. 6 characters" autoComplete="new-password" />
                                </div>
                                <button type="submit" className="w-full bg-fpl-green hover:bg-fpl-green/90 text-slate-900 font-black text-sm uppercase tracking-wider py-3 rounded-xl transition-all active:scale-95 mt-2">Update Password</button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    /* ── LOGIN SUCCESS ── */
    if (loginSuccess) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 border border-fpl-green/30 rounded-2xl w-full max-w-sm relative shadow-[0_0_40px_rgba(0,255,135,0.15)] text-center">
                    <div className="h-1 bg-gradient-to-r from-fpl-green to-[#02efff] rounded-t-2xl" />
                    <div className="p-8 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-fpl-green/10 border border-fpl-green/30 rounded-2xl flex items-center justify-center">
                            <CheckCircle className="text-fpl-green w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white">Welcome back</h2>
                            <p className="text-gray-400 text-sm mt-1">You're signed in successfully.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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

                        {forgotMode ? (
                            forgotSent ? (
                                <div className="text-center py-2">
                                    <Mail className="text-fpl-green w-10 h-10 mx-auto mb-3" />
                                    <p className="text-white font-bold">Check your inbox</p>
                                    <p className="text-gray-400 text-xs mt-2 mb-4">If an account exists for <span className="text-white font-semibold">{forgotEmail}</span>, a reset link has been sent.</p>
                                    <button type="button" onClick={() => setForgotMode(false)} className="text-fpl-green text-sm underline">Back to sign in</button>
                                </div>
                            ) : (
                                <>
                                    {forgotError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-xs">{forgotError}</div>}
                                    <p className="text-xs text-gray-400 mb-4">Enter your email and we'll send you a reset link.</p>
                                    <form onSubmit={handleForgotSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Email</label>
                                            <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-fpl-green/60 focus:ring-1 focus:ring-fpl-green/20 transition-all placeholder:text-gray-600" required placeholder="name@example.com" />
                                        </div>
                                        <button type="submit" className="w-full bg-fpl-green hover:bg-fpl-green/90 text-slate-900 font-black text-sm uppercase tracking-wider py-3 rounded-xl transition-all active:scale-95">Send Reset Link</button>
                                    </form>
                                    <button type="button" onClick={() => setForgotMode(false)} className="mt-4 w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors py-1">
                                        <ChevronLeft size={14} /> Back to sign in
                                    </button>
                                </>
                            )
                        ) : (
                            <>
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

                                <button
                                    type="button"
                                    onClick={() => { setForgotMode(true); setForgotEmail(email); setForgotError(''); setForgotSent(false); }}
                                    className="mt-3 w-full text-center text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                >
                                    Forgot your password?
                                </button>
                            </>
                        )}

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
                                        type="text"
                                        inputMode="email"
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
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Country</label>
                                    <select
                                        value={countrySelected}
                                        onChange={(e) => setCountrySelected(e.target.value)}
                                        className="w-full bg-[#1a0028]/80 border border-[#37003c] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#e90052]/60 focus:ring-1 focus:ring-[#e90052]/20 transition-all"
                                    >
                                        <option value="">Select your country</option>
                                        <option value="GB">🇬🇧 United Kingdom</option>
                                        <option value="IE">🇮🇪 Ireland</option>
                                        <option disabled>──────────</option>
                                        <option value="AF">🇦🇫 Afghanistan</option>
                                        <option value="AX">🇦🇽 Åland Islands</option>
                                        <option value="AL">🇦🇱 Albania</option>
                                        <option value="DZ">🇩🇿 Algeria</option>
                                        <option value="AS">🇦🇸 American Samoa</option>
                                        <option value="AD">🇦🇩 Andorra</option>
                                        <option value="AO">🇦🇴 Angola</option>
                                        <option value="AI">🇦🇮 Anguilla</option>
                                        <option value="AQ">🇦🇶 Antarctica</option>
                                        <option value="AG">🇦🇬 Antigua and Barbuda</option>
                                        <option value="AR">🇦🇷 Argentina</option>
                                        <option value="AM">🇦🇲 Armenia</option>
                                        <option value="AW">🇦🇼 Aruba</option>
                                        <option value="AU">🇦🇺 Australia</option>
                                        <option value="AT">🇦🇹 Austria</option>
                                        <option value="AZ">🇦🇿 Azerbaijan</option>
                                        <option value="BS">🇧🇸 Bahamas</option>
                                        <option value="BH">🇧🇭 Bahrain</option>
                                        <option value="BD">🇧🇩 Bangladesh</option>
                                        <option value="BB">🇧🇧 Barbados</option>
                                        <option value="BY">🇧🇾 Belarus</option>
                                        <option value="BE">🇧🇪 Belgium</option>
                                        <option value="BZ">🇧🇿 Belize</option>
                                        <option value="BJ">🇧🇯 Benin</option>
                                        <option value="BM">🇧🇲 Bermuda</option>
                                        <option value="BT">🇧🇹 Bhutan</option>
                                        <option value="BO">🇧🇴 Bolivia</option>
                                        <option value="BA">🇧🇦 Bosnia and Herzegovina</option>
                                        <option value="BW">🇧🇼 Botswana</option>
                                        <option value="BV">🇧🇻 Bouvet Island</option>
                                        <option value="BR">🇧🇷 Brazil</option>
                                        <option value="IO">🇮🇴 British Indian Ocean Territory</option>
                                        <option value="BN">🇧🇳 Brunei Darussalam</option>
                                        <option value="BG">🇧🇬 Bulgaria</option>
                                        <option value="BF">🇧🇫 Burkina Faso</option>
                                        <option value="BI">🇧🇮 Burundi</option>
                                        <option value="CV">🇨🇻 Cabo Verde</option>
                                        <option value="KH">🇰🇭 Cambodia</option>
                                        <option value="CM">🇨🇲 Cameroon</option>
                                        <option value="CA">🇨🇦 Canada</option>
                                        <option value="KY">🇰🇾 Cayman Islands</option>
                                        <option value="CF">🇨🇫 Central African Republic</option>
                                        <option value="TD">🇹🇩 Chad</option>
                                        <option value="CL">🇨🇱 Chile</option>
                                        <option value="CN">🇨🇳 China</option>
                                        <option value="CX">🇨🇽 Christmas Island</option>
                                        <option value="CC">🇨🇨 Cocos (Keeling) Islands</option>
                                        <option value="CO">🇨🇴 Colombia</option>
                                        <option value="KM">🇰🇲 Comoros</option>
                                        <option value="CG">🇨🇬 Congo</option>
                                        <option value="CD">🇨🇩 Congo (Democratic Republic of the)</option>
                                        <option value="CK">🇨🇰 Cook Islands</option>
                                        <option value="CR">🇨🇷 Costa Rica</option>
                                        <option value="CI">🇨🇮 Côte d'Ivoire</option>
                                        <option value="HR">🇭🇷 Croatia</option>
                                        <option value="CU">🇨🇺 Cuba</option>
                                        <option value="CW">🇨🇼 Curaçao</option>
                                        <option value="CY">🇨🇾 Cyprus</option>
                                        <option value="CZ">🇨🇿 Czechia</option>
                                        <option value="DK">🇩🇰 Denmark</option>
                                        <option value="DJ">🇩🇯 Djibouti</option>
                                        <option value="DM">🇩🇲 Dominica</option>
                                        <option value="DO">🇩🇴 Dominican Republic</option>
                                        <option value="EC">🇪🇨 Ecuador</option>
                                        <option value="EG">🇪🇬 Egypt</option>
                                        <option value="SV">🇸🇻 El Salvador</option>
                                        <option value="GQ">🇬🇶 Equatorial Guinea</option>
                                        <option value="ER">🇪🇷 Eritrea</option>
                                        <option value="EE">🇪🇪 Estonia</option>
                                        <option value="SZ">🇸🇿 Eswatini</option>
                                        <option value="ET">🇪🇹 Ethiopia</option>
                                        <option value="FK">🇫🇰 Falkland Islands</option>
                                        <option value="FO">🇫🇴 Faroe Islands</option>
                                        <option value="FJ">🇫🇯 Fiji</option>
                                        <option value="FI">🇫🇮 Finland</option>
                                        <option value="FR">🇫🇷 France</option>
                                        <option value="GF">🇬🇫 French Guiana</option>
                                        <option value="PF">🇵🇫 French Polynesia</option>
                                        <option value="TF">🇹🇫 French Southern Territories</option>
                                        <option value="GA">🇬🇦 Gabon</option>
                                        <option value="GM">🇬🇲 Gambia</option>
                                        <option value="GE">🇬🇪 Georgia</option>
                                        <option value="DE">🇩🇪 Germany</option>
                                        <option value="GH">🇬🇭 Ghana</option>
                                        <option value="GI">🇬🇮 Gibraltar</option>
                                        <option value="GR">🇬🇷 Greece</option>
                                        <option value="GL">🇬🇱 Greenland</option>
                                        <option value="GD">🇬🇩 Grenada</option>
                                        <option value="GP">🇬🇵 Guadeloupe</option>
                                        <option value="GU">🇬🇺 Guam</option>
                                        <option value="GT">🇬🇹 Guatemala</option>
                                        <option value="GG">🇬🇬 Guernsey</option>
                                        <option value="GN">🇬🇳 Guinea</option>
                                        <option value="GW">🇬🇼 Guinea-Bissau</option>
                                        <option value="GY">🇬🇾 Guyana</option>
                                        <option value="HT">🇭🇹 Haiti</option>
                                        <option value="HM">🇭🇲 Heard Island and McDonald Islands</option>
                                        <option value="VA">🇻🇦 Holy See</option>
                                        <option value="HN">🇭🇳 Honduras</option>
                                        <option value="HK">🇭🇰 Hong Kong</option>
                                        <option value="HU">🇭🇺 Hungary</option>
                                        <option value="IS">🇮🇸 Iceland</option>
                                        <option value="IN">🇮🇳 India</option>
                                        <option value="ID">🇮🇩 Indonesia</option>
                                        <option value="IR">🇮🇷 Iran</option>
                                        <option value="IQ">🇮🇶 Iraq</option>
                                        <option value="IE">🇮🇪 Ireland</option>
                                        <option value="IM">🇮🇲 Isle of Man</option>
                                        <option value="IL">🇮🇱 Israel</option>
                                        <option value="IT">🇮🇹 Italy</option>
                                        <option value="JM">🇯🇲 Jamaica</option>
                                        <option value="JP">🇯🇵 Japan</option>
                                        <option value="JE">🇯🇪 Jersey</option>
                                        <option value="JO">🇯🇴 Jordan</option>
                                        <option value="KZ">🇰🇿 Kazakhstan</option>
                                        <option value="KE">🇰🇪 Kenya</option>
                                        <option value="KI">🇰🇮 Kiribati</option>
                                        <option value="KP">🇰🇵 Korea (Democratic People's Republic of)</option>
                                        <option value="KR">🇰🇷 Korea (Republic of)</option>
                                        <option value="KW">🇰🇼 Kuwait</option>
                                        <option value="KG">🇰🇬 Kyrgyzstan</option>
                                        <option value="LA">🇱🇦 Lao People's Democratic Republic</option>
                                        <option value="LV">🇱🇻 Latvia</option>
                                        <option value="LB">🇱🇧 Lebanon</option>
                                        <option value="LS">🇱🇸 Lesotho</option>
                                        <option value="LR">🇱🇷 Liberia</option>
                                        <option value="LY">🇱🇾 Libya</option>
                                        <option value="LI">🇱🇮 Liechtenstein</option>
                                        <option value="LT">🇱🇹 Lithuania</option>
                                        <option value="LU">🇱🇺 Luxembourg</option>
                                        <option value="MO">🇲🇴 Macao</option>
                                        <option value="MG">🇲🇬 Madagascar</option>
                                        <option value="MW">🇲🇼 Malawi</option>
                                        <option value="MY">🇲🇾 Malaysia</option>
                                        <option value="MV">🇲🇻 Maldives</option>
                                        <option value="ML">🇲🇱 Mali</option>
                                        <option value="MT">🇲🇹 Malta</option>
                                        <option value="MH">🇲🇭 Marshall Islands</option>
                                        <option value="MQ">🇲🇶 Martinique</option>
                                        <option value="MR">🇲🇷 Mauritania</option>
                                        <option value="MU">🇲🇺 Mauritius</option>
                                        <option value="YT">🇾🇹 Mayotte</option>
                                        <option value="MX">🇲🇽 Mexico</option>
                                        <option value="FM">🇫🇲 Micronesia (Federated States of)</option>
                                        <option value="MD">🇲🇩 Moldova</option>
                                        <option value="MC">🇲🇨 Monaco</option>
                                        <option value="MN">🇲🇳 Mongolia</option>
                                        <option value="ME">🇲🇪 Montenegro</option>
                                        <option value="MS">🇲🇸 Montserrat</option>
                                        <option value="MA">🇲🇦 Morocco</option>
                                        <option value="MZ">🇲🇿 Mozambique</option>
                                        <option value="MM">🇲🇲 Myanmar</option>
                                        <option value="NA">🇳🇦 Namibia</option>
                                        <option value="NR">🇳🇷 Nauru</option>
                                        <option value="NP">🇳🇵 Nepal</option>
                                        <option value="NL">🇳🇱 Netherlands</option>
                                        <option value="NC">🇳🇨 New Caledonia</option>
                                        <option value="NZ">🇳🇿 New Zealand</option>
                                        <option value="NI">🇳🇮 Nicaragua</option>
                                        <option value="NE">🇳🇪 Niger</option>
                                        <option value="NG">🇳🇬 Nigeria</option>
                                        <option value="NU">🇳🇺 Niue</option>
                                        <option value="NF">🇳🇫 Norfolk Island</option>
                                        <option value="MK">🇲🇰 North Macedonia</option>
                                        <option value="MP">🇲🇵 Northern Mariana Islands</option>
                                        <option value="NO">🇳🇴 Norway</option>
                                        <option value="OM">🇴🇲 Oman</option>
                                        <option value="PK">🇵🇰 Pakistan</option>
                                        <option value="PW">🇵🇼 Palau</option>
                                        <option value="PS">🇵🇸 Palestine, State of</option>
                                        <option value="PA">🇵🇦 Panama</option>
                                        <option value="PG">🇵🇬 Papua New Guinea</option>
                                        <option value="PY">🇵🇾 Paraguay</option>
                                        <option value="PE">🇵🇪 Peru</option>
                                        <option value="PH">🇵🇭 Philippines</option>
                                        <option value="PN">🇵🇳 Pitcairn</option>
                                        <option value="PL">🇵🇱 Poland</option>
                                        <option value="PT">🇵🇹 Portugal</option>
                                        <option value="PR">🇵🇷 Puerto Rico</option>
                                        <option value="QA">🇶🇦 Qatar</option>
                                        <option value="RE">🇷🇪 Réunion</option>
                                        <option value="RO">🇷🇴 Romania</option>
                                        <option value="RU">🇷🇺 Russian Federation</option>
                                        <option value="RW">🇷🇼 Rwanda</option>
                                        <option value="BL">🇧🇱 Saint Barthélemy</option>
                                        <option value="SH">🇸🇭 Saint Helena</option>
                                        <option value="KN">🇰🇳 Saint Kitts and Nevis</option>
                                        <option value="LC">🇱🇨 Saint Lucia</option>
                                        <option value="MF">🇲🇫 Saint Martin</option>
                                        <option value="PM">🇵🇲 Saint Pierre and Miquelon</option>
                                        <option value="VC">🇻🇨 Saint Vincent and the Grenadines</option>
                                        <option value="WS">🇼🇸 Samoa</option>
                                        <option value="SM">🇸🇲 San Marino</option>
                                        <option value="ST">🇸🇹 Sao Tome and Principe</option>
                                        <option value="SA">🇸🇦 Saudi Arabia</option>
                                        <option value="SN">🇸🇳 Senegal</option>
                                        <option value="RS">🇷🇸 Serbia</option>
                                        <option value="SC">🇸🇨 Seychelles</option>
                                        <option value="SL">🇸🇱 Sierra Leone</option>
                                        <option value="SG">🇸🇬 Singapore</option>
                                        <option value="SX">🇸🇽 Sint Maarten</option>
                                        <option value="SK">🇸🇰 Slovakia</option>
                                        <option value="SI">🇸🇮 Slovenia</option>
                                        <option value="SB">🇸🇧 Solomon Islands</option>
                                        <option value="SO">🇸🇴 Somalia</option>
                                        <option value="ZA">🇿🇦 South Africa</option>
                                        <option value="GS">🇬🇸 South Georgia and the South Sandwich Islands</option>
                                        <option value="SS">🇸🇸 South Sudan</option>
                                        <option value="ES">🇪🇸 Spain</option>
                                        <option value="LK">🇱🇰 Sri Lanka</option>
                                        <option value="SD">🇸🇩 Sudan</option>
                                        <option value="SR">🇸🇷 Suriname</option>
                                        <option value="SJ">🇸🇯 Svalbard and Jan Mayen</option>
                                        <option value="SE">🇸🇪 Sweden</option>
                                        <option value="CH">🇨🇭 Switzerland</option>
                                        <option value="SY">🇸🇾 Syrian Arab Republic</option>
                                        <option value="TW">🇹🇼 Taiwan</option>
                                        <option value="TJ">🇹🇯 Tajikistan</option>
                                        <option value="TZ">🇹🇿 Tanzania</option>
                                        <option value="TH">🇹🇭 Thailand</option>
                                        <option value="TL">🇹🇱 Timor-Leste</option>
                                        <option value="TG">🇹🇬 Togo</option>
                                        <option value="TK">🇹🇰 Tokelau</option>
                                        <option value="TO">🇹🇴 Tonga</option>
                                        <option value="TT">🇹🇹 Trinidad and Tobago</option>
                                        <option value="TN">🇹🇳 Tunisia</option>
                                        <option value="TR">🇹🇷 Turkey</option>
                                        <option value="TM">🇹🇲 Turkmenistan</option>
                                        <option value="TC">🇹🇨 Turks and Caicos Islands</option>
                                        <option value="TV">🇹🇻 Tuvalu</option>
                                        <option value="UG">🇺🇬 Uganda</option>
                                        <option value="UA">🇺🇦 Ukraine</option>
                                        <option value="AE">🇦🇪 United Arab Emirates</option>
                                        <option value="GB">🇬🇧 United Kingdom</option>
                                        <option value="US">🇺🇸 United States</option>
                                        <option value="UM">🇺🇲 United States Minor Outlying Islands</option>
                                        <option value="UY">🇺🇾 Uruguay</option>
                                        <option value="UZ">🇺🇿 Uzbekistan</option>
                                        <option value="VU">🇻🇺 Vanuatu</option>
                                        <option value="VE">🇻🇪 Venezuela</option>
                                        <option value="VN">🇻🇳 Viet Nam</option>
                                        <option value="VG">🇻🇬 Virgin Islands (British)</option>
                                        <option value="VI">🇻🇮 Virgin Islands (U.S.)</option>
                                        <option value="WF">🇼🇫 Wallis and Futuna</option>
                                        <option value="EH">🇪🇭 Western Sahara</option>
                                        <option value="YE">🇾🇪 Yemen</option>
                                        <option value="ZM">🇿🇲 Zambia</option>
                                        <option value="ZW">🇿🇼 Zimbabwe</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    disabled={!countrySelected}
                                    className="w-full bg-[#e90052] hover:bg-[#e90052]/90 text-white font-black text-sm uppercase tracking-wider py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(233,0,82,0.25)] active:scale-95 mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
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
