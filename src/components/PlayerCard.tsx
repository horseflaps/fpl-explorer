import React from 'react';
import type { Player, Team, ElementType } from '../types/fpl';
import { getPlayerImageUrl, fallbackPlayerImage } from '../services/api';
import { AlertCircle } from 'lucide-react';

interface PlayerCardProps {
    player: Player;
    team: Team;
    position: ElementType;
    onClick: () => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, team, position, onClick }) => {
    const statusColor = (status: string) => {
        switch (status) {
            case 'a': return 'bg-fpl-green'; // Available
            case 'd': return 'bg-yellow-500'; // Doubtful
            case 'i': return 'bg-red-500'; // Injured
            case 'u': return 'bg-gray-500'; // Unavailable
            default: return 'bg-gray-500';
        }
    };

    return (
        <div
            onClick={onClick}
            className="glass-card group flex flex-col relative h-full cursor-pointer hover:border-fpl-blue/50 transform transition-all duration-300 hover:-translate-y-1"
        >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fpl-pink to-fpl-blue opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Header / Image Area */}
            <div className="relative pt-4 px-4 flex justify-center bg-gradient-to-b from-slate-800/50 to-transparent">
                <div className="absolute top-3 right-3 flex flex-col items-end">
                    <span className="text-2xl font-bold text-white">{player.now_cost / 10}m</span>
                    <span className="text-xs text-gray-400">Price</span>
                </div>
                <div className="absolute top-3 left-3 z-20">
                    <div className={`w-3 h-3 rounded-full ${statusColor(player.status)} ring-2 ring-slate-900`} title={`Status: ${player.status}`} />
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

                <div className="grid grid-cols-2 gap-2 mt-auto">
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center group-hover:bg-slate-800/80 transition-colors">
                        <div className="text-xs text-gray-400 mb-0.5">Points</div>
                        <div className="text-xl font-bold text-fpl-green">{player.total_points}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center group-hover:bg-slate-800/80 transition-colors">
                        <div className="text-xs text-gray-400 mb-0.5">Form</div>
                        <div className="text-xl font-bold text-white">{player.form}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center group-hover:bg-slate-800/80 transition-colors">
                        <div className="text-xs text-gray-400 mb-0.5">Selected</div>
                        <div className="text-sm font-bold text-white">{player.selected_by_percent}%</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center group-hover:bg-slate-800/80 transition-colors">
                        <div className="text-xs text-gray-400 mb-0.5">ICT</div>
                        <div className="text-sm font-bold text-white">{player.ict_index}</div>
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
