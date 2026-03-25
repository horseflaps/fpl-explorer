import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Loader2, List, LayoutGrid } from 'lucide-react';
import type { FPLResponse, Team, Fixture } from '../types/fpl';
import { fetchFixtures } from '../services/api';

interface StandingsViewProps {
    data: FPLResponse;
}

interface TeamStats extends Team {
    played: number;
    win: number;
    draw: number;
    loss: number;
    points: number;
    goals_for: number;
    goals_against: number;
    goal_difference: number;
    recent_points: number[];
    home_w: number; home_d: number; home_l: number; home_gf: number; home_ga: number;
    away_w: number; away_d: number; away_l: number; away_gf: number; away_ga: number;
}

const StandingsView: React.FC<StandingsViewProps> = ({ data }) => {
    const navigate = useNavigate();
    const [standings, setStandings] = useState<TeamStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [detailed, setDetailed] = useState(false);

    useEffect(() => {
        const calculateStandings = async () => {
            try {
                const fixtures = await fetchFixtures();
                const statsMap = new Map<number, TeamStats>();
                data.teams.forEach(team => {
                    statsMap.set(team.id, {
                        ...team,
                        played: 0, win: 0, draw: 0, loss: 0, points: 0,
                        goals_for: 0, goals_against: 0, goal_difference: 0,
                        recent_points: [],
                        home_w: 0, home_d: 0, home_l: 0, home_gf: 0, home_ga: 0,
                        away_w: 0, away_d: 0, away_l: 0, away_gf: 0, away_ga: 0,
                    });
                });

                const sortedFixtures = [...fixtures].sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());

                sortedFixtures.forEach((fix: Fixture) => {
                    if (!fix.finished) return;
                    const homeStats = statsMap.get(fix.team_h);
                    const awayStats = statsMap.get(fix.team_a);
                    if (!homeStats || !awayStats) return;

                    const hScore = fix.team_h_score ?? 0;
                    const aScore = fix.team_a_score ?? 0;

                    homeStats.played += 1;
                    awayStats.played += 1;
                    homeStats.goals_for += hScore; homeStats.goals_against += aScore;
                    homeStats.goal_difference = homeStats.goals_for - homeStats.goals_against;
                    awayStats.goals_for += aScore; awayStats.goals_against += hScore;
                    awayStats.goal_difference = awayStats.goals_for - awayStats.goals_against;

                    homeStats.home_gf += hScore; homeStats.home_ga += aScore;
                    awayStats.away_gf += aScore; awayStats.away_ga += hScore;

                    if (hScore > aScore) {
                        homeStats.win += 1; homeStats.points += 3; awayStats.loss += 1;
                        homeStats.home_w += 1; awayStats.away_l += 1;
                        homeStats.recent_points.push(3); awayStats.recent_points.push(0);
                    } else if (aScore > hScore) {
                        awayStats.win += 1; awayStats.points += 3; homeStats.loss += 1;
                        awayStats.away_w += 1; homeStats.home_l += 1;
                        awayStats.recent_points.push(3); homeStats.recent_points.push(0);
                    } else {
                        homeStats.draw += 1; homeStats.points += 1;
                        awayStats.draw += 1; awayStats.points += 1;
                        homeStats.home_d += 1; awayStats.away_d += 1;
                        homeStats.recent_points.push(1); awayStats.recent_points.push(1);
                    }
                });

                const sorted = Array.from(statsMap.values()).sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
                    return b.goals_for - a.goals_for;
                });
                sorted.forEach((team, i) => { team.position = i + 1; });
                setStandings(sorted);
            } catch (error) {
                console.error("Failed to calculate standings", error);
            } finally {
                setLoading(false);
            }
        };
        calculateStandings();
    }, [data.teams]);

    const renderForm = (points: number[]) => {
        const last5 = points.slice(-5);
        return (
            <div className="flex gap-1 justify-center">
                {last5.map((p, i) => (
                    <div key={i} className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-slate-900 ${p === 3 ? 'bg-fpl-green' : p === 1 ? 'bg-gray-400' : 'bg-red-500 text-white'}`} title={p === 3 ? 'Win' : p === 1 ? 'Draw' : 'Loss'}>
                        {p === 3 ? 'W' : p === 1 ? 'D' : 'L'}
                    </div>
                ))}
            </div>
        );
    };

    const positionBadge = (pos: number) =>
        pos === 1 ? 'bg-yellow-500 text-black' :
        pos <= 4 ? 'bg-slate-400 text-slate-900' :
        pos === 5 ? 'bg-orange-500 text-white' :
        pos >= 18 ? 'bg-red-600 text-white' : 'text-gray-400';

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 text-fpl-green animate-spin" /></div>;
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-500/20 rounded-lg">
                        <Trophy className="w-8 h-8 text-yellow-500" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white">Premier League Table</h2>
                        <p className="text-gray-400">Live Standings 2025/26</p>
                    </div>
                </div>
                <button
                    onClick={() => setDetailed(v => !v)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${detailed ? 'bg-[#00ff87] text-[#37003c]' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                >
                    {detailed ? <List size={13} /> : <LayoutGrid size={13} />}
                    {detailed ? 'Standard View' : 'Detailed View'}
                </button>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    {detailed ? (
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-800 text-gray-400 font-bold border-b border-slate-700">
                                    <th className="p-3 text-center w-12">Pos</th>
                                    <th className="p-3">Club</th>
                                    <th className="p-3 text-center">P</th>
                                    <th className="p-3 text-center text-[#02efff]/80" colSpan={5}>— Home —</th>
                                    <th className="p-3 text-center text-[#00ff87]/80" colSpan={5}>— Away —</th>
                                    <th className="p-3 text-center">GD</th>
                                    <th className="p-3 text-center text-[#00ff87]">Pts</th>
                                    <th className="p-3 text-center">Form</th>
                                </tr>
                                <tr className="bg-slate-800/60 text-[10px] text-gray-500 font-bold border-b border-slate-700">
                                    <th colSpan={3} />
                                    <th className="pb-2 text-center text-[#02efff]/60">W</th>
                                    <th className="pb-2 text-center text-[#02efff]/60">D</th>
                                    <th className="pb-2 text-center text-[#02efff]/60">L</th>
                                    <th className="pb-2 text-center text-[#02efff]/60">GF</th>
                                    <th className="pb-2 text-center text-[#02efff]/60">GA</th>
                                    <th className="pb-2 text-center text-[#00ff87]/60">W</th>
                                    <th className="pb-2 text-center text-[#00ff87]/60">D</th>
                                    <th className="pb-2 text-center text-[#00ff87]/60">L</th>
                                    <th className="pb-2 text-center text-[#00ff87]/60">GF</th>
                                    <th className="pb-2 text-center text-[#00ff87]/60">GA</th>
                                    <th colSpan={3} />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {standings.map((team) => (
                                    <tr key={team.id} className="hover:bg-slate-800/50 transition-colors group">
                                        <td className="p-3 text-center">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${positionBadge(team.position)}`}>{team.position}</div>
                                        </td>
                                        <td className="p-3">
                                            <button onClick={() => navigate(`/teams?id=${team.id}`)} className="font-bold text-white hover:text-fpl-green hover:underline text-left">{team.name}</button>
                                        </td>
                                        <td className="p-3 text-center text-gray-300">{team.played}</td>
                                        <td className="p-3 text-center text-green-400 font-bold">{team.home_w}</td>
                                        <td className="p-3 text-center text-gray-400">{team.home_d}</td>
                                        <td className="p-3 text-center text-red-400">{team.home_l}</td>
                                        <td className="p-3 text-center text-gray-300">{team.home_gf}</td>
                                        <td className="p-3 text-center text-gray-400">{team.home_ga}</td>
                                        <td className="p-3 text-center text-green-400 font-bold">{team.away_w}</td>
                                        <td className="p-3 text-center text-gray-400">{team.away_d}</td>
                                        <td className="p-3 text-center text-red-400">{team.away_l}</td>
                                        <td className="p-3 text-center text-gray-300">{team.away_gf}</td>
                                        <td className="p-3 text-center text-gray-400">{team.away_ga}</td>
                                        <td className={`p-3 text-center font-bold ${team.goal_difference > 0 ? 'text-green-400' : team.goal_difference < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                            {team.goal_difference > 0 ? `+${team.goal_difference}` : team.goal_difference}
                                        </td>
                                        <td className="p-3 text-center font-black text-lg text-white group-hover:text-fpl-green transition-colors">{team.points}</td>
                                        <td className="p-3 text-center">{renderForm(team.recent_points)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-800 text-xs uppercase text-gray-400 font-bold border-b border-slate-700">
                                    <th className="p-4 text-center w-16">Pos</th>
                                    <th className="p-4">Club</th>
                                    <th className="p-4 text-center w-20">Pl</th>
                                    <th className="p-4 text-center w-20 hidden md:table-cell">W</th>
                                    <th className="p-4 text-center w-20 hidden md:table-cell">D</th>
                                    <th className="p-4 text-center w-20 hidden md:table-cell">L</th>
                                    <th className="p-4 text-center w-20 hidden lg:table-cell">GD</th>
                                    <th className="p-4 text-center w-20">Pts</th>
                                    <th className="p-4 text-center w-24">Form</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {standings.map((team) => (
                                    <tr key={team.id} className="hover:bg-slate-800/50 transition-colors group">
                                        <td className="p-4 text-center font-bold">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold ${positionBadge(team.position)}`}>{team.position}</div>
                                        </td>
                                        <td className="p-4">
                                            <button onClick={() => navigate(`/teams?id=${team.id}`)} className="font-bold text-white text-lg hover:text-fpl-green hover:underline text-left">{team.name}</button>
                                        </td>
                                        <td className="p-4 text-center font-medium text-gray-300">{team.played}</td>
                                        <td className="p-4 text-center hidden md:table-cell text-gray-400">{team.win}</td>
                                        <td className="p-4 text-center hidden md:table-cell text-gray-400">{team.draw}</td>
                                        <td className="p-4 text-center hidden md:table-cell text-gray-400">{team.loss}</td>
                                        <td className="p-4 text-center hidden lg:table-cell font-mono text-gray-400">{team.goal_difference > 0 ? `+${team.goal_difference}` : team.goal_difference}</td>
                                        <td className="p-4 text-center font-black text-xl text-white group-hover:text-fpl-green transition-colors">{team.points}</td>
                                        <td className="p-4 text-center">{renderForm(team.recent_points)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <div className="flex gap-4 text-xs text-gray-500 justify-center">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Champion</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> Champions League</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Europa League</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600" /> Relegation</span>
            </div>
        </div>
    );
};

export default StandingsView;
