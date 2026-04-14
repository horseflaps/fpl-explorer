import React from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import type { Team, ElementType } from '../types/fpl';

interface FiltersProps {
    search: string;
    setSearch: (value: string) => void;
    selectedTeam: number | null;
    setSelectedTeam: (value: number | null) => void;
    selectedPosition: number | null;
    setSelectedPosition: (value: number | null) => void;
    teams: Team[];
    positions: ElementType[];
    resultCount: number;
}

const Filters: React.FC<FiltersProps> = ({
    search,
    setSearch,
    selectedTeam,
    setSelectedTeam,
    selectedPosition,
    setSelectedPosition,
    teams,
    positions,
    resultCount
}) => {
    return (
        <div className="glass p-6 rounded-2xl space-y-6 sticky top-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Filter className="text-fpl-green" size={24} />
                    Filters
                </h2>
                <span className="text-xs font-mono text-gray-400 bg-black/30 px-2 py-1 rounded-full">
                    {resultCount} found
                </span>
            </div>

            <div className="space-y-4">
                {/* Search Input */}
                <div className="relative group">
                    <Search className="absolute left-3 top-3 text-gray-400 group-focus-within:text-fpl-blue transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search players..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-900/60 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-fpl-blue focus:ring-1 focus:ring-fpl-blue transition-all"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-3 top-3 text-gray-400 hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Position Filter */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Position</label>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedPosition(null)}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${selectedPosition === null
                                ? 'bg-fpl-green text-fpl-purple font-bold'
                                : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                                }`}
                        >
                            All
                        </button>
                        {positions.map((pos) => (
                            <button
                                key={pos.id}
                                onClick={() => setSelectedPosition(pos.id)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${selectedPosition === pos.id
                                    ? 'bg-fpl-green text-fpl-purple font-bold'
                                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                                    }`}
                            >
                                {pos.singular_name_short}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Team Filter */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Team</label>
                    <div className="relative">
                        <select
                            value={selectedTeam || ''}
                            onChange={(e) => setSelectedTeam(e.target.value ? Number(e.target.value) : null)}
                            className="w-full bg-slate-900/60 border border-slate-700 rounded-xl p-2.5 pr-9 focus:outline-none focus:border-fpl-pink focus:ring-1 focus:ring-fpl-pink transition-all appearance-none cursor-pointer"
                        >
                            <option value="">All Teams</option>
                            {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                    {team.name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Filters;
