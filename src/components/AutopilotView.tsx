import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Lock, Power, AlertTriangle, CheckCircle, Clock, Zap, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AutopilotStatus {
    autopilot_enabled: boolean;
    autopilot_last_gw: number;
    credits: number;
    membership_tier: number;
    fpl_connected: boolean;
}

interface DeadlineEvent {
    gw: number;
    deadline: Date;
    runsAt: Date;
}

export default function AutopilotView() {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [status, setStatus] = useState<AutopilotStatus | null>(null);
    const [nextDeadline, setNextDeadline] = useState<DeadlineEvent | null>(null);
    const [remainingDeadlines, setRemainingDeadlines] = useState<DeadlineEvent[]>([]);
    const [showAllDeadlines, setShowAllDeadlines] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) { setLoading(false); return; }
        Promise.all([fetchStatus(), fetchDeadlines()]).finally(() => setLoading(false));
    }, [token]);

    async function fetchStatus() {
        try {
            const res = await fetch('/api/user/autopilot', { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setStatus(await res.json());
        } catch {}
    }

    async function fetchDeadlines() {
        try {
            const res = await fetch('/api/bootstrap-static/');
            if (!res.ok) return;
            const data = await res.json();
            const now = Date.now();
            const upcoming: DeadlineEvent[] = (data.events || [])
                .filter((e: any) => e.deadline_time && new Date(e.deadline_time).getTime() > now)
                .map((e: any) => {
                    const deadline = new Date(e.deadline_time);
                    return { gw: e.id, deadline, runsAt: new Date(deadline.getTime() - 6 * 60 * 60 * 1000) };
                });
            if (upcoming.length > 0) setNextDeadline(upcoming[0]);
            setRemainingDeadlines(upcoming.slice(1));
        } catch {}
    }

    async function toggleAutopilot(enable: boolean) {
        if (!token) return;
        setToggling(true);
        setError(null);
        try {
            const res = await fetch('/api/user/autopilot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ enabled: enable }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Failed to update'); return; }
            setStatus(prev => prev ? { ...prev, autopilot_enabled: data.autopilot_enabled } : null);
        } catch {
            setError('Network error');
        } finally {
            setToggling(false);
        }
    }

    const gwsRemaining = status ? Math.floor(status.credits) : 0;

    const fmtDate = (d: Date) => d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00ff87]" />
            </div>
        );
    }

    if (!user || !token) {
        return (
            <div className="max-w-2xl mx-auto text-center py-20">
                <Bot size={48} className="text-gray-500 mx-auto mb-4" />
                <h2 className="text-2xl font-black text-white mb-3">Auto-Pilot</h2>
                <p className="text-gray-400 mb-6">Sign in to manage your Auto-pilot settings.</p>
            </div>
        );
    }

    const tier = status?.membership_tier ?? user?.membership_tier ?? 1;
    const isEligible = tier >= 3;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-xl ${isEligible ? 'bg-[#00ff87]/10 border border-[#00ff87]/20' : 'bg-slate-800 border border-slate-700'}`}>
                        <Bot size={24} className={isEligible ? 'text-[#00ff87]' : 'text-gray-500'} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">Auto-Pilot</h1>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Set it. Forget it. The Wolf handles the rest.</p>
                    </div>
                </div>
            </div>

            {/* Tier gate */}
            {!isEligible && (
                <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
                        <Lock size={28} className="text-gray-500" />
                    </div>
                    <h2 className="text-xl font-black text-white mb-2">Auto-Pilot requires Tier 3</h2>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-md mx-auto">
                        Going on holiday? Can't make the deadline? Auto-Pilot runs The Wolf automatically before every gameweek deadline, executes the plan, and emails you a full report — all without you lifting a finger.
                    </p>
                    <div className="flex flex-wrap gap-3 justify-center mb-6 text-sm">
                        {['Automated analysis every GW', 'Auto-executes transfers & captain', 'PDF report emailed to you', 'Set & forget for the whole season'].map(f => (
                            <div key={f} className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-gray-300">
                                <CheckCircle size={13} className="text-[#00ff87] shrink-0" />
                                <span>{f}</span>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => navigate('/pricing')}
                        className="bg-[#00ff87] text-slate-900 font-black px-8 py-3 rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#00ff87]/20"
                    >
                        Upgrade to Auto-Pilot →
                    </button>
                </div>
            )}

            {/* Main controls — tier 3 only */}
            {isEligible && status && (
                <>
                    {/* FPL connection warning */}
                    {!status.fpl_connected && (
                        <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                            <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                            <p className="text-yellow-200/80 text-sm leading-relaxed">
                                Your FPL account is not connected. Auto-pilot cannot execute transfers without it. Connect your FPL account via the Setup tab.
                            </p>
                        </div>
                    )}

                    {/* Toggle card */}
                    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${status.autopilot_enabled ? 'bg-[#00ff87]/10 border border-[#00ff87]/20' : 'bg-slate-800 border border-slate-700'}`}>
                                    <Power size={20} className={status.autopilot_enabled ? 'text-[#00ff87]' : 'text-gray-500'} />
                                </div>
                                <div>
                                    <div className="text-white font-black">Auto-Pilot</div>
                                    <div className={`text-xs font-bold uppercase tracking-wide ${status.autopilot_enabled ? 'text-[#00ff87]' : 'text-gray-500'}`}>
                                        {status.autopilot_enabled ? 'Active' : 'Off'}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => toggleAutopilot(!status.autopilot_enabled)}
                                disabled={toggling || !status.fpl_connected}
                                className={`relative w-14 h-7 rounded-full transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed ${status.autopilot_enabled ? 'bg-[#00ff87]' : 'bg-slate-700'}`}
                            >
                                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all duration-300 shadow-sm ${status.autopilot_enabled ? 'left-8' : 'left-1'}`} />
                            </button>
                        </div>

                        {error && (
                            <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
                                <AlertTriangle size={13} /> {error}
                            </div>
                        )}

                        <p className="text-gray-500 text-xs mt-4 leading-relaxed">
                            When active, The Wolf will automatically run your analysis and execute transfers 6 hours before each gameweek deadline — even if you're not online. Switch off at any time to resume manual control.
                        </p>
                    </div>

                    {/* Credits / GWs covered */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                            <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Analysis Credits</div>
                            <div className="text-2xl font-black text-white">{status.credits}</div>
                            <div className="text-xs text-gray-400 mt-1">remaining</div>
                        </div>
                        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                            <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">GWs Covered</div>
                            <div className={`text-2xl font-black ${gwsRemaining > 0 ? 'text-[#00ff87]' : 'text-red-400'}`}>{gwsRemaining}</div>
                            <div className="text-xs text-gray-400 mt-1">at 1 credit per GW</div>
                        </div>
                    </div>

                    {gwsRemaining === 0 && (
                        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                            <p className="text-red-300/80 text-sm leading-relaxed">
                                You have no analysis credits remaining. Auto-pilot will not run until you top up. <button onClick={() => navigate('/pricing')} className="text-[#00ff87] font-bold underline">Get more credits →</button>
                            </p>
                        </div>
                    )}

                    {/* Next run + remaining deadlines dropdown */}
                    {nextDeadline && (
                        <div className="rounded-xl border border-slate-700 bg-slate-900/60 overflow-hidden">
                            <div className="p-4 space-y-3">
                                <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">Next Scheduled Run</div>
                                <div className="flex items-start gap-3">
                                    <Clock size={16} className="text-[#02efff] shrink-0 mt-0.5" />
                                    <div>
                                        <div className="text-white font-bold text-sm">GW{nextDeadline.gw}</div>
                                        <div className="text-gray-400 text-xs mt-0.5">Runs at: <span className="text-white font-semibold">{fmtDate(nextDeadline.runsAt)}</span></div>
                                        <div className="text-gray-500 text-xs mt-0.5">Deadline: {fmtDate(nextDeadline.deadline)}</div>
                                    </div>
                                </div>
                            </div>

                            {remainingDeadlines.length > 0 && (
                                <>
                                    <button
                                        onClick={() => setShowAllDeadlines(v => !v)}
                                        className="w-full flex items-center justify-between px-4 py-2.5 border-t border-slate-700/60 text-xs text-gray-500 hover:text-gray-300 hover:bg-slate-800/40 transition-colors"
                                    >
                                        <span>{showAllDeadlines ? 'Hide' : `Show all ${remainingDeadlines.length} remaining deadlines`}</span>
                                        {showAllDeadlines ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>

                                    {showAllDeadlines && (
                                        <div className="border-t border-slate-700/60 divide-y divide-slate-700/40 max-h-72 overflow-y-auto">
                                            {remainingDeadlines.map(d => (
                                                <div key={d.gw} className="flex items-center justify-between px-4 py-2.5">
                                                    <span className="text-white font-semibold text-xs">GW{d.gw}</span>
                                                    <div className="text-right">
                                                        <div className="text-gray-400 text-xs">Runs: {fmtDate(d.runsAt)}</div>
                                                        <div className="text-gray-600 text-xs">Deadline: {fmtDate(d.deadline)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Last run */}
                    {status.autopilot_last_gw > 0 && (
                        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                            <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Last Run</div>
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle size={14} className="text-[#00ff87]" />
                                <span className="text-white font-semibold">GW{status.autopilot_last_gw}</span>
                                <span className="text-gray-500">— analysis executed and emailed</span>
                            </div>
                        </div>
                    )}

                    {/* What happens */}
                    <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-5 space-y-3">
                        <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">What Auto-Pilot Does</div>
                        {[
                            { icon: Clock, label: '6h before deadline', desc: 'The Wolf wakes up and analyses your squad' },
                            { icon: Zap, label: 'Plan executed immediately', desc: 'Transfers made, captain set, bench ordered — automatically' },
                            { icon: Mail, label: 'PDF emailed to you', desc: 'Full analysis report sent to ' + user.email },
                        ].map(({ icon: Icon, label, desc }) => (
                            <div key={label} className="flex items-start gap-3">
                                <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 shrink-0">
                                    <Icon size={13} className="text-[#00ff87]" />
                                </div>
                                <div>
                                    <div className="text-white text-sm font-semibold">{label}</div>
                                    <div className="text-gray-500 text-xs">{desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
