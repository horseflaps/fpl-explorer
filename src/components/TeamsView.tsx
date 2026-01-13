import React, { useState, useEffect } from 'react';
import type { FPLResponse, Fixture } from '../types/fpl';
import { Shield, Calendar, Users, Activity, Loader2 } from 'lucide-react';
import { fetchFixtures } from '../services/api';

interface TeamsViewProps {
    data: FPLResponse;
    selectedTeamId: number | null;
    onSelectTeam: (id: number | null) => void;
}

const TeamsView: React.FC<TeamsViewProps> = ({ data, selectedTeamId, onSelectTeam }) => {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadFixtures = async () => {
            const data = await fetchFixtures();
            setFixtures(data);
            setLoading(false);
        };
        loadFixtures();
    }, []);

    const activeTeam = selectedTeamId ? data.teams.find(t => t.id === selectedTeamId) : null;

    // Derived Data
    const teamFixtures = activeTeam ? fixtures.filter(f => f.team_h === activeTeam.id || f.team_a === activeTeam.id) : [];

    // Sort by date
    const sortedFixtures = [...teamFixtures].sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());

    const nextFixtures = sortedFixtures.filter(f => !f.finished).slice(0, 3);
    const recentResults = sortedFixtures.filter(f => f.finished).slice(-5).reverse();

    const teamPlayers = activeTeam ? data.elements.filter(p => p.team === activeTeam.id) : [];
    const topPlayers = [...teamPlayers].sort((a, b) => b.total_points - a.total_points).slice(0, 3);

    const getOpponent = (fix: Fixture) => {
        if (!activeTeam) return null;
        const oppId = fix.team_h === activeTeam.id ? fix.team_a : fix.team_h;
        return data.teams.find(t => t.id === oppId);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Selector */}
            <div className="glass p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Team Hub</h2>
                    <p className="text-gray-400 text-sm">Select a club to view detailed analysis and schedule</p>
                </div>
                <div className="w-full md:w-72">
                    <select
                        value={selectedTeamId || ''}
                        onChange={(e) => onSelectTeam(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-fpl-blue focus:ring-1 focus:ring-fpl-blue appearance-none cursor-pointer"
                    >
                        <option value="">Select a Team...</option>
                        {data.teams.map((team) => (
                            <option key={team.id} value={team.id}>
                                {team.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Team Content */}
            {activeTeam ? (
                <div className="space-y-6">
                    {/* Header Card */}
                    <div className="bg-slate-950 rounded-2xl p-8 border border-slate-800 text-center relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-fpl-green via-fpl-blue to-fpl-pink" />

                        <div className="flex justify-center mb-4 relative z-10">
                            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center p-4 backdrop-blur-sm shadow-xl border border-white/10">
                                <img
                                    src={`https://resources.premierleague.com/premierleague/badges/t${activeTeam.code}.png`}
                                    alt={activeTeam.name}
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://resources.premierleague.com/premierleague/badges/t1.png'; // Fallback
                                    }}
                                />
                            </div>
                        </div>

                        <h3 className="text-5xl font-black text-white mb-2 tracking-tight relative z-10">{activeTeam.name}</h3>
                        <p className="text-gray-400 font-mono text-sm uppercase tracking-widest relative z-10">Short Code: {activeTeam.short_name} • Est. 1888</p>

                        <div className="flex justify-center gap-8 mt-6">
                            <div className="text-center">
                                <div className="text-2xl font-black text-fpl-green">{activeTeam.strength_attack_home}</div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold">Att (H)</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-black text-fpl-blue">{activeTeam.strength_defence_home}</div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold">Def (H)</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-black text-white">{activeTeam.strength}</div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold" title="Fixture Difficulty Rating">FDR</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-6">

                        {/* Key Players */}
                        <div className="glass-card p-6 flex flex-col">
                            <div className="flex items-center gap-3 mb-6">
                                <Users className="text-fpl-purple" size={24} />
                                <h4 className="text-lg font-bold text-white">Top 3 Players</h4>
                            </div>
                            <div className="space-y-4">
                                {topPlayers.map(player => (
                                    <div key={player.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                                                <img
                                                    src={`https://resources.premierleague.com/premierleague/photos/players/110x140/p${player.code}.png`}
                                                    alt={player.web_name}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'https://resources.premierleague.com/premierleague/photos/players/110x140/Photo-Missing.png';
                                                    }}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div>
                                                <div className="font-bold text-white text-sm">{player.web_name}</div>
                                                <div className="text-xs text-gray-400">£{player.now_cost / 10}m</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-black text-fpl-green text-lg">{player.total_points}</div>
                                            <div className="text-[10px] text-gray-500 uppercase">Pts</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Form */}
                        <div className="glass-card p-6 flex flex-col">
                            <div className="flex items-center gap-3 mb-6">
                                <Activity className="text-blue-400" size={24} />
                                <h4 className="text-lg font-bold text-white">Recent Form</h4>
                            </div>
                            {loading ? (
                                <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-fpl-green" /></div>
                            ) : (
                                <div className="space-y-3">
                                    {recentResults.map(fix => {
                                        const opponent = getOpponent(fix);
                                        const isHome = fix.team_h === activeTeam.id;
                                        const scoreHome = fix.team_h_score ?? 0;
                                        const scoreAway = fix.team_a_score ?? 0;
                                        const myScore = isHome ? scoreHome : scoreAway;
                                        const oppScore = isHome ? scoreAway : scoreHome;

                                        let result = 'D';
                                        let color = 'text-gray-400';
                                        if (myScore > oppScore) { result = 'W'; color = 'text-fpl-green'; }
                                        else if (myScore < oppScore) { result = 'L'; color = 'text-red-500'; }

                                        return (
                                            <div key={fix.id} className="flex items-center justify-between text-sm border-b border-slate-800 pb-2 last:border-0">
                                                <div className="flex items-center gap-2 w-1/3">
                                                    <span className={`font-black ${color} w-4`}>{result}</span>
                                                    <span className="text-gray-500 text-xs">{new Date(fix.kickoff_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                </div>
                                                <div className="text-center font-bold text-white w-1/3">
                                                    {scoreHome} - {scoreAway}
                                                </div>
                                                <div className="text-right text-gray-400 w-1/3 truncate">
                                                    vs {opponent?.short_name} ({isHome ? 'H' : 'A'})
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {recentResults.length === 0 && <p className="text-gray-500 text-sm">No recent matches.</p>}
                                </div>
                            )}
                        </div>

                        {/* Next Fixtures */}
                        <div className="glass-card p-6 flex flex-col">
                            <div className="flex items-center gap-3 mb-6">
                                <Calendar className="text-yellow-400" size={24} />
                                <h4 className="text-lg font-bold text-white">Next Matches</h4>
                            </div>
                            {loading ? (
                                <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-fpl-green" /></div>
                            ) : (
                                <div className="space-y-3">
                                    {nextFixtures.map(fix => {
                                        const opponent = getOpponent(fix);
                                        const isHome = fix.team_h === activeTeam.id;
                                        return (
                                            <div key={fix.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-1 h-8 rounded-full ${isHome ? 'bg-fpl-green' : 'bg-fpl-blue'}`}></div>
                                                    <div>
                                                        <div className="font-bold text-white text-sm">{opponent?.name}</div>
                                                        <div className="text-xs text-gray-500">{isHome ? 'Home' : 'Away'} • GW{fix.event}</div>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-400 font-mono bg-slate-900 px-2 py-1 rounded">
                                                    {new Date(fix.kickoff_time).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {nextFixtures.length === 0 && <p className="text-gray-500 text-sm">No upcoming fixtures scheduled.</p>}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <Shield size={64} className="text-gray-600 mb-4" />
                    <p className="text-xl text-gray-400 font-medium">Select a team above to view stats</p>
                </div>
            )}
        </div>
    );
};

export default TeamsView;
