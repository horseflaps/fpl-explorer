import React, { useState } from 'react';
import { Users, Shirt } from 'lucide-react';

interface HomeViewProps {
    onNavigate: (view: 'players' | 'teams') => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
    const [teamName, setTeamName] = useState('');

    return (
        <div className="max-w-4xl mx-auto text-center space-y-12 animate-in fade-in zoom-in duration-500 py-12">
            <div className="space-y-6">
                <h2 className="text-3xl font-bold text-white">Welcome Manager!</h2>
                <div className="max-w-md mx-auto">
                    <label className="block text-sm font-medium text-gray-400 mb-2 text-left">
                        Enter your Team Name
                    </label>
                    <input
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="e.g. Salah-vated Breathing"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-fpl-green focus:ring-1 focus:ring-fpl-green transition-all"
                    />
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                <button
                    onClick={() => onNavigate('players')}
                    className="group relative p-8 glass-card hover:bg-slate-800/80 text-left transition-all"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Users size={48} className="text-fpl-green" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">View Players</h3>
                    <p className="text-gray-400">
                        Detailed statistics, analysis, and history for all Premier League players.
                    </p>
                </button>

                <button
                    onClick={() => onNavigate('teams')}
                    className="group relative p-8 glass-card hover:bg-slate-800/80 text-left transition-all"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Shirt size={48} className="text-fpl-blue" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">View Teams</h3>
                    <p className="text-gray-400">
                        Compare team strengths, fixtures, and form across the league.
                    </p>
                </button>
            </div>
        </div>
    );
};

export default HomeView;
