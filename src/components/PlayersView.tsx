import { useState, useMemo } from 'react';
import type { FPLResponse, Player } from '../types/fpl';
import Filters from './Filters';
import PlayerCard from './PlayerCard';
import PlayerDetailsModal from './PlayerDetailsModal';

interface PlayersViewProps {
    data: FPLResponse;
}

const PlayersView: React.FC<PlayersViewProps> = ({ data }) => {
    const [search, setSearch] = useState('');
    const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
    const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

    const filteredPlayers = useMemo(() => {
        return data.elements.filter(player => {
            const matchesSearch =
                player.web_name.toLowerCase().includes(search.toLowerCase()) ||
                player.first_name.toLowerCase().includes(search.toLowerCase()) ||
                player.second_name.toLowerCase().includes(search.toLowerCase());

            const matchesTeam = selectedTeam ? player.team === selectedTeam : true;
            const matchesPosition = selectedPosition ? player.element_type === selectedPosition : true;

            return matchesSearch && matchesTeam && matchesPosition;
        }).sort((a, b) => b.total_points - a.total_points);
    }, [data, search, selectedTeam, selectedPosition]);

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

                {/* Main Content Grid */}
                <div className="lg:col-span-3">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                            {filteredPlayers.slice(0, 50).map(player => (
                                <PlayerCard
                                    key={player.id}
                                    player={player}
                                    team={data.teams.find(t => t.id === player.team)!}
                                    position={data.element_types.find(p => p.id === player.element_type)!}
                                    onClick={() => setSelectedPlayer(player)}
                                />
                            ))}
                        </div>
                    )}

                    {filteredPlayers.length > 50 && (
                        <div className="mt-8 text-center text-gray-500 p-4">
                            Showing top 50 matches. Refine filters to see more.
                        </div>
                    )}
                </div>
            </div>

            {/* Player Details Modal */}
            {selectedPlayer && (
                <PlayerDetailsModal
                    player={selectedPlayer}
                    team={data.teams.find(t => t.id === selectedPlayer.team)!}
                    position={data.element_types.find(p => p.id === selectedPlayer.element_type)!}
                    teams={data.teams}
                    onClose={() => setSelectedPlayer(null)}
                />
            )}
        </div>
    );
};

export default PlayersView;
