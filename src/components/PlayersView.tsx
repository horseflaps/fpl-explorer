import { useState, useMemo } from 'react';
import type { FPLResponse, Player } from '../types/fpl';
import Filters from './Filters';
import PlayerCard from './PlayerCard';
import PlayerDetailsModal from './PlayerDetailsModal';
import CompareModal from './CompareModal';
import { ArrowUpDown, GitCompare } from 'lucide-react';

interface PlayersViewProps {
    data: FPLResponse;
}

type SortKey =
    | 'total_points'
    | 'now_cost'
    | 'form'
    | 'points_per_game'
    | 'selected_by_percent'
    | 'ict_index'
    | 'expected_goals'
    | 'expected_assists'
    | 'expected_goal_involvements'
    | 'transfers_in_event'
    | 'ep_next'
    | 'value_season';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'total_points', label: 'Total Points' },
    { value: 'points_per_game', label: 'Points / Game' },
    { value: 'form', label: 'Form' },
    { value: 'now_cost', label: 'Price' },
    { value: 'selected_by_percent', label: 'Ownership %' },
    { value: 'ict_index', label: 'ICT Index' },
    { value: 'expected_goals', label: 'xG' },
    { value: 'expected_assists', label: 'xA' },
    { value: 'expected_goal_involvements', label: 'xGI' },
    { value: 'transfers_in_event', label: 'GW Transfers In' },
    { value: 'ep_next', label: 'EP Next GW' },
    { value: 'value_season', label: 'Value (season)' },
];

const PlayersView: React.FC<PlayersViewProps> = ({ data }) => {
    const [search, setSearch] = useState('');
    const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
    const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('total_points');
    const [compareMode, setCompareMode] = useState(false);
    const [comparePlayers, setComparePlayers] = useState<Player[]>([]);
    const [showCompareModal, setShowCompareModal] = useState(false);

    const filteredPlayers = useMemo(() => {
        return data.elements
            .filter(player => {
                const matchesSearch =
                    player.web_name.toLowerCase().includes(search.toLowerCase()) ||
                    player.first_name.toLowerCase().includes(search.toLowerCase()) ||
                    player.second_name.toLowerCase().includes(search.toLowerCase());
                const matchesTeam = selectedTeam ? player.team === selectedTeam : true;
                const matchesPosition = selectedPosition ? player.element_type === selectedPosition : true;
                return matchesSearch && matchesTeam && matchesPosition;
            })
            .sort((a, b) => parseFloat(String(b[sortKey])) - parseFloat(String(a[sortKey])));
    }, [data, search, selectedTeam, selectedPosition, sortKey]);

    const handleCardClick = (player: Player) => {
        if (compareMode) {
            if (comparePlayers.find(p => p.id === player.id)) {
                setComparePlayers(prev => prev.filter(p => p.id !== player.id));
            } else if (comparePlayers.length < 4) {
                setComparePlayers(prev => [...prev, player]);
            }
        } else {
            setSelectedPlayer(player);
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Filters */}
                <div className="lg:col-span-1">
                    <Filters
                        search={search}
                        setSearch={setSearch}
                        selectedTeam={selectedTeam}
                        setSelectedTeam={setSelectedTeam}
                        selectedPosition={selectedPosition}
                        setSelectedPosition={setSelectedPosition}
                        teams={data.teams}
                        positions={data.element_types}
                        resultCount={filteredPlayers.length}
                    />
                </div>

                {/* Main Content */}
                <div className="lg:col-span-3">
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-3 mb-5">
                        <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
                            <ArrowUpDown size={14} className="text-gray-400 shrink-0" />
                            <select
                                value={sortKey}
                                onChange={e => setSortKey(e.target.value as SortKey)}
                                className="bg-transparent text-white text-sm flex-1 outline-none cursor-pointer"
                            >
                                {SORT_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => {
                                setCompareMode(m => !m);
                                setComparePlayers([]);
                                setShowCompareModal(false);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${compareMode ? 'bg-fpl-green text-slate-900 border-fpl-green' : 'bg-slate-800/60 text-gray-300 border-slate-700 hover:border-fpl-green/50'}`}
                        >
                            <GitCompare size={15} />
                            {compareMode ? `Selecting (${comparePlayers.length}/4)` : 'Compare Players'}
                        </button>

                        {compareMode && comparePlayers.length >= 2 && (
                            <button
                                onClick={() => setShowCompareModal(true)}
                                className="px-4 py-2 rounded-xl text-sm font-bold bg-fpl-green text-slate-900 hover:brightness-110 transition-all"
                            >
                                View Comparison →
                            </button>
                        )}
                    </div>

                    {compareMode && (
                        <div className="mb-4 bg-fpl-green/10 border border-fpl-green/30 rounded-xl px-4 py-3 text-sm text-fpl-green">
                            Click up to 4 players to compare, then hit <strong>View Comparison</strong>.{comparePlayers.length > 0 && ` Selected: ${comparePlayers.map(p => p.web_name).join(', ')}`}
                        </div>
                    )}

                    {filteredPlayers.length === 0 ? (
                        <div className="glass p-12 rounded-2xl text-center">
                            <p className="text-xl text-gray-400">No players found matching your criteria.</p>
                            <button
                                onClick={() => { setSearch(''); setSelectedTeam(null); setSelectedPosition(null); }}
                                className="mt-4 text-fpl-green hover:underline"
                            >
                                Clear all filters
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredPlayers.map(player => {
                                const isSelected = comparePlayers.find(p => p.id === player.id);
                                return (
                                    <div key={player.id} className={`relative ${compareMode && isSelected ? 'ring-2 ring-fpl-green rounded-2xl' : ''}`}>
                                        <PlayerCard
                                            player={player}
                                            team={data.teams.find(t => t.id === player.team)!}
                                            position={data.element_types.find(p => p.id === player.element_type)!}
                                            onClick={() => handleCardClick(player)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Player Details Modal */}
            {selectedPlayer && !compareMode && (
                <PlayerDetailsModal
                    player={selectedPlayer}
                    team={data.teams.find(t => t.id === selectedPlayer.team)!}
                    position={data.element_types.find(p => p.id === selectedPlayer.element_type)!}
                    teams={data.teams}
                    onClose={() => setSelectedPlayer(null)}
                />
            )}

            {/* Compare Modal */}
            {showCompareModal && comparePlayers.length >= 2 && (
                <CompareModal
                    players={comparePlayers}
                    teams={data.teams}
                    positions={data.element_types}
                    onClose={() => { setShowCompareModal(false); setCompareMode(false); setComparePlayers([]); }}
                    onRemove={(id) => {
                        const remaining = comparePlayers.filter(p => p.id !== id);
                        setComparePlayers(remaining);
                        if (remaining.length < 2) setShowCompareModal(false);
                    }}
                />
            )}
        </div>
    );
};

export default PlayersView;
