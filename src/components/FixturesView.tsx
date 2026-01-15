import React, { useState, useEffect } from 'react';
import { Calendar, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import type { FPLResponse, Fixture } from '../types/fpl';
import { fetchFixtures } from '../services/api';

interface FixturesViewProps {
    data: FPLResponse;
}

const FixturesView: React.FC<FixturesViewProps> = ({ data }) => {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedGameweek, setSelectedGameweek] = useState<number>(1);
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

    useEffect(() => {
        const loadFixtures = async () => {
            try {
                const fixturesData = await fetchFixtures();
                setFixtures(fixturesData);

                // Set default gameweek to current or next
                const currentEvent = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
                if (currentEvent) {
                    setSelectedGameweek(currentEvent.id);
                }
            } catch (error) {
                console.error("Error loading fixtures", error);
            } finally {
                setLoading(false);
            }
        };
        loadFixtures();
    }, [data.events]);

    const getTeam = (id: number) => data.teams.find(t => t.id === id);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 text-fpl-green animate-spin" />
            </div>
        );
    }

    const currentGameweekId = data.events.find(e => e.is_current)?.id || data.events.find(e => e.is_next)?.id || 1;

    // Filter Logic
    const filteredFixtures = selectedTeamId
        ? fixtures.filter(f => !f.finished && (f.team_h === selectedTeamId || f.team_a === selectedTeamId))
        : fixtures.filter(f => f.event === selectedGameweek);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row items-center justify-between bg-slate-800/50 p-4 rounded-xl backdrop-blur-sm border border-slate-700 gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="p-3 bg-fpl-blue/20 rounded-lg">
                        <Calendar className="w-6 h-6 text-fpl-blue" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Fixtures</h2>
                        <p className="text-gray-400 text-sm">
                            {selectedTeamId
                                ? `All Upcoming Matches`
                                : `Gameweek ${selectedGameweek}`
                            }
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    {/* Team Filter */}
                    <div className="w-full sm:w-64">
                        <select
                            value={selectedTeamId || ''}
                            onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fpl-blue cursor-pointer"
                        >
                            <option value="">Filter by Team (All)</option>
                            {data.teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                    {team.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Gameweek Controls (Hidden when team filter is active) */}
                    {!selectedTeamId && (
                        <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1 w-full sm:w-auto justify-center">
                            <button
                                onClick={() => setSelectedGameweek(currentGameweekId)}
                                className={`px-3 py-2 text-xs font-bold hover:bg-slate-700 rounded-md transition-colors mr-1 ${selectedGameweek === currentGameweekId ? 'text-fpl-green' : 'text-gray-400'}`}
                            >
                                Current
                            </button>
                            <div className="w-px h-6 bg-slate-800 mx-1"></div>
                            <button
                                onClick={() => setSelectedGameweek(prev => Math.max(1, prev - 1))}
                                className="p-2 hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50"
                                disabled={selectedGameweek <= 1}
                            >
                                <ChevronLeft size={20} className="text-gray-400" />
                            </button>
                            <span className="w-24 text-center font-bold text-white">GW {selectedGameweek}</span>
                            <button
                                onClick={() => setSelectedGameweek(prev => Math.max(1, prev + 1))}
                                className="p-2 hover:bg-slate-700 rounded-md transition-colors"
                            >
                                <ChevronRight size={20} className="text-gray-400" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
                {filteredFixtures.map((fixture) => {
                    const homeTeam = getTeam(fixture.team_h);
                    const awayTeam = getTeam(fixture.team_a);
                    const date = new Date(fixture.kickoff_time);

                    return (
                        <div key={fixture.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-fpl-green/50 transition-colors group">
                            <div className="text-center text-xs text-gray-500 mb-3 flex justify-between uppercase tracking-wider font-semibold">
                                <span>{date.toLocaleDateString()}</span>
                                <span>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex flex-col items-center flex-1">
                                    <div className="w-12 h-12 mb-2 bg-white/5 rounded-full flex items-center justify-center p-2">
                                        <img
                                            src={`https://resources.premierleague.com/premierleague/badges/t${homeTeam?.code}.png`}
                                            alt={homeTeam?.name}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold text-white text-center">{homeTeam?.name}</span>
                                </div>

                                <div className="mx-4 flex flex-col items-center justify-center">
                                    {fixture.finished ? (
                                        <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-700 font-mono text-xl font-bold text-white">
                                            {fixture.team_h_score} - {fixture.team_a_score}
                                        </div>
                                    ) : (
                                        <div className="p-2 rounded-full bg-slate-900 border border-slate-700 text-xs text-gray-400">
                                            VS
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col items-center flex-1">
                                    <div className="w-12 h-12 mb-2 bg-white/5 rounded-full flex items-center justify-center p-2">
                                        <img
                                            src={`https://resources.premierleague.com/premierleague/badges/t${awayTeam?.code}.png`}
                                            alt={awayTeam?.name}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold text-white text-center">{awayTeam?.name}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredFixtures.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    No fixtures found for this Gameweek.
                </div>
            )}
        </div>
    );
};

export default FixturesView;
