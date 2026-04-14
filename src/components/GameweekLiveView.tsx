import React, { useEffect, useState, useMemo } from 'react';
import { Activity, Trophy, TrendingUp, Users, Search } from 'lucide-react';
import type { FPLResponse } from '../types/fpl';
import { fetchLiveEvent } from '../services/api';

interface GameweekLiveViewProps {
    data: FPLResponse;
}

const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

type SortKey = 'total_points' | 'bps' | 'minutes' | 'goals_scored' | 'assists' | 'clean_sheets' | 'saves' | 'bonus' | 'yellow_cards' | 'red_cards';

const GameweekLiveView: React.FC<GameweekLiveViewProps> = ({ data }) => {
    const [liveData, setLiveData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('total_points');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [posFilter, setPosFilter] = useState<number | null>(null);

    const currentEvent = data.events.find(e => e.is_current) ?? data.events.find(e => e.is_previous);

    useEffect(() => {
        const loadLiveData = async () => {
            if (!currentEvent) { setLoading(false); return; }
            try {
                const live = await fetchLiveEvent(currentEvent.id);
                setLiveData(live);
            } catch (error) {
                console.error('Error loading live data', error);
            } finally {
                setLoading(false);
            }
        };
        loadLiveData();
    }, [currentEvent]);

    const getPlayer = (id: number) => data.elements.find(p => p.id === id);

    const players = useMemo(() => {
        if (!liveData?.elements) return [];
        return liveData.elements
            .filter((item: any) => item.stats.minutes > 0)
            .map((item: any) => ({ ...item, _player: getPlayer(item.id) }))
            .filter((item: any) => {
                if (!item._player) return false;
                const q = search.toLowerCase();
                if (q && !item._player.web_name.toLowerCase().includes(q) &&
                    !item._player.first_name.toLowerCase().includes(q) &&
                    !item._player.second_name.toLowerCase().includes(q)) return false;
                if (posFilter && item._player.element_type !== posFilter) return false;
                return true;
            })
            .sort((a: any, b: any) => {
                const av = a.stats[sortKey] ?? 0;
                const bv = b.stats[sortKey] ?? 0;
                return sortDir === 'desc' ? bv - av : av - bv;
            });
    }, [liveData, search, posFilter, sortKey, sortDir, data.elements]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const Th: React.FC<{ col: SortKey; label: string; title: string }> = ({ col, label, title }) => (
        <th
            className="p-3 text-right text-[10px] text-gray-500 uppercase font-bold cursor-pointer hover:text-white transition-colors select-none whitespace-nowrap"
            title={title}
            onClick={() => toggleSort(col)}
        >
            {label}{sortKey === col && <span className="ml-0.5 opacity-60">{sortDir === 'desc' ? '↓' : '↑'}</span>}
        </th>
    );

    if (!currentEvent) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400">
                <Activity className="w-16 h-16 mb-4 text-gray-600" />
                <h2 className="text-2xl font-bold text-white mb-2">No Live Gameweek</h2>
                <p>The season is not currently in a live gameweek.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-fpl-purple to-slate-900 rounded-xl p-6 border border-white/10 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="text-gray-300 text-sm font-medium mb-1 flex items-center gap-2">
                            <Activity size={16} /> Average Score
                        </div>
                        <div className="text-4xl font-black text-white">{currentEvent.average_entry_score}</div>
                    </div>
                    <Activity className="absolute right-[-20px] bottom-[-20px] text-white/5 w-32 h-32" />
                </div>

                <div className="bg-gradient-to-br from-fpl-green to-slate-900 rounded-xl p-6 border border-white/10 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="text-gray-300 text-sm font-medium mb-1 flex items-center gap-2">
                            <Trophy size={16} /> Highest Score
                        </div>
                        <div className="text-4xl font-black text-white">{currentEvent.highest_score}</div>
                    </div>
                    <Trophy className="absolute right-[-20px] bottom-[-20px] text-white/5 w-32 h-32" />
                </div>

                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="text-gray-300 text-sm font-medium mb-1 flex items-center gap-2">
                            <Users size={16} /> Gameweek
                        </div>
                        <div className="text-4xl font-black text-white">{currentEvent.name}</div>
                        <div className="text-xs text-fpl-green font-bold uppercase tracking-wider mt-1">
                            {data.events.find(e => e.is_current) ? 'Live Now' : 'Final'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Player Table */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 flex flex-col">
                <div className="p-4 border-b border-slate-700 bg-slate-900/95 backdrop-blur-sm space-y-3 sticky top-0 z-20 rounded-t-xl">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <TrendingUp className="text-fpl-green" size={20} />
                            Player Scores
                            {!loading && <span className="text-sm text-gray-500 font-normal ml-1">({players.length} played)</span>}
                        </h3>
                        {/* Position filter */}
                        <div className="flex gap-1">
                            {([['All', null], ['GK', 1], ['DEF', 2], ['MID', 3], ['FWD', 4]] as [string, number | null][]).map(([label, val]) => (
                                <button
                                    key={String(val)}
                                    onClick={() => setPosFilter(val)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${posFilter === val ? 'bg-fpl-green text-slate-900' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Search */}
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search player..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-fpl-blue transition-all"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-400">Loading gameweek data...</div>
                ) : (
                    <div className="overflow-auto max-h-[65vh]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-900 sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 text-left text-[10px] text-gray-500 uppercase font-bold w-10">#</th>
                                    <th className="p-3 text-left text-[10px] text-gray-500 uppercase font-bold">Player</th>
                                    <Th col="minutes" label="Mins" title="Minutes played" />
                                    <Th col="goals_scored" label="G" title="Goals scored" />
                                    <Th col="assists" label="A" title="Assists" />
                                    <Th col="clean_sheets" label="CS" title="Clean sheet" />
                                    <Th col="saves" label="Sv" title="Saves (GK)" />
                                    <Th col="bonus" label="Bon" title="Bonus points awarded (top 3 BPS earners per match get 3, 2, 1 bonus points)" />
                                    <Th col="bps" label="BPS" title="Bonus Points System score — the raw underlying score used to decide who gets bonus points. Higher = more likely to receive bonus." />
                                    <Th col="yellow_cards" label="YC" title="Yellow cards" />
                                    <Th col="red_cards" label="RC" title="Red cards" />
                                    <Th col="total_points" label="Pts" title="Total FPL points this gameweek" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/30">
                                {players.map((item: any, index: number) => {
                                    const player = item._player;
                                    const s = item.stats;
                                    const team = data.teams.find(t => t.id === player.team);
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="p-3 text-gray-600 font-mono text-xs">{index + 1}</td>
                                            <td className="p-3">
                                                <div className="font-bold text-white">{player.web_name}</div>
                                                <div className="text-xs text-gray-500">
                                                    {team?.short_name} · {POSITION_LABELS[player.element_type]}
                                                </div>
                                            </td>
                                            <td className="p-3 text-right text-gray-400 font-mono">{s.minutes}'</td>
                                            <td className="p-3 text-right">{s.goals_scored > 0 ? <span className="text-fpl-green font-bold">{s.goals_scored}</span> : <span className="text-gray-700">–</span>}</td>
                                            <td className="p-3 text-right">{s.assists > 0 ? <span className="text-fpl-blue font-bold">{s.assists}</span> : <span className="text-gray-700">–</span>}</td>
                                            <td className="p-3 text-right">{s.clean_sheets > 0 ? <span className="text-yellow-400 font-bold">{s.clean_sheets}</span> : <span className="text-gray-700">–</span>}</td>
                                            <td className="p-3 text-right">{s.saves > 0 ? <span className="text-purple-400 font-bold">{s.saves}</span> : <span className="text-gray-700">–</span>}</td>
                                            <td className="p-3 text-right">{s.bonus > 0 ? <span className="text-orange-400 font-bold">{s.bonus}</span> : <span className="text-gray-700">–</span>}</td>
                                            <td className="p-3 text-right text-gray-400">{s.bps}</td>
                                            <td className="p-3 text-right">{s.yellow_cards > 0 ? <span className="text-yellow-300 font-bold">{s.yellow_cards}</span> : <span className="text-gray-700">–</span>}</td>
                                            <td className="p-3 text-right">{s.red_cards > 0 ? <span className="text-red-500 font-bold">{s.red_cards}</span> : <span className="text-gray-700">–</span>}</td>
                                            <td className="p-3 text-right font-black text-fpl-green text-base">{s.total_points}</td>
                                        </tr>
                                    );
                                })}
                                {players.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={12} className="p-8 text-center text-gray-500">No players found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* BPS explanation footer */}
                <div className="p-4 border-t border-slate-700/50 bg-slate-900/30 text-xs text-gray-400 leading-relaxed">
                    <span className="font-bold text-gray-400">BPS</span> = Bonus Points System score. FPL calculates a raw score for every player based on actions like goals, assists, key passes, tackles, saves etc. The top 3 BPS scorers in each match receive bonus points: <span className="text-orange-400 font-bold">3</span> (1st), <span className="text-orange-400 font-bold">2</span> (2nd), <span className="text-orange-400 font-bold">1</span> (3rd). <span className="font-bold text-gray-400">Bon</span> = bonus points actually awarded. Click any column header to sort.
                </div>
            </div>
        </div>
    );
};

export default GameweekLiveView;
