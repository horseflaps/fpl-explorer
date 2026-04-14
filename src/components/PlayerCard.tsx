import React from 'react';
import type { Player, Team, ElementType } from '../types/fpl';
import { getPlayerImageUrl, fallbackPlayerImage } from '../services/api';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface PlayerCardProps {
    player: Player;
    team: Team;
    position: ElementType;
    onClick: () => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, team, position, onClick }) => {
    const statusColor = (status: string) => {
        switch (status) {
            case 'a': return 'bg-fpl-green';
            case 'd': return 'bg-yellow-500';
            case 'i': return 'bg-red-500';
            case 'u': return 'bg-gray-500';
            default: return 'bg-gray-500';
        }
    };

    const priceChange = player.cost_change_event / 10;
    const priceChangeSeason = player.cost_change_start / 10;

    return (
        <div
            onClick={onClick}
            className="glass-card group flex flex-col relative h-full cursor-pointer hover:border-fpl-blue/50 transform transition-all duration-300 hover:-translate-y-1"
        >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fpl-pink to-fpl-blue opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Header / Image Area */}
            <div className="relative pt-4 px-4 flex justify-center bg-gradient-to-b from-slate-800/50 to-transparent">
                <div className="absolute top-3 right-3 flex flex-col items-end gap-0.5">
                    <span className="text-2xl font-bold text-white">£{player.now_cost / 10}m</span>
                    {priceChange !== 0 ? (
                        <span className={`text-xs font-bold flex items-center gap-0.5 ${priceChange > 0 ? 'text-fpl-green' : 'text-red-400'}`}>
                            {priceChange > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}
                        </span>
                    ) : priceChangeSeason !== 0 ? (
                        <span className={`text-xs font-bold flex items-center gap-0.5 ${priceChangeSeason > 0 ? 'text-fpl-green' : 'text-red-400'}`}>
                            {priceChangeSeason > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {priceChangeSeason > 0 ? '+' : ''}{priceChangeSeason.toFixed(1)} season
                        </span>
                    ) : null}
                </div>
                <div className="absolute top-3 left-3 z-20 flex flex-col gap-1">
                    <div className={`w-3 h-3 rounded-full ${statusColor(player.status)} ring-2 ring-slate-900`} title={`Status: ${player.status}`} />
                    {player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round !== undefined && player.chance_of_playing_next_round < 100 && (
                        <span className="text-[9px] font-black text-yellow-400 leading-none">{player.chance_of_playing_next_round}%</span>
                    )}
                </div>

                <div className="w-28 h-36 overflow-hidden relative z-10">
                    <img
                        src={getPlayerImageUrl(player.code)}
                        alt={player.web_name}
                        className="w-full h-full object-cover object-top transform group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = fallbackPlayerImage;
                        }}
                    />
                </div>
            </div>

            {/* Info Body */}
            <div className="p-4 flex-1 flex flex-col">
                <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-white leading-tight">{player.web_name}</h3>
                    <p className="text-xs text-fpl-blue uppercase tracking-wider font-semibold mt-1">
                        {team?.short_name} • {position?.singular_name_short}
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-auto">
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center group-hover:bg-slate-800/80 transition-colors">
                        <div className="text-xs text-gray-400 mb-0.5">Pts</div>
                        <div className="text-lg font-bold text-fpl-green">{player.total_points}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center group-hover:bg-slate-800/80 transition-colors">
                        <div className="text-xs text-gray-400 mb-0.5">PPG</div>
                        <div className="text-lg font-bold text-white">{player.points_per_game}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center group-hover:bg-slate-800/80 transition-colors">
                        <div className="text-xs text-gray-400 mb-0.5">Form</div>
                        <div className="text-lg font-bold text-white">{player.form}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center group-hover:bg-slate-800/80 transition-colors">
                        <div className="text-xs text-gray-400 mb-0.5">Own%</div>
                        <div className="text-sm font-bold text-white">{player.selected_by_percent}%</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center group-hover:bg-slate-800/80 transition-colors">
                        <div className="text-xs text-gray-400 mb-0.5">ICT</div>
                        <div className="text-sm font-bold text-white">{player.ict_index}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center group-hover:bg-slate-800/80 transition-colors">
                        <div className="text-xs text-gray-400 mb-0.5">xGI</div>
                        <div className="text-sm font-bold text-white">{parseFloat(player.expected_goal_involvements).toFixed(1)}</div>
                    </div>
                </div>

                {player.news && (
                    <div className="mt-3 text-xs text-red-300 bg-red-900/20 p-2 rounded border border-red-900/50 flex items-start gap-1">
                        <AlertCircle size={12} className="mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{player.news}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerCard;
