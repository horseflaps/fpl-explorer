import React, { useEffect, useState } from 'react';
import { TrendingUp, Users, Shield, Chrome, Zap, RefreshCw, Unlink, CheckCircle2, PartyPopper } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HomeView: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const verified = searchParams.get('verified');
    const activateToken = searchParams.get('activate');
    const [activateStatus, setActivateStatus] = useState<'idle' | 'success' | 'error' | 'needs-login'>('idle');
    const { isAuthenticated, token, extensionDetected, fplConnected, fplEntryId, setIsLoginOpen } = useAuth();

    useEffect(() => {
        if (!activateToken) return;

        if (!isAuthenticated) {
            setActivateStatus('needs-login');
            setIsLoginOpen(true);
            return;
        }

        fetch('/api/auth/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ token: activateToken }),
        })
            .then(r => r.json())
            .then(d => {
                setActivateStatus(d.ok ? 'success' : 'error');
                setSearchParams({});
            })
            .catch(() => setActivateStatus('error'));
    }, [activateToken, isAuthenticated]);

    const renderMainButton = () => {
        // If connected or authenticated, the extension must be present - skip state 1
        const hasExtension = extensionDetected || isAuthenticated || fplConnected;

        // State 1: No Extension -> "Get Connected" (Points to /setup)
        if (!hasExtension) {
            return (
                <button
                    onClick={() => navigate('/setup')}
                    className="px-8 py-4 bg-[#00ff87] text-[#37003c] font-black text-lg uppercase tracking-wider rounded-xl hover:bg-[#00ff87]/90 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,135,0.4)]"
                >
                    Get Connected
                </button>
            );
        }

        // State 2: Has Extension, Not Logged In -> "Log In / Sign Up" (Opens login modal)
        if (!isAuthenticated) {
            return (
                <button
                    onClick={() => setIsLoginOpen(true)}
                    className="px-8 py-4 bg-blue-600 text-white font-black text-lg uppercase tracking-wider rounded-xl hover:bg-blue-500 active:scale-95 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                >
                    Log In / Sign Up
                </button>
            );
        }

        // State 3: Logged In, Had Connection, Now Disconnected -> "Connect" (fires extension reconnect)
        if (!fplConnected && fplEntryId) {
            const handleReconnect = () => {
                window.dispatchEvent(new CustomEvent('fpw-reconnect', {
                    detail: { fpwToken: localStorage.getItem('token') }
                }));
            };
            return (
                <button
                    onClick={handleReconnect}
                    className="px-8 py-4 bg-fpl-green text-slate-950 font-black text-lg uppercase tracking-wider rounded-xl hover:bg-green-400 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,135,0.4)]"
                >
                    Connect
                </button>
            );
        }

        // State 4 (formerly 3): Logged In, No Prior FPL Connection -> "Connect via FPL"
        if (!fplConnected) {
            return (
                <button
                    onClick={() => window.open('https://fantasy.premierleague.com/', '_blank')}
                    className="px-8 py-4 bg-fpl-green text-slate-950 font-black text-lg uppercase tracking-wider rounded-xl hover:bg-green-400 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,135,0.4)]"
                >
                    Connect via FPL
                </button>
            );
        }

        // State 4: Logged In & Connected -> "Get Analysis"
        return (
            <button
                onClick={() => navigate('/analyse')}
                className="px-8 py-4 bg-[#00ff87] text-[#37003c] font-black text-lg uppercase tracking-wider rounded-xl hover:bg-[#00ff87]/90 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,135,0.4)]"
            >
                Get Analysis
            </button>
        );
    };

    return (
        <>
        {/* Account activated modal */}
        {activateStatus === 'success' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
                <div className="bg-slate-900 border border-fpl-green/40 rounded-3xl p-10 max-w-sm w-full text-center space-y-5 shadow-[0_0_50px_rgba(0,255,135,0.12)] animate-in zoom-in-95 duration-300">
                    <div className="h-1 bg-gradient-to-r from-fpl-green to-[#02efff] rounded-full" />
                    <div className="w-16 h-16 bg-fpl-green/10 border border-fpl-green/30 rounded-2xl flex items-center justify-center mx-auto">
                        <PartyPopper className="text-fpl-green w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white">You're activated!</h2>
                        <p className="text-gray-400 text-sm mt-2 leading-relaxed">Your account is now fully active. The Wolf is ready to analyse your squad.</p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full py-3 bg-fpl-green text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl hover:bg-fpl-green/90 transition-all shadow-[0_0_20px_rgba(0,255,135,0.25)]"
                    >
                        Let's Go
                    </button>
                </div>
            </div>
        )}

        <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 pb-12">

            {/* Activation banners */}
            {activateStatus === 'needs-login' && (
                <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-6 py-4">
                    <p className="text-amber-400 font-semibold text-sm">Please sign in to activate your account.</p>
                </div>
            )}
            {activateStatus === 'error' && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl px-6 py-4">
                    <p className="text-red-400 font-semibold text-sm">This activation link is invalid or has already been used.</p>
                </div>
            )}

            {/* Hero Section */}
            <div className="text-center space-y-6">
                <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic">
                    <span className="text-[#00ff87]">Fantasy</span> <span className="text-[#37003c] bg-[#00ff87] px-2">Premier</span> Wolf
                </h1>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                    The advanced AI strategy tool for Fantasy Premier League managers.
                    Analyze your team, find hidden gems, and dominate your mini-leagues with data-driven insights.
                </p>
                <div className="flex justify-center gap-4 pt-4">
                    {renderMainButton()}
                </div>
            </div>

            {/* FPL Connection Section - Moved below Hero */}
            <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-8 md:p-12">
                <div className="flex items-center gap-3 mb-2 justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#00ff87] shadow-[0_0_6px_#00ff87]" />
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#00ff87]">Live FPL Integration</p>
                </div>
                <h2 className="text-3xl font-black text-white uppercase italic tracking-tight mb-4 text-center">How the Connection Works</h2>
                <p className="text-gray-400 text-center max-w-2xl mx-auto mb-10 leading-relaxed">
                    FantasyPremierWolf links directly to your FPL account using a browser extension — no passwords shared, no manual entry.
                    Once connected, your live team, pending transfers, and captain choices sync automatically.
                </p>
                <div className="grid md:grid-cols-4 gap-6">
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#37003c] border border-[#00ff87]/30 flex items-center justify-center">
                            <Chrome size={22} className="text-[#00ff87]" />
                        </div>
                        <h4 className="text-white font-bold text-sm uppercase tracking-wide">1. Install Extension</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">Install the FantasyPremierWolf Chrome extension. It runs quietly in the background.</p>
                    </div>
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#37003c] border border-[#00ff87]/30 flex items-center justify-center">
                            <Zap size={22} className="text-[#00ff87]" />
                        </div>
                        <h4 className="text-white font-bold text-sm uppercase tracking-wide">2. Log into FPL</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">Visit fantasy.premierleague.com and log in. The extension detects your session token automatically.</p>
                    </div>
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#37003c] border border-[#00ff87]/30 flex items-center justify-center">
                            <RefreshCw size={22} className="text-[#00ff87]" />
                        </div>
                        <h4 className="text-white font-bold text-sm uppercase tracking-wide">3. Auto-Connect</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">With FPW open in another tab, the extension connects both accounts instantly — no copy-pasting required.</p>
                    </div>
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#37003c] border border-[#00ff87]/30 flex items-center justify-center">
                            <Unlink size={22} className="text-[#00ff87]" />
                        </div>
                        <h4 className="text-white font-bold text-sm uppercase tracking-wide">4. Always in Sync</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">Your live team loads automatically. Logging out of FPL or FPW cleanly disconnects — no stale data.</p>
                    </div>
                </div>
                <div className="mt-8 p-4 bg-slate-800/50 border border-white/5 rounded-2xl text-center">
                    <p className="text-xs text-gray-500 leading-relaxed max-w-xl mx-auto">
                        <span className="text-white font-semibold">Your password is never seen, stored or touched.</span> The extension reads a short-lived session token directly from FPL's own website — the same way your browser stays logged in. It is stored securely on our server and used only to fetch your team data.
                    </p>
                </div>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-slate-900/50 border border-white/10 p-8 rounded-2xl hover:border-[#00ff87]/50 transition-colors group">
                    <div className="w-12 h-12 bg-[#37003c] rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <TrendingUp className="text-[#00ff87]" size={24} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">Team Analysis</h3>
                    <p className="text-gray-400 leading-relaxed">
                        Input your Team ID to get an instant deep-dive into your squad's performance.
                        Visualize exact pitch layouts, check transfer effectiveness, and view live projected points.
                    </p>
                </div>

                <div className="bg-slate-900/50 border border-white/10 p-8 rounded-2xl hover:border-[#02efff]/50 transition-colors group">
                    <div className="w-12 h-12 bg-[#37003c] rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Shield className="text-[#02efff]" size={24} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">AI Strategy</h3>
                    <p className="text-gray-400 leading-relaxed">
                        "Unleash the Wolf" to get personalized transfer recommendations.
                        Our AI evaluates thousands of scenarios to suggest the optimal moves for your specific team.
                    </p>
                </div>

                <div className="bg-slate-900/50 border border-white/10 p-8 rounded-2xl hover:border-pink-500/50 transition-colors group">
                    <div className="w-12 h-12 bg-[#37003c] rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Users className="text-pink-500" size={24} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">Mini-Leagues</h3>
                    <p className="text-gray-400 leading-relaxed">
                        Track your rivals and see live rank updates.
                        Save your favorite teams for quick access and never miss a beat in your competitive leagues.
                    </p>
                </div>
            </div>

            {/* CTA Functionality Table - Replaced "How to Win" */}
            <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-8 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 text-gray-400 text-sm uppercase tracking-wider">
                            <th className="pb-4 pr-4">State</th>
                            <th className="pb-4 pr-4">Button Text</th>
                            <th className="pb-4 pr-4">Primary Action</th>
                            <th className="pb-4">Destination / Result</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-gray-300">
                        <tr className="border-b border-white/5">
                            <td className="py-4 pr-4 font-bold text-white">No Extension</td>
                            <td className="py-4 pr-4">Get Connected</td>
                            <td className="py-4 pr-4">Navigate to Setup</td>
                            <td className="py-4 text-[#00ff87]">→ /setup page</td>
                        </tr>
                        <tr className="border-b border-white/5">
                            <td className="py-4 pr-4 font-bold text-white">Extension Found, Not Logged In</td>
                            <td className="py-4 pr-4 font-bold text-blue-400">Log In / Sign Up</td>
                            <td className="py-4 pr-4 text-blue-400/80">Open Login Modal</td>
                            <td className="py-4 text-blue-300">Wolf auth modal</td>
                        </tr>
                        <tr className="border-b border-white/5">
                            <td className="py-4 pr-4 font-bold text-white">Logged In, No Prior FPL Link</td>
                            <td className="py-4 pr-4 font-bold text-fpl-green">Connect via FPL</td>
                            <td className="py-4 pr-4 text-fpl-green/80">External Link</td>
                            <td className="py-4 text-fpl-green/90">Opens FPL site in new tab</td>
                        </tr>
                        <tr className="border-b border-white/5">
                            <td className="py-4 pr-4 font-bold text-white">Logged In, Previously Linked, Disconnected</td>
                            <td className="py-4 pr-4 font-bold text-white">Connect</td>
                            <td className="py-4 pr-4 text-gray-400">Extension Reconnect</td>
                            <td className="py-4 flex items-center gap-2">
                                Fires <span className="bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-[#00ff87]">fpw-reconnect</span> → extension resends stored token → <span className="w-2 h-2 bg-[#00ff87] rounded-full shadow-[0_0_6px_#00ff87]"></span> neon modal fires
                            </td>
                        </tr>
                        <tr>
                            <td className="py-4 pr-4 font-bold text-white">Logged In & Connected</td>
                            <td className="py-4 pr-4 font-bold text-[#00ff87]">Get Analysis</td>
                            <td className="py-4 pr-4 text-[#00ff87]/80">Navigate to Analyse</td>
                            <td className="py-4 text-[#00ff87]">→ /analyse</td>
                        </tr>
                    </tbody>
                </table>
            </div>

        </div>
        </>
    );
};

export default HomeView;
