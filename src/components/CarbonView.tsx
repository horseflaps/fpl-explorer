import React from 'react';
import { Leaf, ArrowRight, Zap, Wind, Droplets, Mountain, ExternalLink } from 'lucide-react';

const CarbonView: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-950 pt-4 pb-16 px-4 relative overflow-hidden">
            {/* Background glows */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/6 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-fpl-green/6 rounded-full blur-[140px] pointer-events-none" />

            <div className="max-w-4xl mx-auto relative z-10">

                {/* Hero */}
                <div className="text-center mb-16 space-y-5">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5">
                        <Leaf className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 text-xs font-black uppercase tracking-[0.2em]">Climate Commitment</span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">
                        We're Funding{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-fpl-green">
                            Carbon Removal
                        </span>
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
                        FantasyPremierWolf contributes a portion of every payment to permanent carbon removal through{' '}
                        <span className="text-white font-semibold">Stripe Climate</span>. Every credit you buy and every subscription month directly funds the removal of CO₂ from the atmosphere.
                    </p>
                </div>

                {/* Stripe Climate badge / commitment card */}
                <div className="bg-gradient-to-br from-emerald-950/60 to-slate-900/60 border border-emerald-500/30 rounded-3xl p-8 md:p-10 mb-10 text-center shadow-[0_0_40px_rgba(16,185,129,0.1)]">
                    <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                        <Leaf className="w-9 h-9 text-emerald-400" />
                    </div>
                    <p className="text-emerald-400 text-xs font-black uppercase tracking-[0.25em] mb-3">Our Pledge</p>
                    <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                        1% of Revenue to Carbon Removal
                    </h2>
                    <p className="text-gray-400 text-base max-w-xl mx-auto leading-relaxed">
                        Through Stripe Climate, we automatically direct 1% of every transaction to a portfolio of frontier carbon removal technologies — the most permanent and scalable solutions available.
                    </p>
                    <div className="mt-8 flex flex-col items-center gap-4">
                        <iframe
                            width="380"
                            height="38"
                            style={{ border: 0 }}
                            src="https://climate.stripe.com/badge/COM6qc?theme=dark&size=small&locale=en-US"
                        />
                        <a
                            href="https://climate.stripe.com/e2fmpQ"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                        >
                            View our Climate page <ExternalLink size={15} />
                        </a>
                    </div>
                </div>

                {/* What is Stripe Climate */}
                <div className="mb-10">
                    <div className="mb-8">
                        <h2 className="text-3xl font-black text-white uppercase tracking-tight">What is Stripe Climate?</h2>
                        <div className="w-16 h-1 bg-emerald-500 rounded-full mt-4" />
                    </div>
                    <p className="text-gray-400 leading-relaxed mb-6">
                        Stripe Climate is a program that lets businesses like FantasyPremierWolf automatically direct 1% of their revenue to carbon removal companies. Stripe pools contributions from thousands of businesses to purchase carbon removal at meaningful scale — helping to accelerate technologies that the world needs to reach net zero.
                    </p>
                    <p className="text-gray-400 leading-relaxed">
                        Unlike carbon offsetting (which often just avoids emissions happening elsewhere), Stripe Climate funds <span className="text-white font-semibold">carbon removal</span> — physically pulling CO₂ that's already in the atmosphere back out, and storing it permanently.
                    </p>
                </div>

                {/* Technologies */}
                <div className="mb-10">
                    <div className="mb-8">
                        <h2 className="text-3xl font-black text-white uppercase tracking-tight">Frontier Technologies</h2>
                        <p className="text-gray-400 mt-2 text-base max-w-2xl">Stripe selects a portfolio of the most promising and permanent carbon removal approaches.</p>
                        <div className="w-16 h-1 bg-emerald-500 rounded-full mt-4" />
                    </div>

                    {/* Portfolio breakdown bar */}
                    <div className="mb-8">
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">Portfolio breakdown · 65 projects across 15 countries</p>
                        <div className="flex rounded-full overflow-hidden h-3 w-full">
                            <div className="bg-indigo-500" style={{ width: '25%' }} title="Direct air capture 25%" />
                            <div className="bg-cyan-400" style={{ width: '25%' }} title="Marine carbon removal 25%" />
                            <div className="bg-indigo-900" style={{ width: '20%' }} title="Biomass carbon removal & storage 20%" />
                            <div className="bg-purple-300" style={{ width: '17%' }} title="Mineralization 17%" />
                            <div className="bg-purple-500" style={{ width: '14%' }} title="Field weathering 14%" />
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                            {[
                                { label: 'Direct air capture', pct: '25%', color: 'bg-indigo-500' },
                                { label: 'Marine carbon removal', pct: '25%', color: 'bg-cyan-400' },
                                { label: 'Biomass & storage', pct: '20%', color: 'bg-indigo-900 border border-indigo-700' },
                                { label: 'Mineralization', pct: '17%', color: 'bg-purple-300' },
                                { label: 'Field weathering', pct: '14%', color: 'bg-purple-500' },
                            ].map(({ label, pct, color }) => (
                                <div key={label} className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
                                    {label} <span className="text-gray-500">{pct}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-5">
                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-7 flex flex-col gap-4 hover:border-emerald-500/30 transition-all duration-300 group">
                            <div className="flex items-center justify-between">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Zap className="text-indigo-400 w-6 h-6" />
                                </div>
                                <span className="text-xs font-black text-gray-500">25%</span>
                            </div>
                            <h3 className="text-lg font-bold text-white">Direct Air Capture</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Machines that pull CO₂ directly from the ambient air, using chemical processes to concentrate and store it underground in mineral form — permanently, for thousands of years.
                            </p>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-7 flex flex-col gap-4 hover:border-emerald-500/30 transition-all duration-300 group">
                            <div className="flex items-center justify-between">
                                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Droplets className="text-cyan-400 w-6 h-6" />
                                </div>
                                <span className="text-xs font-black text-gray-500">25%</span>
                            </div>
                            <h3 className="text-lg font-bold text-white">Marine Carbon Removal</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Enhancing the ocean's natural ability to absorb CO₂ — through alkalinity enhancement and marine biomass — locking carbon in the deep ocean for millennia.
                            </p>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-7 flex flex-col gap-4 hover:border-emerald-500/30 transition-all duration-300 group">
                            <div className="flex items-center justify-between">
                                <div className="w-12 h-12 rounded-2xl bg-fpl-green/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Wind className="text-fpl-green w-6 h-6" />
                                </div>
                                <span className="text-xs font-black text-gray-500">20%</span>
                            </div>
                            <h3 className="text-lg font-bold text-white">Biomass &amp; Carbon Storage</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Waste biomass naturally captures CO₂ via photosynthesis. Through pyrolysis, gasification, and biomass burial, that carbon is permanently stored rather than re-released.
                            </p>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-7 flex flex-col gap-4 hover:border-emerald-500/30 transition-all duration-300 group">
                            <div className="flex items-center justify-between">
                                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Mountain className="text-purple-400 w-6 h-6" />
                                </div>
                                <span className="text-xs font-black text-gray-500">17%</span>
                            </div>
                            <h3 className="text-lg font-bold text-white">Mineralization</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                CO₂ is reacted with minerals to form stable carbonates — locking it in solid rock form permanently. High verifiability and low energy requirements make this a reliable pathway.
                            </p>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-7 flex flex-col gap-4 hover:border-emerald-500/30 transition-all duration-300 group sm:col-span-2">
                            <div className="flex items-center justify-between">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Mountain className="text-amber-400 w-6 h-6" />
                                </div>
                                <span className="text-xs font-black text-gray-500">14%</span>
                            </div>
                            <h3 className="text-lg font-bold text-white">Field Weathering</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Spreading crushed silicate rock across farmland accelerates a natural geological process that draws down CO₂ and stores it as stable bicarbonate. Scalable, low-cost, with agricultural co-benefits like improved soil health.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Why frontier */}
                <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-8 mb-10">
                    <h3 className="text-white font-bold text-xl mb-4 flex items-center gap-3">
                        <Leaf className="text-emerald-400 w-5 h-5" />
                        Why "Frontier" Carbon Removal?
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">
                        Most carbon credits available today fund nature-based projects — tree planting, forest protection. These have value, but they're temporary: forests can burn, be logged, or die. Frontier carbon removal is different. It stores CO₂ in forms that will remain stable for hundreds to thousands of years.
                    </p>
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">
                        These technologies are currently expensive because they're early-stage. Early buyers like Stripe Climate are essential — they provide the revenue that allows these companies to scale, drive costs down, and eventually deploy carbon removal at the gigatonne scale the climate crisis requires.
                    </p>
                    <div className="mt-6 flex items-start gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                        <Leaf className="text-emerald-400 w-4 h-4 mt-0.5 shrink-0" />
                        <p className="text-gray-300 text-sm">
                            <span className="text-emerald-400 font-bold">Our commitment matters now.</span>{' '}
                            Stripe Climate's analysis shows that buying frontier carbon removal today — even at high cost — is one of the highest-leverage climate actions available, because it accelerates the cost curves that make mass deployment possible.
                        </p>
                    </div>
                </div>

                {/* CTA */}
                <div className="text-center py-4">
                    <p className="text-gray-500 text-sm mb-6">Learn more about the companies and science behind Stripe Climate</p>
                    <a
                        href="https://climate.stripe.com/e2fmpQ"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    >
                        Visit Stripe Climate <ArrowRight size={16} />
                    </a>
                </div>

            </div>
        </div>
    );
};

export default CarbonView;
