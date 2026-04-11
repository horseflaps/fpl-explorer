import React, { useState, useEffect } from 'react';
import { CircleUserRound, Mail, Shield, CheckCircle2, XCircle, LogOut, Zap, Bot, Brain, Unlink, Coins, Dna, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ManagerDNAQuiz from './ManagerDNAQuiz';

const DNA_LABELS: Record<string, string> = {
    maverick: 'The Maverick',
    spreadsheet: 'The Spreadsheet Sage',
    template: 'The Template King',
    kneejerk: 'The Knee-jerker',
    eyetest: 'The Eye-Test Purist',
};

const MyAccountView: React.FC = () => {
    const { user, token, isVerified, fplConnected, fplEntryId, logout, refreshUser, forceStatusCheck, setIsLoginOpen } = useAuth();
    const [showDNAQuiz, setShowDNAQuiz] = useState(false);

    useEffect(() => { refreshUser(); }, []);
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    const handleDisconnect = async () => {
        setDisconnecting(true);
        try {
            await fetch('/api/fpl/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        } catch {}
        window.location.reload();
    };

    const tierInfo = [
        { tier: 1, label: 'Scout',    sub: 'Free',      icon: Zap,   color: 'text-gray-400' },
        { tier: 2, label: 'Co-Pilot', sub: '£5/mo',     icon: Bot,   color: 'text-[#02efff]' },
        { tier: 3, label: 'Autopilot',sub: '£10/mo',    icon: Brain, color: 'text-fpl-green' },
    ][( user?.membership_tier ?? 1) - 1];
    const [confirmLogout, setConfirmLogout] = useState(false);
    const [fplTeamName, setFplTeamName] = useState<string | null>(null);

    const [reconnecting, setReconnecting] = useState(false);
    const [reconnectMsg, setReconnectMsg] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

    useEffect(() => {
        if (!fplEntryId) return;
        fetch(`/api/fpl/entry/${fplEntryId}`)
            .then(r => r.json())
            .then(d => { if (d.name) setFplTeamName(d.name); })
            .catch(() => {});
    }, [fplEntryId]);

    useEffect(() => {
        if (fplConnected && reconnecting) {
            setReconnecting(false);
            setReconnectMsg(null);
        }
    }, [fplConnected, reconnecting]);

    const reconnectingRef = React.useRef(false);
    const handleReconnect = () => {
        reconnectingRef.current = true;
        setReconnecting(true);
        setReconnectMsg(null);

        const onResult = (e: Event) => {
            window.removeEventListener('fpw-reconnect-result', onResult);
            reconnectingRef.current = false;
            const detail = (e as CustomEvent).detail;
            if (!detail?.ok) {
                const noToken = detail?.error === 'No token stored' || detail?.error === 'no_fpw_token';
                setReconnectMsg({
                    type: 'error',
                    text: noToken
                        ? 'No FPL session found. Visit fantasy.premierleague.com while logged in, then try again.'
                        : `Connection failed: ${detail?.error || 'unknown error'}`
                });
                setReconnecting(false);
            } else {
                // Token sent — poll aggressively for 15s
                let polls = 0;
                const poll = setInterval(() => {
                    forceStatusCheck();
                    if (++polls >= 15) {
                        clearInterval(poll);
                        // If still not connected after 15s, the token may be expired
                        setReconnecting(prev => {
                            if (prev) {
                                setReconnectMsg({ type: 'error', text: 'Session may have expired. Visit fantasy.premierleague.com to refresh, then try again.' });
                            }
                            return false;
                        });
                    }
                }, 1000);
            }
        };
        window.addEventListener('fpw-reconnect-result', onResult);

        window.dispatchEvent(new CustomEvent('fpw-reconnect', { detail: { fpwToken: token } }));

        // Cleanup listener after 20s if no response
        setTimeout(() => {
            window.removeEventListener('fpw-reconnect-result', onResult);
            if (reconnectingRef.current) {
                reconnectingRef.current = false;
                setReconnecting(false);
                setReconnectMsg({ type: 'error', text: 'No response from extension. Make sure it is installed and active.' });
            }
        }, 20000);
    };

    if (!user) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-10 flex flex-col items-center gap-5 max-w-sm w-full text-center">
                <div className="w-14 h-14 bg-fpl-green/10 border border-fpl-green/30 rounded-2xl flex items-center justify-center">
                    <LogIn className="text-fpl-green w-7 h-7" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-white">Sign in required</h2>
                    <p className="text-gray-400 text-sm mt-1">You need an account to access this page.</p>
                </div>
                <button
                    onClick={() => setIsLoginOpen(true)}
                    className="w-full py-3 bg-fpl-green hover:bg-fpl-green/90 text-slate-900 font-black text-sm uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(0,255,135,0.2)]"
                >
                    Sign In / Sign Up
                </button>
            </div>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto pt-4 pb-16 px-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-600/20 border border-blue-600/30 rounded-2xl flex items-center justify-center">
                    <CircleUserRound className="text-blue-400 w-7 h-7" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">{user.displayname}</h1>
                    <p className="text-gray-400 text-sm">{user.email}</p>
                </div>
            </div>

            {/* Account details */}
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl divide-y divide-white/5">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <Mail className="text-gray-500 w-4 h-4" />
                        <span className="text-sm text-gray-400">Email</span>
                    </div>
                    <span className="text-sm text-white font-medium">{user.email}</span>
                </div>

                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <Shield className="text-gray-500 w-4 h-4" />
                        <span className="text-sm text-gray-400">Account status</span>
                    </div>
                    {isVerified ? (
                        <span className="flex items-center gap-1.5 text-sm text-fpl-green font-semibold">
                            <CheckCircle2 className="w-4 h-4" /> Activated
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-sm text-amber-400 font-semibold">
                            <XCircle className="w-4 h-4" /> Awaiting activation
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border-2 border-gray-500" />
                        <span className="text-sm text-gray-400">FPL connection</span>
                    </div>
                    {fplConnected ? (
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 text-sm text-fpl-green font-semibold">
                                <CheckCircle2 className="w-4 h-4" />
                                {fplTeamName ?? (fplEntryId ? `#${fplEntryId}` : '...')}
                            </span>
                            {confirmDisconnect ? (
                                <>
                                    <button onClick={() => setConfirmDisconnect(false)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-1">Cancel</button>
                                    <button onClick={handleDisconnect} disabled={disconnecting} className="text-xs text-orange-400 hover:text-orange-300 transition-colors px-1 disabled:opacity-50">
                                        {disconnecting ? '...' : 'Confirm'}
                                    </button>
                                </>
                            ) : (
                                <button onClick={() => setConfirmDisconnect(true)} className="text-gray-600 hover:text-orange-400 transition-colors" title="Disconnect">
                                    <Unlink size={13} />
                                </button>
                            )}
                        </div>
                    ) : fplEntryId ? (
                        <div className="flex flex-col items-end gap-1">
                            <button
                                disabled={reconnecting}
                                onClick={handleReconnect}
                                className="flex items-center gap-2 px-3 py-1.5 bg-fpl-green/10 hover:bg-fpl-green/20 text-fpl-green font-bold text-xs rounded-lg transition-colors border border-fpl-green/20 disabled:opacity-50"
                            >
                                {reconnecting ? 'Connecting...' : `Connect to ${fplTeamName ?? `#${fplEntryId}`}`}
                            </button>
                            {reconnectMsg && (
                                <p className={`text-xs max-w-[220px] text-right ${reconnectMsg.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                                    {reconnectMsg.text}
                                </p>
                            )}
                        </div>
                    ) : (
                        <span className="flex items-center gap-1.5 text-sm text-gray-500 font-semibold">
                            <XCircle className="w-4 h-4" /> No Connection Available
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <Dna className="text-gray-500 w-4 h-4" />
                        <span className="text-sm text-gray-400">Manager DNA</span>
                    </div>
                    {user.manager_dna ? (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-fpl-green font-semibold">{DNA_LABELS[user.manager_dna] ?? user.manager_dna}</span>
                            <button onClick={() => setShowDNAQuiz(true)} className="text-xs text-gray-600 hover:text-gray-400 transition-colors underline">Retake</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowDNAQuiz(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-fpl-green/10 hover:bg-fpl-green/20 text-fpl-green font-bold text-xs rounded-lg transition-colors border border-fpl-green/20"
                        >
                            <Dna size={13} /> Discover your DNA
                        </button>
                    )}
                </div>

            </div>

            {showDNAQuiz && <ManagerDNAQuiz onClose={() => setShowDNAQuiz(false)} />}

            {/* Membership & Credits */}
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl divide-y divide-white/5">

                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <tierInfo.icon className="text-gray-500 w-4 h-4" />
                        <span className="text-sm text-gray-400">Membership tier</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`flex items-center gap-1.5 text-sm font-semibold ${tierInfo.color}`}>
                            <tierInfo.icon className="w-4 h-4" />
                            {tierInfo.label}{(user?.membership_tier ?? 1) === 1 && <span className="text-gray-500 font-normal"> — {tierInfo.sub}</span>}
                        </span>
                        <div className="flex items-center gap-2">
                            {(user?.membership_tier ?? 1) > 1 && (
                                <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-xs rounded-lg transition-colors border border-white/10">
                                    Downgrade
                                </button>
                            )}
                            {(user?.membership_tier ?? 1) < 3 && (
                                <button className="px-3 py-1.5 bg-fpl-green/10 hover:bg-fpl-green/20 text-fpl-green font-bold text-xs rounded-lg transition-colors border border-fpl-green/20">
                                    Upgrade
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <Coins className="text-gray-500 w-4 h-4" />
                        <span className="text-sm text-gray-400">Analysis credits</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`text-sm font-semibold ${(user.credits ?? 0) > 0 ? 'text-fpl-green' : 'text-red-400'}`}>
                            {user.credits ?? 0} remaining
                        </span>
                        <button className="px-3 py-1.5 bg-fpl-green/10 hover:bg-fpl-green/20 text-fpl-green font-bold text-xs rounded-lg transition-colors border border-fpl-green/20">
                            Buy Credits
                        </button>
                    </div>
                </div>
            </div>

            {/* Danger zone */}
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl divide-y divide-white/5">

                {/* Sign out */}
                <div className="px-6 py-5 flex items-center justify-between">
                <div>
                    <p className="text-white font-semibold text-sm">Sign out</p>
                    <p className="text-gray-500 text-xs mt-0.5">You'll need to sign back in to access your account.</p>
                </div>
                {confirmLogout ? (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setConfirmLogout(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors">Cancel</button>
                        <button onClick={logout} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-xs rounded-lg transition-colors border border-red-500/30">Confirm</button>
                    </div>
                ) : (
                    <button
                        onClick={() => setConfirmLogout(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs rounded-lg transition-colors border border-red-500/20"
                    >
                        <LogOut size={14} /> Sign Out
                    </button>
                )}
            </div>

            </div>
        </div>
    );
};

export default MyAccountView;
