import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Shield, Calendar, Activity, Trophy, Shirt, LogIn, User as UserIcon, LineChart, Tag, Workflow, BookOpen, HelpCircle, CircleUserRound, Mail, Leaf, FlaskConical, Bot, Lock } from 'lucide-react';
import type { Event } from '../types/fpl';
import { LoginModal } from './LoginModal';
import ManagerDNAQuiz from './ManagerDNAQuiz';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
    children: React.ReactNode;
    currentGameweek?: Event;
}

const Layout: React.FC<LayoutProps> = ({ children, currentGameweek }) => {
    const navigate = useNavigate();
    const { user, logout, token, fplEntryId, fplConnected, loginGlow, showFplConnectedModal, dismissFplConnectedModal, showFplDisconnectedToast, dismissFplDisconnectedToast, isLoginOpen, setIsLoginOpen, isVerified } = useAuth();
    const [showDNAQuiz, setShowDNAQuiz] = useState(false);

    useEffect(() => {
        // Only show quiz if verified, FPL connected, and no DNA set yet
        if (isVerified && fplConnected && user && !user.manager_dna) {
            const timer = setTimeout(() => setShowDNAQuiz(true), 1500);
            return () => clearTimeout(timer);
        } else {
            // Hide immediately if DNA is now available (handles race with async profile load)
            setShowDNAQuiz(false);
        }
    }, [isVerified, fplConnected, user?.manager_dna]);

    const handleFplConnectedDismiss = async () => {
        dismissFplConnectedModal();
        let entryId = fplEntryId;
        if (!entryId && token) {
            try {
                const r = await fetch('/api/fpl/status', { headers: { Authorization: `Bearer ${token}` } });
                if (r.ok) { const d = await r.json(); entryId = d.fpl_entry_id; }
            } catch { }
        }
        navigate(entryId ? `/analyse?entry=${entryId}` : '/analyse');
    };

    const navItems = [
        { path: '/', label: 'Home', icon: LayoutDashboard },
        { path: '/analyse', label: 'Analyse', icon: LineChart },
        { path: '/autopilot', label: 'Auto-Pilot', icon: Bot },
        { path: '/my-teams', label: 'My Teams', icon: Shirt },
        { path: '/pricing', label: 'Pricing', icon: Tag },
        { path: '/players', label: 'Players', icon: Users },
        { path: '/lab', label: 'Lab', icon: FlaskConical },
        { path: '/teams', label: 'Teams', icon: Shield },
        { path: '/fixtures', label: 'Fixtures', icon: Calendar },
        { path: '/gameweek', label: 'Gameweek', icon: Activity },
        { path: '/standings', label: 'Standings', icon: Trophy },
        { path: '/my-account', label: 'My Account', icon: CircleUserRound },
        { path: '/setup', label: 'Setup', icon: Workflow },
        { path: '/how-it-works', label: 'How It Works', icon: BookOpen },
        { path: '/faq', label: 'FAQ', icon: HelpCircle },
        { path: '/contact', label: 'Contact', icon: Mail },
        { path: '/carbon', label: 'Carbon', icon: Leaf },
    ] as const;

    return (
        <div className="min-h-screen bg-[url('https://resources.premierleague.com/premierleague/photo/2023/12/22/a894560a-0490-449e-8798-7c050a490ca9/pl-background.png')] bg-fixed bg-cover bg-center bg-no-repeat bg-slate-950 attachment-fixed text-white font-sans">
            <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
            {showDNAQuiz && !user?.manager_dna && <ManagerDNAQuiz onClose={() => setShowDNAQuiz(false)} />}

            {/* FPL Connected Modal */}
            {showFplConnectedModal && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" onClick={handleFplConnectedDismiss}>
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
                    <div
                        className="relative flex flex-col items-center gap-6 bg-slate-950 border-2 border-[#00ff87] rounded-3xl px-10 py-12 shadow-[0_0_60px_#00ff87,0_0_120px_rgba(0,255,135,0.3)] max-w-sm w-full text-center animate-in zoom-in-95 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Pulsing glow ring */}
                        <div className="absolute inset-0 rounded-3xl border-2 border-[#00ff87] animate-ping opacity-20 pointer-events-none" />

                        {/* Icon */}
                        <div className="w-20 h-20 rounded-full bg-[#00ff87]/10 border-2 border-[#00ff87] flex items-center justify-center shadow-[0_0_30px_#00ff87]">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00ff87" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>

                        <div>
                            <p className="text-[#00ff87] text-xs font-black uppercase tracking-[0.2em] mb-2">FPL Account</p>
                            <h2 className="text-white text-3xl font-black tracking-tight">Connected</h2>
                            <p className="text-slate-400 text-sm mt-3">Your FPL account is now linked.<br />The Wolf has access to your team.</p>
                        </div>

                        <button
                            onClick={handleFplConnectedDismiss}
                            className="w-full py-3 rounded-xl bg-[#00ff87] text-slate-900 font-black text-sm tracking-wide hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,255,135,0.4)]"
                        >
                            {fplEntryId ? 'Load My Team →' : "Let's Go"}
                        </button>
                    </div>
                </div>
            )}

            {/* FPL Disconnected Modal */}
            {showFplDisconnectedToast && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" onClick={dismissFplDisconnectedToast}>
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
                    <div
                        className="relative flex flex-col items-center gap-6 bg-slate-950 border-2 border-red-500 rounded-3xl px-10 py-12 shadow-[0_0_60px_rgba(239,68,68,0.8),0_0_120px_rgba(239,68,68,0.3)] max-w-sm w-full text-center animate-in zoom-in-95 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Pulsing glow ring */}
                        <div className="absolute inset-0 rounded-3xl border-2 border-red-500 animate-ping opacity-20 pointer-events-none" />

                        {/* Icon */}
                        <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.6)]">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                        </div>

                        <div>
                            <p className="text-red-500 text-xs font-black uppercase tracking-[0.2em] mb-2">FPL Account</p>
                            <h2 className="text-white text-3xl font-black tracking-tight">Disconnected</h2>
                            <p className="text-slate-400 text-sm mt-3">Your FPL account has been unlinked.<br />Log into FPL to reconnect automatically.</p>
                        </div>

                        <button
                            onClick={dismissFplDisconnectedToast}
                            className="w-full py-3 rounded-xl bg-red-500 text-white font-black text-sm tracking-wide hover:brightness-110 transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                        >
                            Got It
                        </button>
                    </div>
                </div>
            )}

            {/* Overlay */}
            <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-0 pointer-events-none" />

            <div className="relative z-10 flex min-h-screen">
                {/* Sidebar */}
                <aside className="hidden md:flex flex-col w-80 border-r border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 h-screen overflow-y-auto">
                    <div className="p-6 border-b border-slate-800/50">
                        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00ff87] to-[#02efff]">
                            FantasyPremierWolf
                        </h1>
                        <p className="text-xs text-[#02efff] mt-1 uppercase tracking-widest font-bold">Alpha Strategy Tool</p>
                    </div>

                    <nav className="flex-1 p-4 space-y-2">
                        {navItems.map((item) => {
                            const isAutopilotLocked = item.label === 'Auto-Pilot' && (user?.membership_tier ?? 0) < 3;
                            return (
                                <React.Fragment key={item.path}>
                                    {(item.label === 'Players' || item.label === 'My Account') && (
                                        <div className="mx-4 my-2 border-t border-slate-700/50" />
                                    )}
                                    <NavLink
                                        to={item.path}
                                        className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                            ? 'bg-fpl-green text-slate-900 shadow-lg shadow-fpl-green/20 font-bold'
                                            : 'text-gray-400 hover:text-white hover:bg-slate-800'
                                            }`}
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <item.icon size={20} className={`${isActive ? 'text-slate-900' : 'group-hover:text-fpl-green transition-colors'}`} />
                                                <span className="font-semibold flex-1">{item.label}</span>
                                                {isAutopilotLocked && (
                                                    <Lock size={13} className={`shrink-0 ${isActive ? 'text-slate-900/60' : 'text-gray-600'}`} />
                                                )}
                                                {item.label === 'Auto-Pilot' && user?.autopilot_enabled && (
                                                    <span className="relative flex h-3 w-3 shrink-0">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff87] opacity-90" />
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff87] opacity-60 animation-delay-150" />
                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00ff87]" />
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </NavLink>
                                </React.Fragment>
                            );
                        })}
                    </nav>

                    <div className="p-4 space-y-4 border-t border-slate-800/50 bg-slate-900/30">
                        {/* Auth Section */}
                        {user ? (
                            <div className={`rounded-lg p-3 border flex items-center justify-between transition-all duration-700 ${loginGlow
                                ? 'bg-green-950/40 border-[#00ff87] shadow-[0_0_18px_rgba(0,255,135,0.45)]'
                                : fplConnected
                                    ? 'bg-green-950/30 border-green-800/50'
                                    : 'bg-slate-800/50 border-slate-700/50'
                                }`}>
                                <div className="flex items-center gap-3">
                                    <NavLink to="/my-account" className="bg-blue-600/20 hover:bg-blue-600/40 p-2 rounded-full text-blue-400 transition-colors">
                                        <UserIcon size={16} />
                                    </NavLink>
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase font-bold">Logged in as</div>
                                        <div className="text-sm font-bold text-white max-w-[120px] truncate" title={user.displayname}>{user.displayname}</div>
                                        {fplConnected && <div className="text-xs text-green-400 font-semibold">FPL Connected ✓</div>}
                                    </div>
                                </div>
                                <button
                                    onClick={logout}
                                    className="p-2 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                                    title="Logout"
                                >
                                    <LogIn size={18} className="rotate-180" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsLoginOpen(true)}
                                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold transition-all shadow-lg shadow-blue-600/20"
                            >
                                <LogIn size={18} />
                                <span>Login / Sign Up</span>
                            </button>
                        )}

                        <div className="pt-2 border-t border-slate-800/50">
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-bold">{currentGameweek?.is_next ? 'Next Gameweek' : 'Current Gameweek'}</div>
                            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                                <div className="text-lg font-bold text-white mb-1">
                                    {currentGameweek?.name || 'Pre-Season'}
                                </div>
                                <div className="text-xs text-gray-400">
                                    {currentGameweek?.deadline_time
                                        ? `Deadline: ${new Date(currentGameweek.deadline_time).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                                        : 'Date TBD'}
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Mobile Header (visible only on small screens) */}
                {/* For simplicity we will stick to basic rendering first, can enhance mobile later */}

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto h-screen scroll-smooth">
                    {/* Sticky Banner Wrapper */}
                    <div className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
                        <div className="max-w-7xl mx-auto p-4 md:p-8 pb-4 md:pb-6 flex items-center justify-between gap-4">
                            {/* Top Banner */}
                            <div className="flex-1 rounded-2xl overflow-hidden shadow-[0_0_25px_rgba(0,255,135,0.2)] border border-white/10">
                                <img
                                    src="/banner.png"
                                    alt="FantasyPremierWolf Banner"
                                    className="w-full h-auto object-cover max-h-32"
                                />
                            </div>
                            {/* Mobile Auth Button (Visible only on mobile/tablet) */}
                            <div className="md:hidden">
                                {user ? (
                                    <button onClick={logout} className="p-2 bg-slate-800 text-red-400 rounded-lg"><LogIn size={20} className="rotate-180" /></button>
                                ) : (
                                    <button onClick={() => setIsLoginOpen(true)} className="p-2 bg-blue-600 text-white rounded-lg"><LogIn size={20} /></button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="max-w-7xl mx-auto p-4 md:p-8 pt-6 md:pt-8">
                        {/* Page Header placeholder if needed, mostly handled by views */}
                        <div className="mb-8 md:hidden">
                            <h1 className="text-3xl font-black text-white">FantasyPremierWolf</h1>
                        </div>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
