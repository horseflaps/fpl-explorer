import React, { useState, useEffect, useRef } from 'react';
import { CircleUserRound, Mail, Shield, CheckCircle2, XCircle, LogOut, Zap, Bot, Brain, Unlink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MyAccountView: React.FC = () => {
    const { user, token, isVerified, fplConnected, fplEntryId, logout } = useAuth();

    const tierInfo = [
        { tier: 1, label: 'Scout',    sub: 'Free',      icon: Zap,   color: 'text-gray-400' },
        { tier: 2, label: 'Co-Pilot', sub: '£5/mo',     icon: Bot,   color: 'text-[#02efff]' },
        { tier: 3, label: 'Autopilot',sub: '£10/mo',    icon: Brain, color: 'text-fpl-green' },
    ][( user?.membership_tier ?? 1) - 1];
    const [confirmLogout, setConfirmLogout] = useState(false);
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [reconnecting, setReconnecting] = useState(false);
    const fplConnectedRef = useRef(fplConnected);
    useEffect(() => { fplConnectedRef.current = fplConnected; }, [fplConnected]);

    // When reconnecting, stop spinner once fplConnected becomes true
    useEffect(() => {
        if (fplConnected && reconnecting) setReconnecting(false);
    }, [fplConnected, reconnecting]);

    const handleDisconnect = async () => {
        setDisconnecting(true);
        try {
            await fetch('/api/fpl/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        } catch {}
        window.location.reload();
    };
    const [fplTeamName, setFplTeamName] = useState<string | null>(null);

    useEffect(() => {
        if (!fplConnected || !fplEntryId) return;
        fetch(`/api/fpl/entry/${fplEntryId}`)
            .then(r => r.json())
            .then(d => { if (d.name) setFplTeamName(d.name); })
            .catch(() => {});
    }, [fplConnected, fplEntryId]);

    if (!user) return null;

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
                        <span className="flex items-center gap-1.5 text-sm text-fpl-green font-semibold">
                            <CheckCircle2 className="w-4 h-4" />
                            {fplTeamName ?? (fplEntryId ? `#${fplEntryId}` : '...')}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-sm text-gray-500 font-semibold">
                            <XCircle className="w-4 h-4" /> Not connected
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <tierInfo.icon className="text-gray-500 w-4 h-4" />
                        <span className="text-sm text-gray-400">Membership tier</span>
                    </div>
                    <span className={`flex items-center gap-1.5 text-sm font-semibold ${tierInfo.color}`}>
                        <tierInfo.icon className="w-4 h-4" />
                        {tierInfo.label} <span className="text-gray-500 font-normal">— {tierInfo.sub}</span>
                    </span>
                </div>
            </div>

            {/* Danger zone */}
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl divide-y divide-white/5">

                {/* Disconnect / Reconnect FPL */}
                <div className="px-6 py-5 flex items-center justify-between">
                    <div>
                        <p className="text-white font-semibold text-sm">FPL Connection</p>
                        <p className="text-gray-500 text-xs mt-0.5">
                            {fplConnected ? 'Unlinks your FPL account. You can reconnect at any time.' : 'Reconnects using your stored FPL session. If it fails, log into FPL in another tab first.'}
                        </p>
                    </div>
                    {fplConnected ? (
                        confirmDisconnect ? (
                            <div className="flex items-center gap-2">
                                <button onClick={() => setConfirmDisconnect(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors">Cancel</button>
                                <button onClick={handleDisconnect} disabled={disconnecting} className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 font-bold text-xs rounded-lg transition-colors border border-orange-500/30 disabled:opacity-50">
                                    {disconnecting ? 'Disconnecting...' : 'Confirm'}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmDisconnect(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-bold text-xs rounded-lg transition-colors border border-orange-500/20"
                            >
                                <Unlink size={14} /> Disconnect
                            </button>
                        )
                    ) : (
                        <button
                            disabled={reconnecting}
                            onClick={() => {
                                setReconnecting(true);
                                // Try extension first (works if it has a cached token)
                                window.dispatchEvent(new CustomEvent('fpw-reconnect', { detail: { fpwToken: token } }));
                                // Open FPL in background tab so extension can grab a fresh session
                                window.open('https://fantasy.premierleague.com/', '_blank');
                                // Stop spinner after 15s regardless
                                setTimeout(() => setReconnecting(false), 15000);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-fpl-green/10 hover:bg-fpl-green/20 text-fpl-green font-bold text-xs rounded-lg transition-colors border border-fpl-green/20 disabled:opacity-50"
                        >
                            {reconnecting ? 'Reconnecting...' : <><CheckCircle2 size={14} /> Reconnect</>}
                        </button>
                    )}
                </div>

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
