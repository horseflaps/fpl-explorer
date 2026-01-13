import React, { useState } from 'react';
import type { FPLResponse } from '../types/fpl';
import { Trophy, Shield, Swords, TrendingUp } from 'lucide-react';

interface TeamsViewProps {
    data: FPLResponse;
}

const TeamsView: React.FC<TeamsViewProps> = ({ data }) => {
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

    const activeTeam = selectedTeamId ? data.teams.find(t => t.id === selectedTeamId) : null;

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Selector */}
            <div className="glass p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Team Statistics</h2>
                    <p className="text-gray-400 text-sm">Select a club to analyze their performance metrics</p>
                </div>
                <div className="w-full md:w-72">
                    <select
                        value={selectedTeamId || ''}
                        onChange={(e) => setSelectedTeamId(Number(e.target.value))}
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
                        <h3 className="text-4xl font-black text-white mb-2">{activeTeam.name}</h3>
                        <p className="text-gray-400 font-mono text-sm">Short Code: {activeTeam.short_name}</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {/* Overall Strength */}
                        <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
                            <Trophy className="text-yellow-400 mb-4" size={32} />
                            <div className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">Overall Strength</div>
                            <div className="text-3xl font-black text-white">{activeTeam.strength}</div>
                            <div className="mt-4 w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-yellow-400 h-full rounded-full transition-all duration-1000" 
                                    style={{ width: `${(activeTeam.strength / 5) * 100}%` }} 
                                />
                            </div>
                        </div>

                        {/* Attack Strength */}
                        <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
                            <Swords className="text-fpl-green mb-4" size={32} />
                            <div className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">Attack Rating</div>
                            <div className="text-3xl font-black text-fpl-green">{(activeTeam.strength_attack_home + activeTeam.strength_attack_away) / 2}</div>
                            <div className="grid grid-cols-2 gap-4 mt-4 w-full text-xs">
                                <div>
                                    <span className="text-gray-500 block">Home</span>
                                    <span className="text-white font-bold">{activeTeam.strength_attack_home}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block">Away</span>
                                    <span className="text-white font-bold">{activeTeam.strength_attack_away}</span>
                                </div>
                            </div>
                        </div>

                        {/* Defence Strength */}
                        <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
                            <Shield className="text-fpl-blue mb-4" size={32} />
                            <div className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">Defence Rating</div>
                            <div className="text-3xl font-black text-fpl-blue">{(activeTeam.strength_defence_home + activeTeam.strength_defence_away) / 2}</div>
                             <div className="grid grid-cols-2 gap-4 mt-4 w-full text-xs">
                                <div>
                                    <span className="text-gray-500 block">Home</span>
                                    <span className="text-white font-bold">{activeTeam.strength_defence_home}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block">Away</span>
                                    <span className="text-white font-bold">{activeTeam.strength_defence_away}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <TrendingUp size={64} className="text-gray-600 mb-4" />
                    <p className="text-xl text-gray-400 font-medium">Select a team above to view stats</p>
                </div>
            )}
        </div>
    );
};

export default TeamsView;
