import React from 'react';
import type { Player, Team, ElementType } from '../types/fpl';
import { getPlayerImageUrl, fallbackPlayerImage } from '../services/api';
import { X } from 'lucide-react';

interface CompareModalProps {
    players: Player[];
    teams: Team[];
    positions: ElementType[];
    onClose: () => void;
    onRemove: (id: number) => void;
}

interface StatRow {
    label: string;
    key: keyof Player;
    format?: (v: any) => string;
    higherIsBetter?: boolean;
    lowerIsBetter?: boolean;
    section?: string;
}

const STAT_ROWS: StatRow[] = [
    { label: 'Price', key: 'now_cost', format: v => `£${(v / 10).toFixed(1)}m`, section: 'FPL' },
    { label: 'Total Points', key: 'total_points', higherIsBetter: true },
    { label: 'Points / Game', key: 'points_per_game', higherIsBetter: true },
    { label: 'Form', key: 'form', higherIsBetter: true },
    { label: 'EP Next GW', key: 'ep_next', higherIsBetter: true },
    { label: 'EP This GW', key: 'ep_this', higherIsBetter: true },
    { label: 'Value (season)', key: 'value_season', higherIsBetter: true },
    { label: 'Bonus Points', key: 'bonus', higherIsBetter: true },
    { label: 'BPS', key: 'bps', higherIsBetter: true },
    { label: 'Ownership %', key: 'selected_by_percent', format: v => `${v}%`, section: 'Transfers' },
    { label: 'GW Transfers In', key: 'transfers_in_event', format: v => v.toLocaleString(), higherIsBetter: true },
    { label: 'GW Transfers Out', key: 'transfers_out_event', format: v => v.toLocaleString(), lowerIsBetter: true },
    { label: 'Season Transfers In', key: 'transfers_in', format: v => v.toLocaleString() },
    { label: 'Minutes', key: 'minutes', higherIsBetter: true, section: 'Attacking' },
    { label: 'Goals', key: 'goals_scored', higherIsBetter: true },
    { label: 'Assists', key: 'assists', higherIsBetter: true },
    { label: 'xG', key: 'expected_goals', format: v => parseFloat(v).toFixed(2), higherIsBetter: true },
    { label: 'xA', key: 'expected_assists', format: v => parseFloat(v).toFixed(2), higherIsBetter: true },
    { label: 'xGI', key: 'expected_goal_involvements', format: v => parseFloat(v).toFixed(2), higherIsBetter: true },
    { label: 'Penalties Missed', key: 'penalties_missed', lowerIsBetter: true },
    { label: 'Clean Sheets', key: 'clean_sheets', higherIsBetter: true, section: 'Defensive' },
    { label: 'Goals Conceded', key: 'goals_conceded', lowerIsBetter: true },
    { label: 'xG Conceded', key: 'expected_goals_conceded', format: v => parseFloat(v).toFixed(2), lowerIsBetter: true },
    { label: 'Saves', key: 'saves', higherIsBetter: true },
    { label: 'Penalties Saved', key: 'penalties_saved', higherIsBetter: true },
    { label: 'Own Goals', key: 'own_goals', lowerIsBetter: true },
    { label: 'ICT Index', key: 'ict_index', higherIsBetter: true, section: 'ICT' },
    { label: 'Influence', key: 'influence', higherIsBetter: true },
    { label: 'Creativity', key: 'creativity', higherIsBetter: true },
    { label: 'Threat', key: 'threat', higherIsBetter: true },
    { label: 'Yellow Cards', key: 'yellow_cards', lowerIsBetter: true, section: 'Discipline' },
    { label: 'Red Cards', key: 'red_cards', lowerIsBetter: true },
];

const CompareModal: React.FC<CompareModalProps> = ({ players, teams, positions, onClose, onRemove }) => {
    const getBestValue = (row: StatRow): number => {
        const values = players.map(p => parseFloat(String(p[row.key])));
        return row.lowerIsBetter ? Math.min(...values) : Math.max(...values);
    };

    const isWinner = (row: StatRow, player: Player): boolean => {
        if (!row.higherIsBetter && !row.lowerIsBetter) return false;
        const val = parseFloat(String(player[row.key]));
        const best = getBestValue(row);
        // Don't highlight if all players are equal
        const allEqual = players.every(p => parseFloat(String(p[row.key])) === best);
        return !allEqual && val === best;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-[92vh] overflow-hidden rounded-2xl relative z-10 flex flex-col animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
                    <h2 className="text-lg font-black text-white uppercase tracking-wider">Player Comparison</h2>
                    <button onClick={onClose} className="p-2 bg-black/50 hover:bg-red-500/80 rounded-full transition-colors">
                        <X size={20} className="text-white" />
                    </button>
                </div>

                {/* Scrollable table area */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm border-collapse min-w-[500px]">

                        {/* Sticky player header row */}
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-950 border-b-2 border-slate-700">
                                <th className="p-4 text-left text-gray-500 font-bold uppercase text-xs w-40 border-r border-slate-800">Stat</th>
                                {players.map(player => {
                                    const team = teams.find(t => t.id === player.team);
                                    const pos = positions.find(p => p.id === player.element_type);
                                    return (
                                        <th key={player.id} className="p-4 text-center border-r border-slate-800 last:border-r-0 min-w-[140px]">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="relative">
                                                    <img
                                                        src={getPlayerImageUrl(player.code)}
                                                        alt={player.web_name}
                                                        onError={(e) => { (e.target as HTMLImageElement).src = fallbackPlayerImage; }}
                                                        className="w-14 rounded-lg object-cover object-top"
                                                        style={{ height: '4.5rem' }}
                                                    />
                                                    <button
                                                        onClick={() => onRemove(player.id)}
                                                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center transition-colors"
                                                    >
                                                        <X size={10} className="text-white" />
                                                    </button>
                                                </div>
                                                <div>
                                                    <div className="font-black text-white text-sm">{player.web_name}</div>
                                                    <div className="text-xs text-gray-400">{team?.short_name} · {pos?.singular_name_short}</div>
                                                </div>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        <tbody>
                            {STAT_ROWS.map((row) => (
                                <React.Fragment key={row.key}>
                                    {/* Section header row */}
                                    {row.section && (
                                        <tr className="bg-slate-800/80">
                                            <td
                                                colSpan={players.length + 1}
                                                className="px-4 py-2 text-xs font-black text-gray-400 uppercase tracking-widest border-t-2 border-slate-700"
                                            >
                                                {row.section}
                                            </td>
                                        </tr>
                                    )}
                                    {/* Data row */}
                                    <tr className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors group">
                                        <td className="p-3 pl-4 text-gray-400 font-semibold text-xs uppercase tracking-wide whitespace-nowrap border-r border-slate-800">
                                            {row.label}
                                        </td>
                                        {players.map(player => {
                                            const raw = player[row.key];
                                            const display = row.format ? row.format(raw) : String(raw);
                                            const winner = isWinner(row, player);
                                            return (
                                                <td
                                                    key={player.id}
                                                    className={`p-3 text-center border-r border-slate-800 last:border-r-0 font-bold transition-colors ${winner ? 'text-fpl-green' : 'text-white'}`}
                                                >
                                                    {display}
                                                    {winner && <span className="ml-1 text-fpl-green text-xs">★</span>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CompareModal;
