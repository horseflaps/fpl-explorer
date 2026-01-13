import React, { useState, useEffect } from 'react';
import type { Player, Team, ElementType, PlayerSummary } from '../types/fpl';

import { fetchPlayerSummary, getPlayerImageUrl, fallbackPlayerImage } from '../services/api';
import { X, Calendar, Activity, TrendingUp, Shield, Goal, AlertCircle } from 'lucide-react';
import PriceHistoryChart from './PriceHistoryChart';

interface PlayerDetailsModalProps {
    player: Player;
    team: Team;
    position: ElementType;
    teams: Team[];
    onClose: () => void;
}

const PlayerDetailsModal: React.FC<PlayerDetailsModalProps> = ({ player, team, position, teams, onClose }) => {
    const [summary, setSummary] = useState<PlayerSummary | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'matches'>('overview');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSummary = async () => {
            try {
                const data = await fetchPlayerSummary(player.id);
                setSummary(data);
            } catch (error) {
                console.error('Failed to load summary', error);
            } finally {
                setLoading(false);
            }
        };
        loadSummary();

        // Disable body scroll when modal is open
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [player.id]);

    const stats = [
        { label: 'Goals', value: player.goals_scored, icon: Goal },
        { label: 'Assists', value: player.assists, icon: Activity },
        { label: 'Clean Sheets', value: player.clean_sheets, icon: Shield },
        { label: 'Saves', value: player.saves, icon: Shield },
        { label: 'Yellow Cards', value: player.yellow_cards, icon: AlertCircle },
        { label: 'Minutes', value: player.minutes, icon: Calendar },
    ];

    const detailedStats = [
        { label: 'Expected Goals (xG)', value: player.expected_goals },
        { label: 'Expected Assists (xA)', value: player.expected_assists },
        { label: 'Influence', value: player.influence },
        { label: 'Creativity', value: player.creativity },
        { label: 'Threat', value: player.threat },
        { label: 'ICT Index', value: player.ict_index },
        { label: 'BPS', value: player.bps },
        { label: 'Bonus Points', value: player.bonus },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl h-[90vh] overflow-hidden rounded-2xl relative z-10 flex flex-col md:flex-row animate-in fade-in zoom-in duration-200">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-red-500/80 rounded-full transition-colors"
                >
                    <X size={20} className="text-white" />
                </button>

                {/* Left Sidebar: Player Profile */}
                <div className="md:w-1/3 bg-slate-950 p-6 flex flex-col items-center border-r border-slate-800 overflow-y-auto custom-scrollbar">
                    <div className="relative w-40 h-52 mb-6 shrink-0">

                        <img
                            src={getPlayerImageUrl(player.code)}
                            alt={player.web_name}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = fallbackPlayerImage;
                            }}
                            className="w-full h-full object-cover rounded-lg shadow-2xl shadow-fpl-green/20"
                        />
                        <div className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-4 border-slate-950 ${player.status === 'a' ? 'bg-fpl-green' :
                            player.status === 'i' ? 'bg-red-500' : 'bg-yellow-500'
                            }`} />
                    </div>

                    <h2 className="text-3xl font-black text-white text-center mb-1">{player.first_name} {player.second_name}</h2>
                    <div className="flex items-center gap-2 mb-6">
                        <span className="bg-slate-800 px-3 py-1 rounded-full text-sm font-bold text-fpl-blue">{team.name}</span>
                        <span className="bg-slate-800 px-3 py-1 rounded-full text-sm font-bold text-fpl-pink">{position.singular_name}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full mb-6">
                        <div className="bg-slate-900/50 p-3 rounded-xl text-center border border-slate-800">
                            <div className="text-xs text-gray-500 uppercase">Price</div>
                            <div className="text-2xl font-bold text-white">£{player.now_cost / 10}m</div>
                        </div>
                        <div className="bg-slate-900/50 p-3 rounded-xl text-center border border-slate-800">
                            <div className="text-xs text-gray-500 uppercase">Points</div>
                            <div className="text-2xl font-bold text-fpl-green">{player.total_points}</div>
                        </div>
                    </div>
                </div>

                {/* Right Content: Stats & Tabs */}
                <div className="md:w-2/3 flex flex-col bg-slate-900/95 h-full overflow-hidden min-h-0">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-800 shrink-0">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'overview' ? 'border-fpl-green text-fpl-green bg-slate-800/50' : 'border-transparent text-gray-400 hover:text-white hover:bg-slate-800/30'}`}
                        >
                            Season Stats
                        </button>
                        <button
                            onClick={() => setActiveTab('matches')}
                            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'matches' ? 'border-fpl-green text-fpl-green bg-slate-800/50' : 'border-transparent text-gray-400 hover:text-white hover:bg-slate-800/30'}`}
                        >
                            Matches & Fixtures
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {loading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fpl-green"></div>
                            </div>
                        ) : activeTab === 'overview' ? (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <Activity className="text-fpl-pink" size={20} />
                                        Performance Overview
                                    </h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        {stats.map((stat) => (
                                            <div key={stat.label} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                                <div className="text-gray-400 text-xs mb-1">{stat.label}</div>
                                                <div className="text-xl font-bold text-white">{stat.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <TrendingUp className="text-fpl-blue" size={20} />
                                        Advanced Metrics
                                    </h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        {detailedStats.map((stat) => (
                                            <div key={stat.label} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                                <div className="text-gray-400 text-xs mb-1">{stat.label}</div>
                                                <div className="text-xl font-bold text-white">{stat.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {summary && (
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-4">Price History</h3>
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                            <PriceHistoryChart history={summary.history} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {summary && (
                                    <>
                                        <div>
                                            <h3 className="text-lg font-bold text-white mb-4">Next 5 Fixtures</h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-slate-950 text-gray-400">
                                                        <tr>
                                                            <th className="p-3 rounded-l-lg">Date</th>
                                                            <th className="p-3">GW</th>
                                                            <th className="p-3">Opponent</th>
                                                            <th className="p-3 rounded-r-lg text-center">Difficulty</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800">
                                                        {summary.fixtures.slice(0, 5).map((fix) => (
                                                            <tr key={fix.id} className="hover:bg-slate-800/30">
                                                                <td className="p-3 text-white">{new Date(fix.kickoff_time).toLocaleDateString()}</td>
                                                                <td className="p-3 text-gray-300">GW{fix.event}</td>
                                                                <td className="p-3">
                                                                    <span className={fix.is_home ? 'text-white' : 'text-gray-400'}>
                                                                        {fix.is_home ? '(H)' : '(A)'} vs {fix.opponent_name || teams.find(t => t.id === (fix.is_home ? fix.team_a : fix.team_h))?.name || 'TBD'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${fix.difficulty <= 2 ? 'bg-green-500/20 text-green-400' :
                                                                        fix.difficulty === 3 ? 'bg-yellow-500/20 text-yellow-400' :
                                                                            'bg-red-500/20 text-red-400'
                                                                        }`}>
                                                                        {fix.difficulty}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-bold text-white mb-4">Match History</h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm whitespace-nowrap">
                                                    <thead className="bg-slate-950 text-gray-400">
                                                        <tr>
                                                            <th className="p-3 rounded-l-lg">GW</th>
                                                            <th className="p-3">Opp</th>
                                                            <th className="p-3 text-center">Pts</th>
                                                            <th className="p-3 text-center">Mins</th>
                                                            <th className="p-3 text-center">G</th>
                                                            <th className="p-3 text-center">A</th>
                                                            <th className="p-3 text-center">CS</th>
                                                            <th className="p-3 rounded-r-lg text-center">BPS</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800">
                                                        {[...summary.history].reverse().map((match) => (
                                                            <tr key={match.fixture} className="hover:bg-slate-800/30">
                                                                <td className="p-3 text-gray-300">GW{match.round}</td>
                                                                <td className="p-3 text-gray-400">
                                                                    {match.was_home ? '(H)' : '(A)'} vs {teams.find(t => t.id === match.opponent_team)?.short_name || match.opponent_team}
                                                                </td>
                                                                <td className="p-3 text-center font-bold text-fpl-green">{match.total_points}</td>
                                                                <td className="p-3 text-center text-gray-300">{match.minutes}</td>
                                                                <td className="p-3 text-center text-gray-300">{match.goals_scored}</td>
                                                                <td className="p-3 text-center text-gray-300">{match.assists}</td>
                                                                <td className="p-3 text-center text-gray-300">{match.clean_sheets}</td>
                                                                <td className="p-3 text-center text-gray-300">{match.bps}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerDetailsModal;
