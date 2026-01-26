import { TrendingUp, Users, Shield } from 'lucide-react';
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
