import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shirt, Loader2, AlertTriangle, X, Activity, Sparkles, HelpCircle, Info } from 'lucide-react';
import type { FPLResponse, EntryPicksResponse, Pick, LiveStats, Entry } from '../types/fpl';
import { fetchEntryPicks, fetchLiveEvent, fetchEntry, fetchEntryHistory } from '../services/api';
import { analyzeTeam } from '../services/analysis';
import type { AnalysisResult } from '../services/analysis';
import { fetchGeminiAnalysis, generateGeminiPrompt } from '../services/gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PitchViewProps {
    data: FPLResponse;
}

const PitchView: React.FC<PitchViewProps> = ({ data }) => {
    const [searchParams] = useSearchParams();
    const entryId = searchParams.get('entry') ? Number(searchParams.get('entry')) : null;

    // Default to current gameweek
    const currentEvent = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
    const [selectedGw, setSelectedGw] = useState<number>(currentEvent?.id || 1);

    // View State
    const [view, setView] = useState<'pitch' | 'list'>('pitch');
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

    // AI State
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiAnalysisText, setAiAnalysisText] = useState<string | null>(null);

    const [picksData, setPicksData] = useState<EntryPicksResponse | null>(null);
    const [entryData, setEntryData] = useState<Entry | null>(null);
    const [entryHistory, setEntryHistory] = useState<any | null>(null);
    const [liveStats, setLiveStats] = useState<Record<number, LiveStats>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch Entry Details (Name, history, etc) - only once
    useEffect(() => {
        if (entryId) {
            Promise.all([
                fetchEntry(entryId),
                fetchEntryHistory(entryId)
            ]).then(([entry, history]) => {
                setEntryData(entry);
                setEntryHistory(history);
            }).catch(e => console.error("Error fetching entry details:", e));
        }
    }, [entryId]);

    useEffect(() => {
        const loadPicks = async () => {
            if (!entryId) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                // Fetch both picks and live stats for the selected GW
                const [picks, live] = await Promise.all([
                    fetchEntryPicks(entryId, selectedGw),
                    fetchLiveEvent(selectedGw)
                ]);
                setPicksData(picks);

                // Map live stats by element ID
                if (live && live.elements) {
                    const stats: Record<number, LiveStats> = {};
                    live.elements.forEach((el: any) => {
                        stats[el.id] = el.stats;
                    });
                    setLiveStats(stats);
                }
            } catch (err) {
                setError('Failed to load team data. Check the Team ID.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadPicks();
    }, [entryId, selectedGw]);

    const handlePrevGw = () => setSelectedGw(prev => Math.max(1, prev - 1));
    const handleNextGw = () => setSelectedGw(prev => Math.min(38, prev + 1));

    const getPlayer = (id: number) => data.elements.find(e => e.id === id);
    const getTeam = (id: number) => data.teams.find(t => t.id === id);

    if (!entryId) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                <Shirt size={48} className="mb-4 text-gray-600" />
                <p>No Team ID provided.</p>
            </div>
        );
    }

    if (loading && !picksData) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="w-8 h-8 text-fpl-green animate-spin" />
            </div>
        );
    }

    if (error || !picksData) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-red-400">
                <AlertTriangle size={48} className="mb-4" />
                <p>{error || 'Team not found'}</p>
            </div>
        );
    }

    const handleGeminiAnalysis = async () => {
        if (!picksData || !entryData) return;
        setIsAiLoading(true);
        try {
            const prompt = generateGeminiPrompt(data, picksData, entryData, entryHistory);
            const result = await fetchGeminiAnalysis(prompt);
            setAiAnalysisText(result);
        } catch (error: any) {
            console.error("Gemini Error:", error);
            setAiAnalysisText(`Error: ${error.message || "Unknown error occurred"}`);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleAnalyze = () => {
        if (!picksData || !entryData) return;

        if (!analysisResult) {
            const result = analyzeTeam(data, picksData, entryData);
            setAnalysisResult(result);
        }
        setShowAnalysis(true);
    };

    // Categorize players by position for the pitch
    // 1: GKP, 2: DEF, 3: MID, 4: FWD
    const startingXI = picksData.picks.filter(p => p.position <= 11);
    const bench = picksData.picks.filter(p => p.position > 11);

    const gkp = startingXI.filter(p => getPlayer(p.element)?.element_type === 1);
    const def = startingXI.filter(p => getPlayer(p.element)?.element_type === 2);
    const mid = startingXI.filter(p => getPlayer(p.element)?.element_type === 3);
    const fwd = startingXI.filter(p => getPlayer(p.element)?.element_type === 4);

    const renderPlayer = (pick: Pick) => {
        const player = getPlayer(pick.element);
        const team = player ? getTeam(player.team) : null;
        // Use live stats for points if available (for specific GW), else fallback to player current points
        const points = liveStats[pick.element]?.total_points ?? player?.event_points ?? 0;

        if (!player || !team) return null;

        return (
            <div key={pick.element} className="flex flex-col items-center justify-center w-24 md:w-32 animate-in zoom-in duration-300 group cursor-pointer perspective-[500px]">
                <div className={`relative mb-1 transition-transform duration-300 transform group-hover:scale-110 ${pick.is_captain || pick.is_vice_captain ? 'scale-110' : ''}`} style={{ transformStyle: 'preserve-3d' }}>
                    <img
                        src={`https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${team.code}-66.png`}
                        alt={team.name}
                        className="w-12 md:w-16 object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.3)]"
                    />

                    {/* Captain/Vice-Captain Badge */}
                    {pick.is_captain && (
                        <div className="absolute -bottom-1 -right-2 bg-slate-900 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-white z-20">
                            C
                        </div>
                    )}
                    {pick.is_vice_captain && (
                        <div className="absolute -bottom-1 -right-2 bg-slate-900 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-white z-20">
                            V
                        </div>
                    )}
                </div>

                {/* Info Card - Styled to match reference exactly */}
                <div className="flex flex-col w-full max-w-[90px] md:max-w-[110px] shadow-lg">
                    {/* Name Box (White) */}
                    <div className="bg-white text-slate-900 px-1 py-0.5 rounded-t-[3px] text-center w-full">
                        <p className="text-[9px] md:text-[11px] font-black uppercase truncate leading-tight tracking-tighter">{player.web_name}</p>
                    </div>
                    {/* Points Box (Dark) */}
                    <div className="bg-[#37003c] text-white px-1 py-0.5 rounded-b-[3px] text-center w-full border-t border-slate-200/20">
                        <p className="text-[10px] md:text-[12px] font-black leading-none">{points > 0 ? points : '-'}</p>
                    </div>
                </div>
            </div>
        );
    };

    const renderListView = () => {
        if (!picksData) return null;

        const allPicks = picksData.picks;
        const gks = allPicks.filter(p => getPlayer(p.element)?.element_type === 1);
        const defs = allPicks.filter(p => getPlayer(p.element)?.element_type === 2);
        const mids = allPicks.filter(p => getPlayer(p.element)?.element_type === 3);
        const fwds = allPicks.filter(p => getPlayer(p.element)?.element_type === 4);

        const groups = [
            { title: 'Goalkeeper', players: gks },
            { title: 'Defenders', players: defs },
            { title: 'Midfielders', players: mids },
            { title: 'Forwards', players: fwds },
        ];

        return (
            <div className="max-w-4xl mx-auto px-4 md:px-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Table Header */}
                <div className="grid grid-cols-[3fr,repeat(13,1fr)] gap-0 text-center text-[10px] md:text-sm text-white/60 font-bold border-b border-white/10 pb-2 mb-4">
                    <div className="text-left pl-2">Player</div>
                    <div title="Points">Pts</div>
                    <div title="Minutes Played">MP</div>
                    <div title="Goals Scored">GS</div>
                    <div title="Assists">A</div>
                    <div title="Clean Sheets">CS</div>
                    <div title="Goals Conceded">GC</div>
                    <div title="Own Goals">OG</div>
                    <div title="Penalties Saved">PS</div>
                    <div title="Penalties Missed">PM</div>
                    <div title="Yellow Cards">YC</div>
                    <div title="Red Cards">RC</div>
                    <div title="Saves">S</div>
                    <div title="Bonus">B</div>
                </div>

                {groups.map((group) => (
                    <div key={group.title} className="mb-6">
                        <h3 className="text-white font-bold text-sm mb-2 pl-2 border-l-4 border-[#00ff87]">{group.title}</h3>
                        <div className="space-y-1">
                            {group.players.map((pick) => {
                                const player = getPlayer(pick.element);
                                const team = player ? getTeam(player.team) : null;
                                const stats = liveStats[pick.element];
                                const isSub = pick.position > 11;

                                if (!player || !team) return null;

                                return (
                                    <div key={pick.element} className={`grid grid-cols-[3fr,repeat(13,1fr)] gap-0 items-center py-3 text-center text-[10px] md:text-xs border-b border-white/5 hover:bg-white/5 transition-colors ${isSub ? 'opacity-70' : ''}`}>
                                        {/* Player Info */}
                                        <div className="flex items-center gap-3 text-left pl-2 relative">
                                            {isSub && <span className="absolute -left-2 text-[8px] text-yellow-400 rotate-90 origin-right">SUB</span>}
                                            <div className="relative">
                                                <img
                                                    src={`https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${team.code}-66.png`}
                                                    alt={team.name}
                                                    className="w-8 h-8 object-contain"
                                                />
                                                {pick.is_captain && <div className="absolute -bottom-1 -right-1 bg-white text-black text-[8px] font-black w-3 h-3 flex items-center justify-center rounded-full">C</div>}
                                                {pick.is_vice_captain && <div className="absolute -bottom-1 -right-1 bg-white text-black text-[8px] font-black w-3 h-3 flex items-center justify-center rounded-full">V</div>}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white leading-tight">{player.web_name}</div>
                                                <div className="text-[9px] text-white/50">{team.name} <span className="uppercase mx-1">{['', 'GKP', 'DEF', 'MID', 'FWD'][player.element_type]}</span></div>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="font-black text-white text-sm">{stats?.total_points ?? 0}</div>
                                        <div>{stats?.minutes ?? 0}</div>
                                        <div className={stats?.goals_scored ? 'text-[#00ff87] font-bold' : ''}>{stats?.goals_scored ?? 0}</div>
                                        <div className={stats?.assists ? 'text-[#00ff87] font-bold' : ''}>{stats?.assists ?? 0}</div>
                                        <div className={stats?.clean_sheets ? 'text-[#00ff87] font-bold' : ''}>{stats?.clean_sheets ?? 0}</div>
                                        <div>{stats?.goals_conceded ?? 0}</div>
                                        <div className={stats?.own_goals ? 'text-red-400 font-bold' : ''}>{stats?.own_goals ?? 0}</div>
                                        <div>{stats?.penalties_saved ?? 0}</div>
                                        <div className={stats?.penalties_missed ? 'text-red-400 font-bold' : ''}>{stats?.penalties_missed ?? 0}</div>
                                        <div className={stats?.yellow_cards ? 'text-yellow-400 font-bold' : ''}>{stats?.yellow_cards ?? 0}</div>
                                        <div className={stats?.red_cards ? 'text-red-500 font-bold' : ''}>{stats?.red_cards ?? 0}</div>
                                        <div>{stats?.saves ?? 0}</div>
                                        <div className={stats?.bonus ? 'text-[#02efff] font-bold' : ''}>{stats?.bonus ?? 0}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderAnalysisModal = () => {
        if (!showAnalysis) return null;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAnalysis(false)}></div>
                <div className="relative bg-[#220025] w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-[#37003c] p-6 border-b border-white/10 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#00ff87] p-2 rounded-lg">
                                <Activity className="text-[#37003c]" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight">THE WOLF'S DIAGNOSIS</h2>
                                <p className="text-[#00ff87] text-xs font-bold uppercase tracking-widest">Alpha Wolf Mode</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setShowAnalysis(false)} className="text-white/50 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 md:p-8 space-y-8">
                        {/* Glossary Hook */}
                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <Info className="text-blue-400 shrink-0 mt-0.5" size={20} />
                            <div className="space-y-1">
                                <p className="text-blue-200 text-sm font-bold">First Time? Decode the Hunt</p>
                                <p className="text-blue-200/60 text-xs leading-relaxed">
                                    Hover over <HelpCircle size={12} className="inline mb-0.5" /> icons to translate FPL analytics. Learn about EO, xGI, and Strategy below.
                                </p>
                            </div>
                        </div>

                        {/* Mode Toggle */}
                        <div className="flex justify-center mb-6">
                            <button
                                onClick={() => setAiAnalysisText(null)}
                                className={`px-4 py-2 rounded-l-lg text-xs font-bold uppercase border border-white/10 ${!aiAnalysisText ? 'bg-[#00ff87] text-[#37003c]' : 'bg-white/5 text-white'}`}
                            >
                                Instant Analysis
                            </button>
                            <button
                                onClick={handleGeminiAnalysis}
                                className={`px-4 py-2 rounded-r-lg text-xs font-bold uppercase border border-white/10 flex items-center gap-2 ${aiAnalysisText ? 'bg-[#02efff] text-[#37003c]' : 'bg-white/5 text-white'}`}
                            >
                                <Sparkles size={14} />
                                Gemini AI
                            </button>
                        </div>

                        {/* Gemini Loading / Result */}
                        {isAiLoading && (
                            <div className="flex flex-col items-center justify-center py-12 text-[#02efff] gap-4">
                                <Loader2 className="animate-spin w-8 h-8" />
                                <span className="text-sm font-bold uppercase tracking-widest animate-pulse">Summoning the Wolf...</span>
                            </div>
                        )}

                        {/* Gemini Content */}
                        {aiAnalysisText && !isAiLoading && (
                            <div className="bg-white/5 p-6 md:p-8 rounded-xl border border-white/10 overflow-hidden">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        h1: ({ node, ...props }: any) => <h1 className="text-2xl font-black text-[#02efff] mb-4 uppercase tracking-tight border-b border-white/10 pb-2" {...props} />,
                                        h2: ({ node, ...props }: any) => <h2 className="text-xl font-bold text-[#00ff87] mt-6 mb-3 uppercase tracking-wide" {...props} />,
                                        h3: ({ node, ...props }: any) => <h3 className="text-lg font-bold text-white mt-4 mb-2" {...props} />,
                                        p: ({ node, ...props }: any) => <p className="text-white/80 text-sm leading-relaxed mb-4" {...props} />,
                                        ul: ({ node, ...props }: any) => <ul className="list-disc list-inside space-y-2 mb-4 text-white/80 text-sm" {...props} />,
                                        ol: ({ node, ...props }: any) => <ol className="list-decimal list-inside space-y-2 mb-4 text-white/80 text-sm" {...props} />,
                                        li: ({ node, ...props }: any) => <li className="pl-2" {...props} />,
                                        strong: ({ node, ...props }: any) => <strong className="text-[#02efff] font-bold" {...props} />,
                                        table: ({ node, ...props }: any) => <div className="overflow-x-auto mb-6 rounded-lg border border-white/10"><table className="min-w-full divide-y divide-white/10 text-sm" {...props} /></div>,
                                        thead: ({ node, ...props }: any) => <thead className="bg-white/10" {...props} />,
                                        th: ({ node, ...props }: any) => <th className="px-4 py-3 text-left text-xs font-black text-[#00ff87] uppercase tracking-wider" {...props} />,
                                        td: ({ node, ...props }: any) => <td className="px-4 py-3 text-white/80 whitespace-normal break-words border-t border-white/5" {...props} />,
                                        blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-[#02efff] pl-4 italic text-white/60 my-4" {...props} />,
                                    }}
                                >
                                    {aiAnalysisText}
                                </ReactMarkdown>
                            </div>
                        )}

                        {/* Local Analysis Content (Default) */}
                        {!aiAnalysisText && !isAiLoading && analysisResult && (
                            <>
                                {/* 1. EO Trap */}
                                <section className="bg-white/5 rounded-xl p-6 border border-white/5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-white">1. The "EO" Trap</h3>
                                            <div className="group relative">
                                                <HelpCircle size={14} className="text-white/30 cursor-help hover:text-white transition-colors" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-4 bg-slate-900 border border-white/20 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95 z-50 text-[11px] leading-relaxed text-white/90">
                                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-white/20 rotate-45"></div>
                                                    <span className="text-[#02efff] font-black block mb-1 uppercase tracking-wider">EO (Effective Ownership)</span>
                                                    Ownership + Captaincy weight. If a player is 100%+ EO and you don't own them, their points actively hurt your rank.
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-3 py-1 rounded-full text-xs font-black ${analysisResult.eoTrap.riskLevel === 'HIGH' ? 'bg-red-500 text-white' : analysisResult.eoTrap.riskLevel === 'MEDIUM' ? 'bg-yellow-500 text-black' : 'bg-[#00ff87] text-[#37003c]'}`}>
                                                RISK: {analysisResult.eoTrap.riskLevel}
                                            </span>
                                            <div className="group relative">
                                                <p className="text-[10px] text-white/40 border-b border-white/10 border-dotted cursor-help">What is Risk?</p>
                                                <div className="absolute top-full right-0 mt-3 w-64 p-4 bg-slate-900 border border-white/20 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95 z-50 text-[11px] leading-relaxed text-white/90 text-left">
                                                    <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-900 border-l border-t border-white/20 rotate-45"></div>
                                                    <span className="text-red-400 font-black block mb-1 uppercase tracking-wider">RISK Level</span>
                                                    How vulnerable your current rank is to non-owned 'Template' players. High Risk means missing icons who score big could tank your position.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-white/80 text-sm mb-4 italic">"{analysisResult.eoTrap.description}"</p>
                                    {analysisResult.eoTrap.players.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs text-white/50 font-bold uppercase">Threats (Not Owned)</p>
                                            <div className="flex gap-3 overflow-x-auto pb-2">
                                                {analysisResult.eoTrap.players.map(p => (
                                                    <div key={p.id} className="bg-white/10 px-3 py-2 rounded flex items-center gap-2 min-w-[140px]">
                                                        <div className="text-xs">
                                                            <div className="font-bold text-white">{p.web_name}</div>
                                                            <div className="text-[#02efff]">EO: {p.selected_by_percent}%</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>

                                {/* 2. Sustainability */}
                                <section className="bg-white/5 rounded-xl p-6 border border-white/5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <h3 className="text-lg font-bold text-white">2. xGI Sustainability Check</h3>
                                        <div className="group relative">
                                            <HelpCircle size={14} className="text-white/30 cursor-help hover:text-white transition-colors" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-4 bg-slate-900 border border-white/20 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95 z-50 text-[11px] leading-relaxed text-white/90">
                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-white/20 rotate-45"></div>
                                                <span className="text-[#00ff87] font-black block mb-1 uppercase tracking-wider">xGI (Expected Goal Involvement)</span>
                                                Measures quality of chances. A high xGI means a player *should* be scoring or assisting, even if they haven't yet.
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-white/80 text-sm mb-4 italic">"{analysisResult.sustainability.description}"</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {analysisResult.sustainability.underperforming.length > 0 && (
                                            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                                                <p className="text-green-400 font-bold text-xs uppercase mb-2">✓ Keep (Underperforming xGI)</p>
                                                <div className="space-y-1">
                                                    {analysisResult.sustainability.underperforming.map(p => (
                                                        <div key={p.id} className="text-white text-sm font-semibold">{p.web_name}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {analysisResult.sustainability.overperforming.length > 0 && (
                                            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                                                <p className="text-red-400 font-bold text-xs uppercase mb-2">⚠ Sell (Overperforming xGI)</p>
                                                <div className="space-y-1">
                                                    {analysisResult.sustainability.overperforming.map(p => (
                                                        <div key={p.id} className="text-white text-sm font-semibold">{p.web_name}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* 3. The Verdict */}
                                <section className="relative overflow-hidden rounded-xl p-6 md:p-8">
                                    <div className="absolute inset-0 bg-gradient-to-r from-[#00ff87]/20 to-[#02efff]/20 border border-[#00ff87]/30"></div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-6">
                                            <h3 className="text-2xl font-black text-white italic">THE VERDICT</h3>
                                            <div className="h-px bg-white/20 flex-1"></div>
                                            <div className="group relative flex items-center gap-2">
                                                <span className="text-xs font-bold uppercase tracking-widest text-[#02efff] border-b border-[#02efff]/30 border-dotted cursor-help">{analysisResult.verdict.strategy}</span>
                                                <div className="absolute top-full right-0 mt-3 w-64 p-4 bg-slate-900 border border-white/20 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95 z-50 text-[11px] leading-relaxed text-white/90 text-left">
                                                    <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-900 border-l border-t border-white/20 rotate-45"></div>
                                                    <span className="text-[#02efff] font-black block mb-1 uppercase tracking-wider">Strategy: {analysisResult.verdict.strategy}</span>
                                                    The Wolf's recommended playstyle. **Protect Rank** means playing safety first; **Attack** means taking calculated punts to climb.
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* BUY */}
                                            <div className="bg-[#37003c]/80 p-4 rounded-lg border border-[#00ff87]/50 relative overflow-hidden group">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-[#00ff87]"></div>
                                                <p className="text-[#00ff87] font-black text-xs uppercase mb-1 tracking-widest">PRIORITY BUY</p>
                                                {analysisResult.verdict.buy ? (
                                                    <>
                                                        <p className="text-2xl font-black text-white mb-1">{analysisResult.verdict.buy.player.web_name}</p>
                                                        <p className="text-white/60 text-xs leading-relaxed">{analysisResult.verdict.buy.reason}</p>
                                                    </>
                                                ) : <p className="text-white/50 text-sm">No urgent buys.</p>}
                                            </div>

                                            {/* SELL */}
                                            <div className="bg-[#37003c]/80 p-4 rounded-lg border border-red-500/50 relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                                                <p className="text-red-500 font-black text-xs uppercase mb-1 tracking-widest">SUGGESTED SELL</p>
                                                {analysisResult.verdict.sell ? (
                                                    <>
                                                        <p className="text-2xl font-black text-white mb-1">{analysisResult.verdict.sell.player.web_name}</p>
                                                        <p className="text-white/60 text-xs leading-relaxed">{analysisResult.verdict.sell.reason}</p>
                                                    </>
                                                ) : <p className="text-white/50 text-sm">No urgent sells.</p>}
                                            </div>

                                            {/* CAPTAIN */}
                                            <div className="bg-[#37003c]/80 p-4 rounded-lg border border-[#02efff]/50 relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-[#02efff]"></div>
                                                <p className="text-[#02efff] font-black text-xs uppercase mb-1 tracking-widest">CAPTAINCY</p>
                                                {analysisResult.verdict.captain ? (
                                                    <>
                                                        <p className="text-2xl font-black text-white mb-1">{analysisResult.verdict.captain.player.web_name}</p>
                                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${analysisResult.verdict.captain.safety === 'Safe' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                            {analysisResult.verdict.captain.safety} Pick
                                                        </span>
                                                    </>
                                                ) : <p className="text-white/50 text-sm">No captain data.</p>}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const activePoints = picksData?.entry_history.points ?? 0;
    const rank = picksData?.entry_history.rank ?? 0;

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            {/* Gameweek Nav & View Toggle */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10 mb-6">
                <div className="flex items-center gap-4 order-2 md:order-1">
                    <button
                        onClick={handlePrevGw}
                        disabled={loading || selectedGw <= 1}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-[#581c5e] hover:bg-[#6a2570] transition-colors text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {'<'}
                    </button>
                    <div className="text-center min-w-[120px]">
                        <h3 className="text-xl font-bold">{loading ? 'Loading...' : `Gameweek ${selectedGw}`}</h3>
                        <span className="text-[10px] text-[#00ff87] font-bold uppercase tracking-widest">Selected Event</span>
                    </div>
                    <button
                        onClick={handleNextGw}
                        disabled={loading || selectedGw >= 38}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-[#581c5e] hover:bg-[#6a2570] transition-colors text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {'>'}
                    </button>
                </div>

                <div className="flex bg-[#37003c] rounded-lg p-1 gap-1 order-1 md:order-2">
                    <button
                        onClick={() => setView('pitch')}
                        className={`px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all flex items-center gap-2 ${view === 'pitch' ? 'bg-[#00ff87] text-[#37003c]' : 'text-white/60 hover:text-white'}`}
                    >
                        Pitch View
                    </button>
                    <button
                        onClick={() => setView('list')}
                        className={`px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all flex items-center gap-2 ${view === 'list' ? 'bg-[#00ff87] text-[#37003c]' : 'text-white/60 hover:text-white'}`}
                    >
                        List View
                    </button>
                </div>
            </div>

            {/* Stats Grid & Team Info */}
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    {/* Left Side: Team Name */}
                    <div className="flex-1 text-center md:text-right">
                        <h2 className="text-xl md:text-3xl font-black text-white tracking-tighter uppercase leading-tight line-clamp-2">{entryData?.name || 'My Team'}</h2>
                        <div className="h-1 w-12 bg-[#00ff87] ml-auto mt-2 hidden md:block"></div>
                    </div>

                    {/* Center: Points Diamond */}
                    <div className="relative group shrink-0">
                        <div className="bg-gradient-to-b from-[#00ff87] to-[#02efff] text-slate-900 rounded-2xl p-6 md:p-8 shadow-[0_0_50px_rgba(0,255,135,0.3)] transition-all transform hover:scale-105 group-hover:shadow-[0_0_70px_rgba(2,239,255,0.4)]">
                            <span className={`block text-5xl md:text-7xl font-black tracking-tighter leading-none text-center ${loading ? 'opacity-50 blur-sm' : ''}`}>{activePoints}</span>
                            <span className="block text-[10px] md:text-xs font-black uppercase tracking-[0.2em] mt-2 text-center">Total Points</span>
                        </div>
                    </div>

                    {/* Right Side: Manager Name */}
                    <div className="flex-1 text-center md:text-left">
                        {entryData && (
                            <>
                                <p className="text-white/40 text-[10px] uppercase tracking-widest font-black mb-1">Director of Football</p>
                                <h3 className="text-lg md:text-2xl font-bold text-white tracking-tight">{entryData.player_first_name} {entryData.player_last_name}</h3>
                            </>
                        )}
                        <div className="h-1 w-12 bg-[#02efff] mt-2 hidden md:block"></div>
                    </div>
                </div>

                {/* Sub Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <div className="flex flex-col items-center">
                        <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Average</span>
                        <span className="text-xl font-black text-white">{data.events.find(e => e.id === selectedGw)?.average_entry_score || '-'}</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Highest</span>
                        <span className="text-xl font-black text-[#00ff87]">{data.events.find(e => e.id === selectedGw)?.highest_score || '-'}</span>
                    </div>
                    <div className="flex flex-col items-center border-t md:border-t-0 pt-4 md:pt-0 border-white/10">
                        <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">GW Rank</span>
                        <span className="text-xl font-black text-white">{rank?.toLocaleString() || '-'}</span>
                    </div>
                    <div className="flex flex-col items-center border-t md:border-t-0 pt-4 md:pt-0 border-white/10">
                        <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Transfers</span>
                        <span className="text-xl font-black text-[#02efff]">{picksData?.entry_history.event_transfers || 0}</span>
                    </div>
                </div>
            </div>

            {/* AI Diagnosis CTA - Prominent Headline Feature */}
            <div className="max-w-4xl mx-auto px-4 md:px-0 pt-4">
                <button
                    onClick={handleAnalyze}
                    className="w-full relative group overflow-hidden rounded-2xl p-6 bg-gradient-to-r from-[#37003c] to-[#4d0c54] border border-white/10 transition-all hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(0,255,135,0.15)] active:scale-[0.99] shadow-2xl"
                >
                    {/* Pulsating background decoration */}
                    <div className="absolute inset-0 bg-[#00ff87]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#02efff]/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

                    <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-[#37003c] flex items-center justify-center border border-white/20 shadow-xl group-hover:border-[#00ff87]/50 transition-all group-hover:shadow-[0_0_20px_rgba(0,255,135,0.3)]">
                                <Activity className="w-8 h-8 text-[#00ff87] animate-pulse" />
                            </div>
                            <div className="text-left">
                                <h3 className="text-2xl md:text-3xl font-black text-white italic tracking-tighter uppercase leading-none mb-1 group-hover:text-[#00ff87] transition-colors">
                                    The Wolf's Diagnosis
                                </h3>
                                <p className="text-white/60 text-xs font-bold uppercase tracking-[0.2em]">Alpha Strategy Analysis mode</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="hidden md:block h-12 w-px bg-white/10"></div>
                            <div className="px-6 py-3 bg-[#00ff87] text-[#37003c] font-black rounded-lg text-sm uppercase flex items-center gap-2 group-hover:bg-[#02efff] transition-all group-hover:translate-x-1 group-hover:shadow-[0_0_15px_rgba(2,239,255,0.4)]">
                                Get Analysis
                                <Sparkles size={16} />
                            </div>
                        </div>
                    </div>
                </button>
            </div>
            {/* View Switching */}
            {view === 'list' ? renderListView() : (
                /* Pitch Section */
                <div className="relative -mt-4 px-2 md:px-0">
                    <div className="perspective-[1000px] flex justify-center overflow-hidden pb-8">
                        <div
                            className="relative w-full max-w-[550px] aspect-[9/14] bg-[#00b53f] rounded-t-xl shadow-2xl [transform:rotateX(30deg)] border-x-[12px] border-t-[12px] border-[#04f5ff]/10 box-border mx-auto ring-1 ring-white/10"
                            style={{ transformStyle: 'preserve-3d' }}
                        >
                            {/* Fantasy Banners Header */}
                            <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-[#02efff] to-[#37003c] flex justify-between items-center px-4 md:px-8 z-10 rounded-t-lg">
                                <div className="text-[#37003c] font-black text-lg tracking-tighter flex items-center gap-1">
                                    <span className="bg-[#37003c] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">🦁</span>
                                    Fantasy
                                </div>
                                <div className="text-[#37003c] font-black text-lg tracking-tighter flex items-center gap-1">
                                    <span className="bg-[#37003c] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">🦁</span>
                                    Fantasy
                                </div>
                            </div>

                            {/* Pitch Surface (Green) */}
                            <div className="absolute inset-0 bg-[#00b53f] pointer-events-none">
                                {/* Grass Pattern */}
                                <div className="absolute inset-x-0 bottom-0 top-14 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.05)_0px,rgba(0,0,0,0.05)_40px,transparent_40px,transparent_80px)] opacity-50"></div>
                                <div className="absolute inset-x-0 bottom-0 top-14 bg-gradient-to-b from-black/20 via-transparent to-transparent"></div>
                            </div>

                            {/* Pitch Markings Layer */}
                            <div className="absolute inset-x-0 bottom-0 top-14 pointer-events-none opacity-90 mix-blend-overlay" style={{ transform: 'translateZ(0)' }}>
                                {/* Outer Border */}
                                <div className="absolute inset-4 md:inset-6 border-2 border-white/80"></div>

                                {/* Corner Arcs */}
                                <div className="absolute top-4 left-4 md:top-6 md:left-6 w-8 h-8 md:w-16 md:h-16 border-b-2 border-r-2 border-white/80 rounded-br-full"></div>
                                <div className="absolute top-4 right-4 md:top-6 md:right-6 w-8 h-8 md:w-16 md:h-16 border-b-2 border-l-2 border-white/80 rounded-bl-full"></div>
                                <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 w-8 h-8 md:w-16 md:h-16 border-t-2 border-r-2 border-white/80 rounded-tr-full"></div>
                                <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 w-8 h-8 md:w-16 md:h-16 border-t-2 border-l-2 border-white/80 rounded-tl-full"></div>

                                {/* Halfway Line */}
                                <div className="absolute top-1/2 left-4 right-4 md:left-6 md:right-6 h-0.5 bg-white/80 -translate-y-1/2"></div>
                                <div className="absolute top-1/2 left-1/2 w-32 h-32 md:w-40 md:h-40 border-2 border-white/80 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                                <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-white/80 rounded-full -translate-x-1/2 -translate-y-1/2"></div>

                                {/* Top Goal Area (GKP) */}
                                <div className="absolute top-4 md:top-6 left-1/2 w-[50%] h-[15%] border-b-2 border-x-2 border-white/80 -translate-x-1/2"></div>
                                <div className="absolute top-4 md:top-6 left-1/2 w-[22%] h-[6%] border-b-2 border-x-2 border-white/80 -translate-x-1/2 bg-white/10"></div>
                                <div className="absolute top-[calc(15%+24px)] left-1/2 w-[20%] h-[5%] border-b-2 border-x-2 border-white/40 rounded-full -translate-x-1/2"></div>

                                {/* Bottom Goal Area (FWD) */}
                                <div className="absolute bottom-4 md:bottom-6 left-1/2 w-[50%] h-[15%] border-t-2 border-x-2 border-white/80 -translate-x-1/2"></div>
                                <div className="absolute bottom-4 md:bottom-6 left-1/2 w-[22%] h-[6%] border-t-2 border-x-2 border-white/80 -translate-x-1/2 bg-white/10"></div>
                                <div className="absolute bottom-[calc(15%+24px)] left-1/2 w-[20%] h-[5%] border-t-2 border-x-2 border-white/40 rounded-full -translate-x-1/2"></div>
                            </div>

                            {/* Players Layer */}
                            <div className="absolute inset-x-0 bottom-0 top-14 py-6 md:py-8 flex flex-col justify-between z-10" style={{ transformStyle: 'preserve-3d' }}>
                                {/* GKP */}
                                <div className="flex justify-center perspective-[500px]">
                                    {gkp.map((p) => (
                                        <div key={p.element} className="[transform:translateZ(20px)_rotateX(-30deg)] transition-transform hover:[transform:translateZ(40px)_rotateX(-30deg)_scale(1.1)] duration-300">
                                            {renderPlayer(p)}
                                        </div>
                                    ))}
                                </div>

                                {/* DEF */}
                                <div className="flex justify-center gap-4 md:gap-8 perspective-[500px]">
                                    {def.map((p) => (
                                        <div key={p.element} className="[transform:translateZ(20px)_rotateX(-30deg)] transition-transform hover:[transform:translateZ(40px)_rotateX(-30deg)_scale(1.1)] duration-300">
                                            {renderPlayer(p)}
                                        </div>
                                    ))}
                                </div>

                                {/* MID */}
                                <div className="flex justify-center gap-4 md:gap-8 perspective-[500px]">
                                    {mid.map((p) => (
                                        <div key={p.element} className="[transform:translateZ(20px)_rotateX(-30deg)] transition-transform hover:[transform:translateZ(40px)_rotateX(-30deg)_scale(1.1)] duration-300">
                                            {renderPlayer(p)}
                                        </div>
                                    ))}
                                </div>

                                {/* FWD */}
                                <div className="flex justify-center gap-4 md:gap-8 perspective-[500px]">
                                    {fwd.map((p) => (
                                        <div key={p.element} className="[transform:translateZ(20px)_rotateX(-30deg)] transition-transform hover:[transform:translateZ(40px)_rotateX(-30deg)_scale(1.1)] duration-300">
                                            {renderPlayer(p)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bench Container - Floating 'glass' look over bottom pitch edge */}
                    <div className="relative -mt-24 max-w-2xl mx-auto z-30">
                        <div className="bg-gradient-to-b from-[#37003c]/90 to-[#220025]/95 backdrop-blur-md rounded-t-xl p-4 border-t border-white/20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                            <div className="flex justify-center items-center gap-4 mb-3">
                                <div className="h-px bg-white/20 flex-1"></div>
                                <h3 className="text-[10px] uppercase text-white/70 font-black tracking-[0.2em]">Substitutes</h3>
                                <div className="h-px bg-white/20 flex-1"></div>
                            </div>
                            <div className="flex justify-center gap-3 md:gap-6">
                                {bench.map((p, i) => (
                                    <div key={p.element} className="relative group">
                                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-white/50 font-bold tracking-widest uppercase">
                                            {i === 0 ? 'GKP' : `${i}.`}
                                        </span>
                                        {renderPlayer(p)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Analysis Modal */}
            {renderAnalysisModal()}
        </div>
    );
};

export default PitchView;
