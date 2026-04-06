import React from 'react';
import { Chrome, LogIn, RefreshCcw, ArrowRight, CheckCircle2, Download, ExternalLink } from 'lucide-react';

const SetupView: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-950 pt-4 pb-12 px-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-fpl-green/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-4xl mx-auto relative z-10">
                <div className="text-center mb-16 space-y-4">
                    <h1 className="text-5xl font-black text-white tracking-tight">
                        Get <span className="text-fpl-green">Connected</span>
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                        Follow these simple steps to sync your Fantasy Premier League team with the Wolf dashboard automatically.
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-3">
                    {/* Step 1 */}
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center group hover:border-fpl-green/30 transition-all duration-300">
                        <div className="w-16 h-16 bg-fpl-green/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Chrome className="text-fpl-green h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">1. Install</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            Add the <span className="text-white font-semibold">FPW Connector</span> extension to your Chrome browser.
                        </p>
                        <button className="mt-auto w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-white/10">
                            Download Extension <Download size={16} />
                        </button>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center group hover:border-blue-500/30 transition-all duration-300">
                        <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <LogIn className="text-blue-400 h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">2. Log In to FPL</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            Open <span className="text-white font-semibold">fantasy.premierleague.com</span> and make sure you are logged in.
                        </p>
                        <a
                            href="https://fantasy.premierleague.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-auto w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                        >
                            Visit FPL Site <ExternalLink size={16} />
                        </a>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center group hover:border-[#02efff]/30 transition-all duration-300">
                        <div className="w-16 h-16 bg-[#02efff]/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <RefreshCcw className="text-[#02efff] h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">3. Done!</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            Return here and refresh. The extension will automatically detect your team ID and session tokens.
                        </p>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="mt-auto w-full py-3 bg-[#02efff] hover:bg-cyan-300 text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                            Go to Dashboard <ArrowRight size={16} />
                        </button>
                    </div>
                </div>

                <div className="mt-16 bg-gradient-to-br from-fpl-green/5 to-blue-500/5 border border-white/5 rounded-[32px] p-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="w-20 h-20 bg-fpl-green/20 rounded-full flex items-center justify-center shrink-0">
                        <CheckCircle2 className="text-fpl-green h-10 w-10" />
                    </div>
                    <div>
                        <h4 className="text-xl font-bold text-white mb-2">Why use the extension?</h4>
                        <p className="text-gray-400 leading-relaxed">
                            For The Wolf to make changes to your team, it needs to be able to read and write to the FPL website.
                            The FPW Connector Chrome Extension allows it to do this securely.<br /><br />
                            FPW uses the same security model as your browser, and by using this extension, we never see your password.
                            The extension simply reads the local session token directly from the official FPL website, allowing us to
                            make the agreed changes to your team securely and accurately.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetupView;
