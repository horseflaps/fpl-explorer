import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shirt, Loader2, AlertTriangle } from 'lucide-react';
import type { FPLResponse, EntryPicksResponse, Pick, LiveStats } from '../types/fpl';
import { fetchEntryPicks, fetchLiveEvent } from '../services/api';

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

    const [picksData, setPicksData] = useState<EntryPicksResponse | null>(null);
    const [liveStats, setLiveStats] = useState<Record<number, LiveStats>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            <div key={pick.element} className="flex flex-col items-center justify-center w-20 md:w-28 animate-in zoom-in duration-300 group cursor-pointer perspective-[500px]">
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
                <div className="flex flex-col w-full max-w-[80px] md:max-w-[100px] shadow-lg">
                    {/* Name Box (White) */}
                    <div className="bg-white text-slate-900 px-1 py-0.5 rounded-t-[3px] text-center w-full">
                        <p className="text-[8px] md:text-[10px] font-black uppercase truncate leading-tight tracking-tighter">{player.web_name}</p>
                    </div>
                    {/* Points Box (Dark) */}
                    <div className="bg-[#37003c] text-white px-1 py-0.5 rounded-b-[3px] text-center w-full border-t border-slate-200/20">
                        <p className="text-[8px] md:text-[10px] font-bold leading-none">{points > 0 ? points : '-'}</p>
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

    const activePoints = picksData?.entry_history.points ?? 0;
    const rank = picksData?.entry_history.rank ?? 0;

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            {/* Header / Stats Dashboard */}
            <div className="bg-[#37003c] -mx-4 md:-mx-8 px-4 md:px-8 py-4 md:py-8 text-white shadow-2xl relative z-20">
                <div className="max-w-4xl mx-auto space-y-6">
                    <h2 className="text-2xl md:text-3xl font-black tracking-tight">My Team</h2>
                    <button
                        onClick={() => setView('pitch')}
                        className={`px-4 py-1.5 text-xs font-bold rounded shadow-sm transition-all ${view === 'pitch' ? 'bg-[#37003c] text-white' : 'text-white/60 hover:bg-[#581c5e] hover:text-white'}`}
                    >
                        Pitch View
                    </button>
                    <button
                        onClick={() => setView('list')}
                        className={`px-4 py-1.5 text-xs font-bold rounded shadow-sm transition-all ${view === 'list' ? 'bg-[#37003c] text-white' : 'text-white/60 hover:bg-[#581c5e] hover:text-white'}`}
                    >
                        List View
                    </button>
                </div>
            </div>

            {/* Gameweek Nav */}
            <div className="flex justify-center items-center gap-6">
                <button
                    onClick={handlePrevGw}
                    disabled={loading || selectedGw <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[#581c5e] hover:bg-[#6a2570] transition-colors text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {'<'}
                </button>
                <div className="text-center min-w-[120px]">
                    <h3 className="text-xl font-bold">{loading ? 'Loading...' : `Gameweek ${selectedGw}`}</h3>
                    <span className="text-xs text-[#00ff87] font-bold cursor-pointer hover:underline">Team of the Week →</span>
                </div>
                <button
                    onClick={handleNextGw}
                    disabled={loading || selectedGw >= 38}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[#581c5e] hover:bg-[#6a2570] transition-colors text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {'>'}
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-5 gap-2 md:gap-8 text-center items-end max-w-3xl mx-auto">
                <div className="flex flex-col gap-1">
                    <span className="text-xl md:text-2xl font-bold">{data.events.find(e => e.id === selectedGw)?.average_entry_score || '-'}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Average Points</span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xl md:text-2xl font-bold">{data.events.find(e => e.id === selectedGw)?.highest_score || '-'}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center justify-center gap-1">
                        Highest Points <span className="text-[8px]">→</span>
                    </span>
                </div>

                {/* Highlights (Total Points) */}
                <div className="relative -top-2">
                    <div className="bg-gradient-to-b from-[#00ff87] to-[#02efff] text-slate-900 rounded-xl p-3 shadow-[0_0_30px_rgba(0,255,135,0.4)] transition-all hover:scale-105 cursor-pointer">
                        <span className={`block text-4xl md:text-5xl font-black tracking-tighter leading-none ${loading ? 'opacity-50 blur-sm' : ''}`}>{activePoints}</span>
                        <span className="text-[10px] font-black uppercase tracking-tight">Total Points</span>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <span className="text-lg md:text-xl font-bold tracking-tight">{rank?.toLocaleString() || '-'}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">GW Rank</span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xl md:text-2xl font-bold">{picksData?.entry_history.event_transfers || 0}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center justify-center gap-1">
                        Transfers <span className="text-[8px]">→</span>
                    </span>
                </div>
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
        </div>
    );
};

export default PitchView;
