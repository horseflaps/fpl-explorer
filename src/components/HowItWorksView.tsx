import React, { useState, useEffect } from 'react';
import {
    Chrome, LogIn, RefreshCcw, LineChart, Brain, Users, Shield, Calendar,
    Activity, Trophy, Shirt, Search, Zap, Bot, ArrowRight, Star, Lock, Wifi,
    FlaskConical, TrendingUp, Clock, Mail, ToggleRight, CreditCard, MousePointerClick
} from 'lucide-react';

const Section: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <div className="mb-20">
        <div className="mb-10">
            <h2 className="text-3xl font-black text-white uppercase tracking-tight">{title}</h2>
            {subtitle && <p className="text-gray-400 mt-2 text-base max-w-2xl">{subtitle}</p>}
            <div className="w-16 h-1 bg-fpl-green rounded-full mt-4" />
        </div>
        {children}
    </div>
);

const Card: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; accent?: string }> = ({ icon, title, children, accent = 'fpl-green' }) => (
    <div className={`bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-7 flex flex-col gap-4 hover:border-${accent}/30 transition-all duration-300 group`}>
        <div className={`w-12 h-12 rounded-2xl bg-${accent}/10 flex items-center justify-center group-hover:scale-110 transition-transform`}>
            {icon}
        </div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{children}</p>
    </div>
);

