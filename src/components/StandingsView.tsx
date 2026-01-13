import React, { useEffect, useState } from 'react';
import { Trophy, Loader2 } from 'lucide-react';
import type { FPLResponse, Team, Fixture } from '../types/fpl';
import { fetchFixtures } from '../services/api';

interface StandingsViewProps {
    data: FPLResponse;
    onTeamClick: (teamId: number) => void;
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
    recent_points: number[]; // Track points from recent matches
}

const StandingsView: React.FC<StandingsViewProps> = ({ data, onTeamClick }) => {
    const [standings, setStandings] = useState<TeamStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const calculateStandings = async () => {
            try {
                const fixtures = await fetchFixtures();

                // Initialize stats map
                const statsMap = new Map<number, TeamStats>();
                data.teams.forEach(team => {
                    statsMap.set(team.id, {
                        ...team,
                        played: 0,
                        win: 0,
                        draw: 0,
                        loss: 0,
                        points: 0,
                        goals_for: 0,
                        goals_against: 0,
                        goal_difference: 0,
                        recent_points: []
                    });
                });

                // Sort fixtures by date to ensure recent points are in order
                const sortedFixtures = [...fixtures].sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());

                // Process finished fixtures
                sortedFixtures.forEach((fix: Fixture) => {
                    if (!fix.finished) return;

                    const homeStats = statsMap.get(fix.team_h);
                    const awayStats = statsMap.get(fix.team_a);

                    if (homeStats && awayStats) {
                        // Update Played
                        homeStats.played += 1;
                        awayStats.played += 1;

                        // Update Goals
                        const hScore = fix.team_h_score ?? 0;
                        const aScore = fix.team_a_score ?? 0;

                        homeStats.goals_for += hScore;
                        homeStats.goals_against += aScore;
                        homeStats.goal_difference = homeStats.goals_for - homeStats.goals_against;

                        awayStats.goals_for += aScore;
                        awayStats.goals_against += hScore;
                        awayStats.goal_difference = awayStats.goals_for - awayStats.goals_against;

                        // Update W/D/L/Pts
                        if (hScore > aScore) {
                            homeStats.win += 1;
                            homeStats.points += 3;
                            awayStats.loss += 1;

                            homeStats.recent_points.push(3);
                            awayStats.recent_points.push(0);
                        } else if (aScore > hScore) {
                            awayStats.win += 1;
                            awayStats.points += 3;
                            homeStats.loss += 1;

                            awayStats.recent_points.push(3);
                            homeStats.recent_points.push(0);
                        } else {
                            homeStats.draw += 1;
                            homeStats.points += 1;
                            awayStats.draw += 1;
                            awayStats.points += 1;

                            homeStats.recent_points.push(1);
                            awayStats.recent_points.push(1);
                        }
                    }
                });

                // Convert to array and sort
                const sorted = Array.from(statsMap.values()).sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
                    return b.goals_for - a.goals_for;
                });

                // Assign positions
                sorted.forEach((team, index) => {
                    team.position = index + 1;
                });

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
        // Take last 5 matches
        const last5 = points.slice(-5);

        return (
            <div className="flex gap-1 justify-center">
                {last5.map((p, i) => (
                    <div
                        key={i}
                        className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-slate-900 ${p === 3 ? 'bg-fpl-green' :
                            p === 1 ? 'bg-gray-400' :
                                'bg-red-500 text-white'
                            }`}
                        title={p === 3 ? 'Win' : p === 1 ? 'Draw' : 'Loss'}
                    >
                        {p === 3 ? 'W' : p === 1 ? 'D' : 'L'}
                    </div>
                ))}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 text-fpl-green animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-yellow-500/20 rounded-lg">
                    <Trophy className="w-8 h-8 text-yellow-500" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-white">Premier League Table</h2>
                    <p className="text-gray-400">Live Standings 2024/25</p>
                </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
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
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm ${team.position === 1 ? 'bg-yellow-500 text-black' :
                                                team.position <= 4 ? 'bg-slate-400 text-slate-900' :
                                                    team.position === 5 ? 'bg-orange-500 text-white' :
                                                        team.position >= 18 ? 'bg-red-600 text-white' : 'text-gray-400'
                                            }`}>
                                            {team.position}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => onTeamClick(team.id)}
                                                className="font-bold text-white text-lg hover:text-fpl-green hover:underline text-left"
                                            >
                                                {team.name}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center font-medium text-gray-300">{team.played}</td>
                                    <td className="p-4 text-center hidden md:table-cell text-gray-400">{team.win}</td>
                                    <td className="p-4 text-center hidden md:table-cell text-gray-400">{team.draw}</td>
                                    <td className="p-4 text-center hidden md:table-cell text-gray-400">{team.loss}</td>
                                    <td className="p-4 text-center hidden lg:table-cell font-mono text-gray-400">
                                        {team.goal_difference > 0 ? `+${team.goal_difference}` : team.goal_difference}
                                    </td>
                                    <td className="p-4 text-center font-black text-xl text-white group-hover:text-fpl-green transition-colors">{team.points}</td>
                                    <td className="p-4 text-center">
                                        {renderForm(team.recent_points)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex gap-4 text-xs text-gray-500 justify-center">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Champion</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400"></span> Champions League</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Europa League</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600"></span> Relegation</span>
            </div>
        </div>
    );
};

export default StandingsView;
