import React, { useEffect, useState } from 'react';
import { Activity, Trophy, TrendingUp, Users } from 'lucide-react';
import type { FPLResponse } from '../types/fpl';
import { fetchLiveEvent } from '../services/api';

interface GameweekLiveViewProps {
    data: FPLResponse;
}

const GameweekLiveView: React.FC<GameweekLiveViewProps> = ({ data }) => {
    const [liveData, setLiveData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const currentEvent = data.events.find(e => e.is_current);

    useEffect(() => {
        const loadLiveData = async () => {
            if (!currentEvent) {
                setLoading(false);
                return;
            }
            try {
                const live = await fetchLiveEvent(currentEvent.id);
                setLiveData(live);
            } catch (error) {
                console.error("Error loading live data", error);
            } finally {
                setLoading(false);
            }
        };
        loadLiveData();
    }, [currentEvent]);

    const getPlayer = (id: number) => data.elements.find(p => p.id === id);

    if (!currentEvent) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400">
                <Activity className="w-16 h-16 mb-4 text-gray-600" />
                <h2 className="text-2xl font-bold text-white mb-2">No Live Gameweek</h2>
                <p>The season is not currently in a live gameweek.</p>
            </div>
        );
    }

    // Get top performing players from live data
    const topPerformers = liveData?.elements
        ? [...liveData.elements]
            .sort((a: any, b: any) => b.stats.total_points - a.stats.total_points)
            .slice(0, 10)
        : [];

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
                        <div className="text-xs text-fpl-green font-bold uppercase tracking-wider mt-1">Live Now</div>
                    </div>
                </div>
            </div>

            {/* Live Top Performers */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <TrendingUp className="text-fpl-green" size={20} />
                        Top Performers
                    </h3>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-400">Loading live data...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/50 text-xs uppercase text-gray-400 font-bold">
                                <tr>
                                    <th className="p-4">Rank</th>
                                    <th className="p-4">Player</th>
                                    <th className="p-4 text-right">Points</th>
                                    <th className="p-4 text-right">BPS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {topPerformers.map((item: any, index: number) => {
                                    const player = getPlayer(item.id);
                                    if (!player) return null;

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="p-4 text-gray-500 font-mono">#{index + 1}</td>
                                            <td className="p-4">
                                                <div className="font-bold text-white">{player.web_name}</div>
                                                <div className="text-xs text-gray-500">
                                                    {data.teams.find(t => t.id === player.team)?.short_name} • {data.element_types.find(e => e.id === player.element_type)?.singular_name_short}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-bold text-fpl-green text-lg">{item.stats.total_points}</td>
                                            <td className="p-4 text-right text-gray-400">{item.stats.bps}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameweekLiveView;