const Step: React.FC<{ number: number; title: string; children: React.ReactNode; icon: React.ReactNode; color: string }> = ({ number, title, children, icon, color }) => (
    <div className="flex gap-6 group">
        <div className="flex flex-col items-center">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-slate-900 font-black text-lg shrink-0`} style={{ background: color }}>
                {number}
            </div>
            <div className="w-px flex-1 bg-slate-800 mt-3" />
        </div>
        <div className="pb-10">
            <div className="flex items-center gap-3 mb-2">
                <span style={{ color }}>{icon}</span>
                <h3 className="text-lg font-bold text-white">{title}</h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">{children}</p>
        </div>
    </div>
);

const HowItWorksView: React.FC = () => {
    const [tierPrices, setTierPrices] = useState<Record<number, string>>({});
    useEffect(() => {
        fetch('/api/tiers')
            .then(r => r.json())
            .then((rows: { id: number; price_gbp: number }[]) => {
                const map: Record<number, string> = {};
                rows.forEach(r => { map[r.id] = `£${r.price_gbp.toFixed(2)}`; });
                setTierPrices(map);
            })
            .catch(() => {});
    }, []);
    const copilotPrice = tierPrices[2] ?? '...';
    const autopilotPrice = tierPrices[3] ?? '...';

    return (
        <div className="min-h-screen bg-slate-950 pt-4 pb-16 px-4 relative overflow-hidden">
            {/* Background glows */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-fpl-green/8 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-blue-500/8 rounded-full blur-[140px] pointer-events-none" />

            <div className="max-w-5xl mx-auto relative z-10">

                {/* Hero */}
                <div className="text-center mb-20 space-y-5">
                    <p className="text-fpl-green text-sm font-black uppercase tracking-[0.25em]">Documentation</p>
                    <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">
                        How <span className="text-transparent bg-clip-text bg-gradient-to-r from-fpl-green to-[#02efff]">It Works</span>
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
                        FantasyPremierWolf is an AI-powered FPL strategy tool. Here's everything you need to know — from getting set up to squeezing every point out of your squad.
                    </p>
                </div>

                {/* ── SECTION 1: What is it ── */}
                <Section
                    title="What is FantasyPremierWolf?"
                    subtitle="A dashboard that connects to your FPL account and uses AI to help you make better transfer and captaincy decisions."
                >
                    <div className="grid md:grid-cols-3 gap-5">
                        <Card icon={<Brain className="text-fpl-green w-6 h-6" />} title="AI-Powered Analysis">
                            The Wolf uses Google's Gemini AI to analyse your squad, upcoming fixtures, player form, price changes, and your remaining free transfers — then gives you a concrete, explained recommendation.
                        </Card>
                        <Card icon={<Wifi className="text-[#02efff] w-6 h-6" />} title="Live FPL Sync" accent="[#02efff]">
                            Via a lightweight Chrome extension, the platform reads your FPL session in real time. Your team, chip status, transfer history, and league standings are always up to date — no manual entry.
                        </Card>
                        <Card icon={<LineChart className="text-fpl-green w-6 h-6" />} title="Full Data Explorer">
                            Beyond AI, you get a rich data layer: every player's stats and price history, team form, fixture difficulty, gameweek live scores, and full league standings — all in one place.
                        </Card>
                    </div>
                </Section>

                {/* ── SECTION 2: Getting connected ── */}
                <Section
                    title="Getting Connected"
                    subtitle="The platform is most powerful when linked to your FPL account. Here's how the connection works."
                >
                    <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-8 md:p-10">
                        <Step number={1} title="Install the Chrome Extension" icon={<Chrome size={18} />} color="#00ff87">
                            Download and install the <strong className="text-white">FPW Connector</strong> extension from the Chrome Web Store. It's a small, read-only bridge that lets the Wolf read your FPL session — it never stores your password or makes changes without your approval.
                        </Step>
                        <Step number={2} title="Log in to fantasy.premierleague.com" icon={<LogIn size={18} />} color="#02efff">
                            Open the official FPL website and log in as normal. The extension detects your active session automatically — there's nothing to click or configure.
                        </Step>
                        <Step number={3} title="Create a FantasyPremierWolf account" icon={<Lock size={18} />} color="#e90052">
                            Sign up (free) on this platform. This lets us securely associate your FPL data with your Wolf profile, save your analyses, and store your team history.
                        </Step>
                        <Step number={4} title="You're in sync" icon={<RefreshCcw size={18} />} color="#00ff87">
                            From this point on, every time you visit the platform your team is loaded automatically. If you make transfers on FPL, the Wolf picks them up next time you open the Analyse tab. No manual refresh needed.
                        </Step>
                    </div>
                    <p className="text-gray-500 text-xs mt-4 text-center">
                        You can also use the platform without connecting — search any FPL manager by name or ID to analyse their squad.
                    </p>
                </Section>

                {/* ── SECTION 3: The Analyse tab ── */}
                <Section
                    title="The Analyse Tab"
                    subtitle="The heart of the platform. Load any team and get a full AI breakdown."
                >
                    <div className="grid md:grid-cols-2 gap-5 mb-6">
                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-7 space-y-4">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <Search className="text-fpl-green w-5 h-5" /> Loading a Team
                            </h3>
                            <ul className="space-y-3 text-sm text-gray-400">
                                <li className="flex items-start gap-2"><ArrowRight className="text-fpl-green w-4 h-4 mt-0.5 shrink-0" /><span><strong className="text-white">Auto-load:</strong> If you're connected, your team appears instantly when you open the tab.</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-fpl-green w-4 h-4 mt-0.5 shrink-0" /><span><strong className="text-white">Manager name:</strong> Search any FPL manager by their display name.</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-fpl-green w-4 h-4 mt-0.5 shrink-0" /><span><strong className="text-white">Team ID:</strong> Enter a numeric FPL entry ID directly.</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-fpl-green w-4 h-4 mt-0.5 shrink-0" /><span><strong className="text-white">League:</strong> Browse all managers in any mini-league by ID.</span></li>
                            </ul>
                        </div>
                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-7 space-y-4">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <Brain className="text-fpl-green w-5 h-5" /> What the AI Considers
                            </h3>
                            <ul className="space-y-3 text-sm text-gray-400">
                                <li className="flex items-start gap-2"><ArrowRight className="text-[#02efff] w-4 h-4 mt-0.5 shrink-0" /><span>Current squad, formation, and total team value</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-[#02efff] w-4 h-4 mt-0.5 shrink-0" /><span>Free transfers remaining (up to 5 can be banked as of 2024/25) and chip availability (Wildcard, Bench Boost, Free Hit, Triple Captain)</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-[#02efff] w-4 h-4 mt-0.5 shrink-0" /><span>Upcoming fixture difficulty for the next 3–6 gameweeks</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-[#02efff] w-4 h-4 mt-0.5 shrink-0" /><span>Player form, total points, and expected goals/assists (xG/xA)</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-[#02efff] w-4 h-4 mt-0.5 shrink-0" /><span>Price rise/fall predictions and ownership percentages</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-[#02efff] w-4 h-4 mt-0.5 shrink-0" /><span>Mini-league standings to inform differential or template picks</span></li>
                            </ul>
                        </div>
                    </div>
                    <div className="bg-fpl-green/5 border border-fpl-green/20 rounded-2xl p-6 text-sm text-gray-300 leading-relaxed">
                        <strong className="text-fpl-green">How the AI output works:</strong> After hitting "Unleash the Wolf", the Wolf generates a detailed written recommendation — covering which transfers to make, who to captain, whether to play a chip, and why. The reasoning is shown in full so you can agree or disagree with each point before acting.
                    </div>
                </Section>

                {/* ── SECTION 4: Data tools ── */}
                <Section
                    title="Data Explorer Tools"
                    subtitle="Alongside the AI, the platform gives you a full suite of FPL reference tools."
                >
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        <Card icon={<Users className="text-fpl-green w-6 h-6" />} title="Players">
                            Browse all FPL players. Filter by position and team, search by name, and view each player's cost, total points, form, and detailed stats including price history charts. Compare season stats for up to 4 players at once.
                        </Card>
                        <Card icon={<Shield className="text-[#02efff] w-6 h-6" />} title="Teams" accent="[#02efff]">
                            Dive into any Premier League club. See their top FPL assets, recent form (last 5 results), upcoming fixtures, and attacking/defensive strength ratings used in FDR calculations.
                        </Card>
                        <Card icon={<Calendar className="text-fpl-green w-6 h-6" />} title="Fixtures">
                            Navigate the full fixture list by gameweek. Filter by team and see home/away indicators, kickoff times, and match results for completed games.
                        </Card>
                        <Card icon={<Activity className="text-[#02efff] w-6 h-6" />} title="Gameweek Live" accent="[#02efff]">
                            Track live scoring during an active gameweek. See bonus points, live player stats, and how your squad is performing in real time.
                        </Card>
                        <Card icon={<Trophy className="text-fpl-green w-6 h-6" />} title="Standings">
                            View overall FPL standings and mini-league tables. Track your rank movement and see where you sit relative to rivals.
                        </Card>
                        <Card icon={<Shirt className="text-[#02efff] w-6 h-6" />} title="My Teams" accent="[#02efff]">
                            Save any team or AI analysis for future reference. Review past Wolf recommendations, compare team snapshots across gameweeks, and track how advice translated into points.
                        </Card>
                    </div>
                </Section>

                {/* ── SECTION 5: The Lab ── */}
                <Section
                    title="The Lab"
                    subtitle="A deep-dive into expected statistics — what the model predicts, what actually happened, and what the gap tells you."
                >
                    {/* What are expected stats */}
                    <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-8 mb-6 space-y-4">
                        <div className="flex items-center gap-3 mb-1">
                            <FlaskConical className="text-fpl-green w-5 h-5 shrink-0" />
                            <h3 className="text-white font-bold text-lg">What are expected stats?</h3>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Expected stats measure the <span className="text-white font-semibold">quality</span> of chances rather than just outcomes. A striker who hits the post twice from inside the six-yard box is unlucky — not poor. A midfielder who bags three goals from 35 yards is fortunate — not necessarily a long-term asset. Expected stats let you see past the noise.
                        </p>
                        <div className="grid sm:grid-cols-3 gap-4 pt-2">
                            <div className="bg-slate-800/60 rounded-2xl p-5 space-y-2">
                                <p className="text-[#02efff] text-xs font-black uppercase tracking-widest">xG — Expected Goals</p>
                                <p className="text-gray-400 text-sm leading-relaxed">Each shot is assigned a probability (0–1) based on position, angle, assist type, and whether it was a header. A tap-in from 6 yards might be 0.85 xG. A speculative strike from 30 yards might be 0.03 xG. A player's seasonal xG total shows how many goals the model expected from the chances they received — regardless of whether they scored them.</p>
                            </div>
                            <div className="bg-slate-800/60 rounded-2xl p-5 space-y-2">
                                <p className="text-[#02efff] text-xs font-black uppercase tracking-widest">xA — Expected Assists</p>
                                <p className="text-gray-400 text-sm leading-relaxed">Assigned to the pass that creates a shot. The xA value mirrors the xG of the shot it created — a through-ball leading to a one-on-one carries high xA even if the striker misses. A high xA total signals consistent chance creation, not just lucky assists. It's one of the strongest predictors of future returns for midfielders.</p>
                            </div>
                            <div className="bg-slate-800/60 rounded-2xl p-5 space-y-2">
                                <p className="text-[#02efff] text-xs font-black uppercase tracking-widest">xGC — Expected Goals Conceded</p>
                                <p className="text-gray-400 text-sm leading-relaxed">The sum of xG from shots a team or goalkeeper faced. A low xGC means a defence is limiting shot quality, not just quantity. The Lab uses xGC in a Poisson model (e<sup>−xGC</sup>) to estimate clean sheet probability per game, then accumulates those probabilities across the season to produce an expected clean sheet total.</p>
                            </div>
                        </div>
                    </div>

                    {/* The three tabs */}
                    <div className="grid md:grid-cols-3 gap-5 mb-6">
                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-3">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="text-[#02efff] w-4 h-4" />
                                <p className="text-white font-bold text-sm uppercase tracking-wide">Goals &amp; Assists</p>
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                The default tab. Every player listed with their seasonal xG, xA, xGI (combined involvement), actual goals, assists, and the <span className="text-white font-semibold">difference column</span> — positive means over-performing expectations, negative means under-performing.
                            </p>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                A player significantly over-performing xG may be due a regression. One under-performing their xG is potentially undervalued by the market. The <span className="text-white font-semibold">Top Overperformers / Underperformers</span> panels surface the biggest outliers instantly.
                            </p>
                        </div>
                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-3">
                            <div className="flex items-center gap-2">
                                <Star className="text-purple-400 w-4 h-4" />
                                <p className="text-white font-bold text-sm uppercase tracking-wide">Points (xP)</p>
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Compares <span className="text-white font-semibold">xP (expected FPL points)</span> against actual points. The formula: appearance pts + (xG × position goal pts) + (xA × 3) + P(CS) × CS pts + saves ÷ 3 for GKs. Bonus points are intentionally excluded — they are largely random.
                            </p>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Players with a high Pts−xP gap have benefited heavily from bonus. Players with a negative gap are under-earning relative to their underlying contribution — often good buy candidates.
                            </p>
                        </div>
                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-3">
                            <div className="flex items-center gap-2">
                                <Shield className="text-fpl-green w-4 h-4" />
                                <p className="text-white font-bold text-sm uppercase tracking-wide">Clean Sheets</p>
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                GKs, defenders, and eligible midfielders only. Per game, the model calculates clean sheet probability as e<sup>−xGC</sup> (Poisson). Accumulated over the season, this gives an expected clean sheet total to compare against reality.
                            </p>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                A defender outperforming their xCS may be benefiting from exceptional shot-stopping behind them. One underperforming may be playing in a side that's conceding more shots than the chances reflect — useful context before buying a budget defensive option.
                            </p>
                        </div>
                    </div>

                    {/* Filters + drill-down */}
                    <div className="grid md:grid-cols-2 gap-5 mb-6">
                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-3">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Search className="text-fpl-green w-4 h-4" /> Filters &amp; Sorting
                            </h3>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li className="flex items-start gap-2"><ArrowRight className="text-fpl-green w-3.5 h-3.5 mt-0.5 shrink-0" /><span><span className="text-white font-semibold">Position filter:</span> Narrow to GK, DEF, MID, or FWD. Defenders and forwards have different goal point values (5 vs 4) so comparing their xP without filtering is misleading.</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-fpl-green w-3.5 h-3.5 mt-0.5 shrink-0" /><span><span className="text-white font-semibold">Minimum games:</span> Filters out players with very few appearances. Set to 5+ for more reliable signals, 10+ for high confidence. Small-sample stats are noisy.</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-fpl-green w-3.5 h-3.5 mt-0.5 shrink-0" /><span><span className="text-white font-semibold">Sortable columns:</span> Click any column header to sort. Default is the difference column — biggest over/under-performers first.</span></li>
                            </ul>
                        </div>
                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-3">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <MousePointerClick className="text-[#02efff] w-4 h-4" /> Player Drill-Down
                            </h3>
                            <p className="text-gray-400 text-sm leading-relaxed">Click any player row to open their full seasonal breakdown:</p>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li className="flex items-start gap-2"><ArrowRight className="text-[#02efff] w-3.5 h-3.5 mt-0.5 shrink-0" /><span><span className="text-white font-semibold">Cumulative xG vs Goals chart</span> — see whether their luck is consistent or concentrated in a few matches</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-[#02efff] w-3.5 h-3.5 mt-0.5 shrink-0" /><span><span className="text-white font-semibold">Cumulative xP vs Actual Points</span> — track whether the bonus point gap is growing or stabilising over the season</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-[#02efff] w-3.5 h-3.5 mt-0.5 shrink-0" /><span><span className="text-white font-semibold">Per-GW breakdown table</span> — every appearance with xG, xA, xCS probability, xP, actual points, and the difference for each metric</span></li>
                            </ul>
                        </div>
                    </div>

                    <div className="bg-[#02efff]/5 border border-[#02efff]/20 rounded-2xl p-6 text-sm text-gray-300 leading-relaxed">
                        <span className="text-[#02efff] font-bold">Using the Lab alongside the Wolf:</span> Before targeting a player in the Analyse tab, check their Lab profile. Strong xG/xA with poor actual returns suggests an imminent haul. Consistently low xG but high goal count is a red flag — the market price hasn't corrected yet, but it likely will.
                    </div>
                </Section>

                {/* ── SECTION 5b: Auto-Pilot ── */}
                <Section
                    title="Auto-Pilot"
                    subtitle={`The fully hands-off tier. Available on the ${autopilotPrice}/mo Autopilot membership — the Wolf manages your team every gameweek without you lifting a finger.`}
                >
                    <div className="grid md:grid-cols-2 gap-5 mb-6">
                        <div className="bg-fpl-green/5 border border-fpl-green/30 rounded-3xl p-7 space-y-4">
                            <div className="flex items-center gap-3">
                                <Bot className="text-fpl-green w-5 h-5 shrink-0" />
                                <h3 className="text-white font-bold">How it works</h3>
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                When Auto-Pilot is switched on, the Wolf's server runs a full analysis of your squad approximately <span className="text-white font-semibold">6 hours before every gameweek deadline</span>. It pulls your live team data, assesses form, fixtures, price changes, and chip status — then executes the optimal transfers directly to your FPL account.
                            </p>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Your FPL session is stored securely server-side when you connect via the extension. This means the transfer runs <span className="text-white font-semibold">even if your computer is off</span> — you don't need to be online and the extension doesn't need to be running.
                            </p>
                        </div>
                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-7 space-y-4">
                            <div className="flex items-center gap-3">
                                <Mail className="text-[#02efff] w-5 h-5 shrink-0" />
                                <h3 className="text-white font-bold">The email report</h3>
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed">After every run, a PDF is emailed to your registered address covering:</p>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li className="flex items-start gap-2"><ArrowRight className="text-[#02efff] w-3.5 h-3.5 mt-0.5 shrink-0" /><span>Which transfers were made and the reasoning behind each one</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-[#02efff] w-3.5 h-3.5 mt-0.5 shrink-0" /><span>Captain and vice-captain picks with justification</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-[#02efff] w-3.5 h-3.5 mt-0.5 shrink-0" /><span>Chip recommendations if any were triggered</span></li>
                                <li className="flex items-start gap-2"><ArrowRight className="text-[#02efff] w-3.5 h-3.5 mt-0.5 shrink-0" /><span>Final squad selected for the gameweek</span></li>
                            </ul>
                            <p className="text-gray-500 text-xs">Just check your inbox on matchday — everything else is handled.</p>
                        </div>
                    </div>

                    <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-8 mb-6">
                        <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                            <Clock className="text-fpl-green w-4 h-4" /> Timeline of a typical gameweek
                        </h3>
                        <Step number={1} title="GW deadline approaching" icon={<Clock size={16} />} color="#00ff87">
                            Six hours before the official FPL gameweek deadline, the Auto-Pilot system detects the upcoming cutoff via the FPL bootstrap data and queues your analysis run.
                        </Step>
                        <Step number={2} title="Analysis runs server-side" icon={<Brain size={16} />} color="#02efff">
                            The Wolf fetches your current squad, bank balance, transfer history, chip status, live fixture data, and player form. It builds a complete picture of your situation and runs the full AI analysis — the same engine that powers the Analyse tab, executed automatically on the server.
                        </Step>
                        <Step number={3} title="Transfers executed" icon={<Bot size={16} />} color="#00ff87">
                            The recommended transfers are applied directly to your FPL account using stored session credentials. Your captain and vice-captain are set. If a chip was recommended and you have it available, it is activated.
                        </Step>
                        <Step number={4} title="Report sent to your inbox" icon={<Mail size={16} />} color="#02efff">
                            A PDF summary of every decision is generated and emailed to your registered address. Review it on matchday to see exactly what the Wolf did and why.
                        </Step>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-5">
                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-3">
                            <div className="flex items-center gap-2">
                                <ToggleRight className="text-fpl-green w-4 h-4" />
                                <p className="text-white font-bold text-sm">Switching on and off</p>
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                The Auto-Pilot tab has a simple toggle. Turn it on at any point in the season and the Wolf handles every remaining gameweek from that point forward. Turn it off at any time to revert to manual control — useful if you want to personally manage a specific wildcard or free hit gameweek. The pulsing green dot in the navigation confirms it's active.
                            </p>
                        </div>
                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-3">
                            <div className="flex items-center gap-2">
                                <CreditCard className="text-[#02efff] w-4 h-4" />
                                <p className="text-white font-bold text-sm">Credits and coverage</p>
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Each Auto-Pilot run consumes one analysis credit. The Auto-Pilot tab shows exactly how many gameweeks your current balance covers and which is the last gameweek the Wolf can run for you. Top up at any time from the Pricing page to extend coverage for the rest of the season.
                            </p>
                        </div>
                    </div>
                </Section>

                {/* ── SECTION 6: Pricing tiers ── */}
                <Section
                    title="Membership Tiers"
                    subtitle="The Wolf works at three levels depending on how hands-on you want to be."
                >
                    <div className="grid md:grid-cols-3 gap-5">
                        <div className="bg-slate-900/50 border border-slate-700 rounded-3xl p-7 flex flex-col gap-3">
                            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                                <Zap className="text-gray-400 w-5 h-5" />
                            </div>
                            <h3 className="text-white font-bold text-lg">Scout <span className="text-gray-500 font-normal text-sm ml-1">Free</span></h3>
                            <p className="text-gray-400 text-sm leading-relaxed">Full AI analysis on demand. You read the Wolf's recommendations and apply your transfers manually on the FPL site. No card required — perfect for getting started.</p>
                        </div>
                        <div className="bg-[#02efff]/5 border border-[#02efff]/40 rounded-3xl p-7 flex flex-col gap-3 relative">
                            <span className="absolute top-4 right-4 text-xs font-black text-[#02efff] uppercase tracking-wider">Popular</span>
                            <div className="w-10 h-10 bg-[#02efff]/10 rounded-xl flex items-center justify-center">
                                <Bot className="text-[#02efff] w-5 h-5" />
                            </div>
                            <h3 className="text-white font-bold text-lg">Co-Pilot <span className="text-gray-500 font-normal text-sm ml-1">{copilotPrice}/mo</span></h3>
                            <p className="text-gray-400 text-sm leading-relaxed">You trigger the analysis when you're ready. The Wolf then executes the transfers directly to your FPL team. You stay in control of timing — the Wolf handles the admin.</p>
                        </div>
                        <div className="bg-fpl-green/5 border border-fpl-green/40 rounded-3xl p-7 flex flex-col gap-3 relative">
                            <span className="absolute top-4 right-4 text-xs font-black text-fpl-green uppercase tracking-wider">Best Value</span>
                            <div className="w-10 h-10 bg-fpl-green/10 rounded-xl flex items-center justify-center">
                                <Brain className="text-fpl-green w-5 h-5" />
                            </div>
                            <h3 className="text-white font-bold text-lg">Autopilot <span className="text-gray-500 font-normal text-sm ml-1">{autopilotPrice}/mo</span></h3>
                            <p className="text-gray-400 text-sm leading-relaxed">Fully hands-off. Before every gameweek deadline, the Wolf analyses your squad and applies the optimal transfers automatically. You get a full email log of every decision — just check your inbox on matchday.</p>
                        </div>
                    </div>
                </Section>

                {/* ── SECTION 6: Privacy & data ── */}
                <Section title="Privacy & Data">
                    <div className="grid md:grid-cols-2 gap-5">
                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-7 space-y-4">
                            <div className="flex items-center gap-3">
                                <Lock className="text-fpl-green w-5 h-5 shrink-0" />
                                <h3 className="text-white font-bold">What the extension accesses</h3>
                            </div>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li className="flex items-start gap-2"><Star className="text-fpl-green w-3.5 h-3.5 mt-1 shrink-0" /><span>Your FPL entry ID and team data from the official FPL API</span></li>
                                <li className="flex items-start gap-2"><Star className="text-fpl-green w-3.5 h-3.5 mt-1 shrink-0" /><span>Your authentication token (stored temporarily, never logged)</span></li>
                                <li className="flex items-start gap-2"><Star className="text-fpl-green w-3.5 h-3.5 mt-1 shrink-0" /><span>Nothing else — no browsing history, no other sites</span></li>
                            </ul>
                        </div>
                        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-7 space-y-4">
                            <div className="flex items-center gap-3">
                                <Shield className="text-[#02efff] w-5 h-5 shrink-0" />
                                <h3 className="text-white font-bold">What we store</h3>
                            </div>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li className="flex items-start gap-2"><Star className="text-[#02efff] w-3.5 h-3.5 mt-1 shrink-0" /><span>Your saved team snapshots (only when you explicitly save them)</span></li>
                                <li className="flex items-start gap-2"><Star className="text-[#02efff] w-3.5 h-3.5 mt-1 shrink-0" /><span>AI analysis outputs you choose to save for future reference</span></li>
                                <li className="flex items-start gap-2"><Star className="text-[#02efff] w-3.5 h-3.5 mt-1 shrink-0" /><span>Your account email (hashed password, never stored in plain text)</span></li>
                                <li className="flex items-start gap-2"><Star className="text-[#02efff] w-3.5 h-3.5 mt-1 shrink-0" /><span>Your FPL entry ID to enable auto-loading your team</span></li>
                            </ul>
                        </div>
                    </div>
                </Section>

                {/* CTA */}
                <div className="text-center py-8">
                    <p className="text-gray-500 text-sm mb-6">Still have questions?</p>
                    <a href="/faq" className="inline-flex items-center gap-2 px-8 py-4 bg-fpl-green text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl hover:bg-fpl-green/90 transition-all shadow-[0_0_20px_rgba(0,255,135,0.3)]">
                        Read the FAQ <ArrowRight size={16} />
                    </a>
                </div>
            </div>
        </div>
    );
};

export default HowItWorksView;
