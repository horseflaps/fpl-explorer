import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import type { LeagueStandingsResponse } from '../types/fpl';
import { fetchLeagueStandings, searchTeamsByName } from '../services/api';

const HomeView: React.FC = () => {
    const navigate = useNavigate();
    const [searchMode, setSearchMode] = useState<'name' | 'team' | 'league'>('name');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [teamId, setTeamId] = useState('');
    const [leagueId, setLeagueId] = useState('');
    const [leagueData, setLeagueData] = useState<LeagueStandingsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleNameSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.length < 2) return;

        setLoading(true);
        setError(null);
        try {
            const results = await searchTeamsByName(searchTerm);
            setSearchResults(results);
            if (results.length === 0) setError('No teams found matching that name.');
        } catch (err) {
            setError('Search failed. Try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleTeamSearch = (e: React.FormEvent) => {
        /* same logic */
        e.preventDefault();
        if (teamId) {
            navigate(`/my-team?entry=${teamId}`);
        }
    };

    const handleLeagueSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!leagueId) return;

        setLoading(true);
        setError(null);
        setLeagueData(null);

        try {
            const data = await fetchLeagueStandings(Number(leagueId));
            setLeagueData(data);
        } catch (err) {
            setError('League not found. Check the ID.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-500 py-12">
            <div className="space-y-6">
                <h2 className="text-4xl font-black text-white tracking-tight">Manager Hub</h2>
                <p className="text-gray-400 max-w-lg mx-auto">
                    Enter your Team ID directly, or find yourself by searching your Mini-League.
                </p>

                {/* Toggle */}
                <div className="flex justify-center mb-8">
                    <div className="bg-slate-900 p-1 rounded-xl border border-slate-700 flex gap-1">
                        <button
                            onClick={() => setSearchMode('name')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${searchMode === 'name'
                                ? 'bg-fpl-green text-slate-900 shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            Search Name
                        </button>
                        <button
                            onClick={() => setSearchMode('league')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${searchMode === 'league'
                                ? 'bg-fpl-green text-slate-900 shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            By League
                        </button>
                        <button
                            onClick={() => setSearchMode('team')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${searchMode === 'team'
                                ? 'bg-fpl-green text-slate-900 shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            By ID
                        </button>
                    </div>
                </div>

                <div className="max-w-md mx-auto min-h-[160px]">
                    {searchMode === 'name' ? (
                        <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-4">
                            <form onSubmit={handleNameSearch}>
                                <label className="block text-sm font-bold text-gray-300 mb-2 text-left">
                                    Search Team or Manager Name
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search className="h-5 w-5 text-gray-500" />
                                        </div>
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="e.g. The Wolf"
                                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-fpl-green focus:ring-1 focus:ring-fpl-green transition-all"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={searchTerm.length < 2 || loading}
                                        className="bg-fpl-green text-slate-900 font-bold px-6 py-3 rounded-xl hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-fpl-green/10"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : 'Find'}
                                    </button>
                                </div>
                            </form>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            {searchResults.length > 0 && (
                                <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700 overflow-hidden text-left animate-in slide-in-from-bottom-2">
                                    <div className="p-3 border-b border-slate-700 bg-slate-950/50">
                                        <p className="text-xs text-gray-400 uppercase font-black tracking-widest">Matching Managers</p>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/50">
                                        {searchResults.map((result) => (
                                            <button
                                                key={result.team_id}
                                                onClick={() => navigate(`/my-team?entry=${result.team_id}`)}
                                                className="w-full p-3 flex items-center justify-between hover:bg-slate-800 transition-colors group text-left"
                                            >
                                                <div>
                                                    <div className="font-bold text-sm text-white group-hover:text-fpl-green transition-colors">
                                                        {result.team_name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {result.manager_name} • Rank: {result.rank.toLocaleString()}
                                                    </div>
                                                </div>
                                                <ChevronRight size={16} className="text-gray-600 group-hover:text-fpl-green" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : searchMode === 'team' ? (
                        <form onSubmit={handleTeamSearch} className="animate-in fade-in slide-in-from-left-4 duration-300">
                            {/* same as before */}
                            <label className="block text-sm font-bold text-gray-300 mb-2 text-left">
                                Enter your Team ID <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="h-5 w-5 text-gray-500" />
                                    </div>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={teamId}
                                        onChange={(e) => setTeamId(e.target.value.replace(/\D/g, ''))}
                                        placeholder="e.g. 123456"
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-fpl-green focus:ring-1 focus:ring-fpl-green transition-all"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={!teamId}
                                    className="bg-fpl-green text-slate-900 font-bold px-6 py-3 rounded-xl hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-fpl-green/10"
                                >
                                    Go
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                            <form onSubmit={handleLeagueSearch}>
                                <label className="block text-sm font-bold text-gray-300 mb-2 text-left">
                                    Enter League ID
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Users className="h-5 w-5 text-gray-500" />
                                        </div>
                                        <input
                                            type="number"
                                            value={leagueId}
                                            onChange={(e) => setLeagueId(e.target.value)}
                                            placeholder="e.g. 314"
                                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-fpl-green focus:ring-1 focus:ring-fpl-green transition-all"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!leagueId || loading}
                                        className="bg-fpl-blue text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-fpl-blue/20"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : 'Find'}
                                    </button>
                                </div>
                            </form>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            {leagueData && (
                                <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700 overflow-hidden text-left animate-in slide-in-from-bottom-2">
                                    <div className="p-3 border-b border-slate-700 bg-slate-950/50">
                                        <h3 className="font-bold text-white truncate">{leagueData.league.name}</h3>
                                        <p className="text-xs text-gray-400">Select yourself from the list:</p>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/50">
                                        {leagueData.standings.results.map((entry) => (
                                            <button
                                                key={entry.id}
                                                onClick={() => navigate(`/my-team?entry=${entry.entry}`)}
                                                className="w-full p-3 flex items-center justify-between hover:bg-slate-800 transition-colors group text-left"
                                            >
                                                <div>
                                                    <div className="font-bold text-sm text-white group-hover:text-fpl-green transition-colors">
                                                        {entry.entry_name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {entry.player_name}
                                                    </div>
                                                </div>
                                                <ChevronRight size={16} className="text-gray-600 group-hover:text-fpl-green" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HomeView;
