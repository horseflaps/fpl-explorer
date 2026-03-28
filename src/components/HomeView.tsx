import { TrendingUp, Users, Shield, Chrome, Zap, RefreshCw, Unlink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HomeView = () => {
    const navigate = useNavigate();

    return (
        <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 pb-12">

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
                    <button
                        onClick={() => navigate('/analyse')}
                        className="px-8 py-4 bg-[#00ff87] text-[#37003c] font-black text-lg uppercase tracking-wider rounded-xl hover:bg-[#00ff87]/90 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,135,0.4)]"
                    >
                        Start Analysis
                    </button>
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

            {/* FPL Connection Section */}
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
                        <span className="text-white font-semibold">Your password is never touched.</span> The extension reads a short-lived session token directly from FPL's own website — the same way your browser stays logged in. It is stored securely on our server and used only to fetch your team data.
                    </p>
                </div>
            </div>

            {/* How to Use Section */}
            <div className="bg-[#220025] border border-white/10 rounded-3xl p-8 md:p-12">
                <h2 className="text-3xl font-black text-white uppercase italic tracking-tight mb-8 text-center">How to Win</h2>
                <div className="grid md:grid-cols-4 gap-8">
                    <div className="relative text-center">
                        <div className="w-10 h-10 bg-white/10 text-white font-black flex items-center justify-center rounded-full mx-auto mb-4 border border-white/20">1</div>
                        <h4 className="text-[#00ff87] font-bold uppercase mb-2">Connect</h4>
                        <p className="text-sm text-gray-400">Enter your Team ID in the Analyse tab.</p>
                    </div>
                    <div className="relative text-center">
                        <div className="w-10 h-10 bg-white/10 text-white font-black flex items-center justify-center rounded-full mx-auto mb-4 border border-white/20">2</div>
                        <h4 className="text-[#00ff87] font-bold uppercase mb-2">Review</h4>
                        <p className="text-sm text-gray-400">Examine specific weaknesses in your current lineup.</p>
                    </div>
                    <div className="relative text-center">
                        <div className="w-10 h-10 bg-white/10 text-white font-black flex items-center justify-center rounded-full mx-auto mb-4 border border-white/20">3</div>
                        <h4 className="text-[#02efff] font-bold uppercase mb-2">Simulate</h4>
                        <p className="text-sm text-gray-400">Use Edit Mode to test potential transfers.</p>
                    </div>
                    <div className="relative text-center">
                        <div className="w-10 h-10 bg-white/10 text-white font-black flex items-center justify-center rounded-full mx-auto mb-4 border border-white/20">4</div>
                        <h4 className="text-pink-500 font-bold uppercase mb-2">Execute</h4>
                        <p className="text-sm text-gray-400">Apply the AI's advice to your actual FPL team.</p>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default HomeView;
