import React, { useState, useEffect } from 'react';
import type { Player, Team, ElementType, PlayerSummary } from '../types/fpl';
import { fetchPlayerSummary, getPlayerImageUrl, fallbackPlayerImage } from '../services/api';
import { X, TrendingUp, TrendingDown, Star } from 'lucide-react';
import PriceHistoryChart from './PriceHistoryChart';

interface PlayerDetailsModalProps {
    player: Player;
    team: Team;
    position: ElementType;
    teams: Team[];
    onClose: () => void;
}

const Stat: React.FC<{ label: string; value: string | number; highlight?: boolean; tooltip?: string }> = ({ label, value, highlight, tooltip }) => (
    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800" title={tooltip}>
        <div className="text-gray-400 text-xs mb-1 leading-tight cursor-default">{label}</div>
        <div className={`text-lg font-bold ${highlight ? 'text-fpl-green' : 'text-white'}`}>{value}</div>
    </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-3">{children}</h3>
);

const PlayerDetailsModal: React.FC<PlayerDetailsModalProps> = ({ player, team, position, teams, onClose }) => {
    const [summary, setSummary] = useState<PlayerSummary | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'matches'>('overview');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSummary = async () => {
            try {
                const data = await fetchPlayerSummary(player.id);
                setSummary(data);
            } catch (error) {
                console.error('Failed to load summary', error);
            } finally {
                setLoading(false);
            }
        };
        loadSummary();
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; };
    }, [player.id]);

    const statusLabel = { a: 'Available', d: 'Doubtful', i: 'Injured', u: 'Unavailable' }[player.status] ?? player.status;
    const statusColor = { a: 'text-fpl-green', d: 'text-yellow-400', i: 'text-red-400', u: 'text-gray-400' }[player.status] ?? 'text-gray-400';
    const priceChangeGW = player.cost_change_event / 10;
    const priceChangeSeason = player.cost_change_start / 10;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-[92vh] overflow-hidden rounded-2xl relative z-10 flex flex-col md:flex-row animate-in fade-in zoom-in duration-200">
                <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-red-500/80 rounded-full transition-colors">
                    <X size={20} className="text-white" />
                </button>

                {/* Left: Profile */}
                <div className="md:w-72 shrink-0 bg-slate-950 p-6 flex flex-col items-center border-r border-slate-800 overflow-y-auto">
                    <div className="relative w-40 h-52 mb-4 shrink-0">
                        <img
                            src={getPlayerImageUrl(player.code)}
                            alt={player.web_name}
                            onError={(e) => { (e.target as HTMLImageElement).src = fallbackPlayerImage; }}
                            className="w-full h-full object-cover rounded-lg shadow-2xl shadow-fpl-green/20"
                        />
                        {player.in_dreamteam && (
                            <div className="absolute top-2 left-2 bg-yellow-500 rounded-full p-1" title="In Dream Team">
                                <Star size={12} className="text-slate-900 fill-slate-900" />
                            </div>
                        )}
                    </div>

                    <h2 className="text-2xl font-black text-white text-center mb-1">{player.first_name} {player.second_name}</h2>
                    <div className="flex flex-wrap justify-center gap-2 mb-5">
                        <span className="bg-slate-800 px-3 py-1 rounded-full text-sm font-bold text-fpl-blue">{team.name}</span>
                        <span className="bg-slate-800 px-3 py-1 rounded-full text-sm font-bold text-fpl-pink">{position.singular_name}</span>
                    </div>

                    {/* Status */}
                    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 mb-4 text-center">
                        <div className="text-xs text-gray-500 uppercase mb-1">Availability</div>
                        <div className={`font-bold text-sm ${statusColor}`}>{statusLabel}</div>
                        {player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round !== undefined && (
                            <div className="text-xs text-gray-400 mt-1">{player.chance_of_playing_next_round}% chance next GW</div>
                        )}
                        {player.news && (
                            <div className="text-xs text-yellow-300 mt-2 leading-relaxed">{player.news}</div>
                        )}
                    </div>

                    {/* Price */}
                    <div className="w-full grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                            <div className="text-xs text-gray-500 uppercase mb-1">Price</div>
                            <div className="text-xl font-bold text-white">£{(player.now_cost / 10).toFixed(1)}m</div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                            <div className="text-xs text-gray-500 uppercase mb-1">Pts</div>
                            <div className="text-xl font-bold text-fpl-green">{player.total_points}</div>
                        </div>
                    </div>

                    {/* Price changes */}
                    <div className="w-full grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                            <div className="text-xs text-gray-500 uppercase mb-1">GW Δ</div>
                            <div className={`text-sm font-bold flex items-center justify-center gap-0.5 ${priceChangeGW > 0 ? 'text-fpl-green' : priceChangeGW < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                {priceChangeGW > 0 ? <TrendingUp size={12} /> : priceChangeGW < 0 ? <TrendingDown size={12} /> : null}
                                {priceChangeGW > 0 ? '+' : ''}{priceChangeGW.toFixed(1)}
                            </div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                            <div className="text-xs text-gray-500 uppercase mb-1">Season Δ</div>
                            <div className={`text-sm font-bold flex items-center justify-center gap-0.5 ${priceChangeSeason > 0 ? 'text-fpl-green' : priceChangeSeason < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                {priceChangeSeason > 0 ? <TrendingUp size={12} /> : priceChangeSeason < 0 ? <TrendingDown size={12} /> : null}
                                {priceChangeSeason > 0 ? '+' : ''}{priceChangeSeason.toFixed(1)}
                            </div>
                        </div>
                    </div>

                    {/* Ownership & transfers */}
                    <div className="w-full space-y-2">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                            <span className="text-xs text-gray-400">Owned by</span>
                            <span className="text-sm font-bold text-white">{player.selected_by_percent}%</span>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                            <span className="text-xs text-gray-400">GW transfers in</span>
                            <span className="text-sm font-bold text-fpl-green">+{player.transfers_in_event.toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                            <span className="text-xs text-gray-400">GW transfers out</span>
                            <span className="text-sm font-bold text-red-400">-{player.transfers_out_event.toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                            <span className="text-xs text-gray-400">Season transfers in</span>
                            <span className="text-sm font-bold text-white">{player.transfers_in.toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                            <span className="text-xs text-gray-400">Season transfers out</span>
                            <span className="text-sm font-bold text-white">{player.transfers_out.toLocaleString()}</span>
                        </div>
                        {player.dreamteam_count > 0 && (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                                <span className="text-xs text-gray-400">Dream team appearances</span>
                                <span className="text-sm font-bold text-yellow-400">{player.dreamteam_count}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Stats & Tabs */}
                <div className="flex-1 flex flex-col bg-slate-900/95 min-w-0 overflow-hidden">
                    <div className="flex border-b border-slate-800 shrink-0">
                        {(['overview', 'matches'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === tab ? 'border-fpl-green text-fpl-green bg-slate-800/50' : 'border-transparent text-gray-400 hover:text-white hover:bg-slate-800/30'}`}
                            >
                                {tab === 'overview' ? 'Season Stats' : 'Matches & Fixtures'}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {loading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fpl-green" />
                            </div>
                        ) : activeTab === 'overview' ? (
                            <div className="space-y-7">

                                {/* FPL metrics */}
                                <div>
                                    <SectionTitle>FPL</SectionTitle>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <Stat label="Total Points" value={player.total_points} highlight />
                                        <Stat label="Points / Game" value={player.points_per_game} />
                                        <Stat label="Form" value={player.form} />
                                        <Stat label="EP This GW" value={player.ep_this} tooltip="Expected Points this gameweek — FPL's model prediction" />
                                        <Stat label="EP Next GW" value={player.ep_next} tooltip="Expected Points next gameweek — FPL's model prediction" />
                                        <Stat label="Value (season)" value={player.value_season} tooltip="Points scored per £1m of price rise since the season started" />
                                        <Stat label="Bonus Points" value={player.bonus} tooltip="Bonus points awarded this season (on top of base points)" />
                                        <Stat label="BPS" value={player.bps} tooltip="Bonus Points System — raw score used to allocate bonus points each gameweek" />
                                    </div>
                                </div>

                                {/* Attacking */}
                                <div>
                                    <SectionTitle>Attacking</SectionTitle>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <Stat label="Goals" value={player.goals_scored} />
                                        <Stat label="Assists" value={player.assists} />
                                        <Stat label="xG" value={parseFloat(player.expected_goals).toFixed(2)} tooltip="Expected Goals — the probability of scoring based on shot quality" />
                                        <Stat label="xA" value={parseFloat(player.expected_assists).toFixed(2)} tooltip="Expected Assists — the probability of assisting based on chance quality" />
                                        <Stat label="xGI" value={parseFloat(player.expected_goal_involvements).toFixed(2)} tooltip="Expected Goal Involvements — xG + xA combined" />
                                        <Stat label="Penalties Missed" value={player.penalties_missed} />
                                    </div>
                                </div>

                                {/* Defensive */}
                                <div>
                                    <SectionTitle>Defensive</SectionTitle>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <Stat label="Clean Sheets" value={player.clean_sheets} />
                                        <Stat label="Goals Conceded" value={player.goals_conceded} />
                                        <Stat label="xG Conceded" value={parseFloat(player.expected_goals_conceded).toFixed(2)} tooltip="Expected Goals Conceded — chance quality allowed by the player's team" />
                                        <Stat label="Saves" value={player.saves} />
                                        <Stat label="Penalties Saved" value={player.penalties_saved} />
                                        <Stat label="Own Goals" value={player.own_goals} />
                                    </div>
                                </div>

                                {/* Discipline & time */}
                                <div>
                                    <SectionTitle>Discipline & Time</SectionTitle>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <Stat label="Minutes" value={player.minutes.toLocaleString()} />
                                        <Stat label="Yellow Cards" value={player.yellow_cards} />
                                        <Stat label="Red Cards" value={player.red_cards} />
                                    </div>
                                </div>

                                {/* ICT */}
                                <div>
                                    <SectionTitle>ICT Index</SectionTitle>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <Stat label="ICT Index" value={player.ict_index} tooltip="Influence, Creativity & Threat combined — overall attacking threat score" />
                                        <Stat label="Influence" value={player.influence} tooltip="Influence — measures impact on a match (key passes, shots, tackles)" />
                                        <Stat label="Creativity" value={player.creativity} tooltip="Creativity — measures chance creation (crosses, through balls, key passes)" />
                                        <Stat label="Threat" value={player.threat} tooltip="Threat — measures goal threat (shots, shots on target, shots in box)" />
                                    </div>
                                </div>

                                {/* Price history chart */}
                                {summary && (
                                    <div>
                                        <SectionTitle>Price History</SectionTitle>
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                            <PriceHistoryChart history={summary.history} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {summary && (
                                    <>
                                        <div>
                                            <SectionTitle>Next 5 Fixtures</SectionTitle>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-slate-950 text-gray-400">
                                                        <tr>
                                                            <th className="p-3 rounded-l-lg">Date</th>
                                                            <th className="p-3">GW</th>
                                                            <th className="p-3">Opponent</th>
                                                            <th className="p-3 rounded-r-lg text-center">Difficulty</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800">
                                                        {summary.fixtures.slice(0, 5).map((fix) => (
                                                            <tr key={fix.id} className="hover:bg-slate-800/30">
                                                                <td className="p-3 text-white">{new Date(fix.kickoff_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                                                                <td className="p-3 text-gray-300">GW{fix.event}</td>
                                                                <td className="p-3">
                                                                    <span className={fix.is_home ? 'text-white' : 'text-gray-400'}>
                                                                        {fix.is_home ? '(H)' : '(A)'} {teams.find(t => t.id === (fix.is_home ? fix.team_a : fix.team_h))?.name ?? 'TBD'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${fix.difficulty <= 2 ? 'bg-green-500/20 text-green-400' : fix.difficulty === 3 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                                                        {fix.difficulty}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div>
                                            <SectionTitle>Match History</SectionTitle>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm whitespace-nowrap">
                                                    <thead className="bg-slate-950 text-gray-400">
                                                        <tr>
                                                            <th className="p-3 rounded-l-lg" title="Gameweek">GW</th>
                                                            <th className="p-3" title="Opponent (H = Home, A = Away)">Opponent</th>
                                                            <th className="p-3 text-center cursor-default" title="FPL Points scored">Pts</th>
                                                            <th className="p-3 text-center cursor-default" title="Minutes played">Mins</th>
                                                            <th className="p-3 text-center cursor-default" title="Goals scored">G</th>
                                                            <th className="p-3 text-center cursor-default" title="Assists">A</th>
                                                            <th className="p-3 text-center cursor-default" title="Clean sheet">CS</th>
                                                            <th className="p-3 text-center cursor-default" title="Saves (goalkeepers)">Sv</th>
                                                            <th className="p-3 text-center cursor-default" title="Bonus points awarded">Bon</th>
                                                            <th className="p-3 text-center cursor-default" title="Bonus Points System score — used to determine who receives bonus points">BPS</th>
                                                            <th className="p-3 text-center cursor-default" title="Yellow cards">YC</th>
                                                            <th className="p-3 rounded-r-lg text-center cursor-default" title="Red cards">RC</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800">
                                                        {(() => {
                                                            const reversed = [...summary.history].reverse();
                                                            const roundCounts = reversed.reduce((acc: Record<number, number>, m: any) => { acc[m.round] = (acc[m.round] || 0) + 1; return acc; }, {});
                                                            return reversed.map((match: any) => (
                                                            <tr key={match.fixture} className="hover:bg-slate-800/30">
                                                                <td className="p-3 text-gray-300 whitespace-nowrap">
                                                                    GW{match.round}
                                                                    {roundCounts[match.round] > 1 && <span className="ml-1 text-[10px] font-bold bg-purple-500/20 text-purple-300 px-1 py-0.5 rounded" title="Double gameweek">DGW</span>}
                                                                </td>
                                                                <td className="p-3 text-gray-400">
                                                                    {match.was_home ? '(H)' : '(A)'} {teams.find(t => t.id === match.opponent_team)?.short_name ?? match.opponent_team}
                                                                </td>
                                                                <td className="p-3 text-center font-bold text-fpl-green">{match.total_points}</td>
                                                                <td className="p-3 text-center text-gray-300">{match.minutes}</td>
                                                                <td className="p-3 text-center text-gray-300">{match.goals_scored}</td>
                                                                <td className="p-3 text-center text-gray-300">{match.assists}</td>
                                                                <td className="p-3 text-center text-gray-300">{match.clean_sheets}</td>
                                                                <td className="p-3 text-center text-gray-300">{match.saves}</td>
                                                                <td className="p-3 text-center text-gray-300">{match.bonus}</td>
                                                                <td className="p-3 text-center text-gray-300">{match.bps}</td>
                                                                <td className="p-3 text-center text-yellow-400">{match.yellow_cards || '-'}</td>
                                                                <td className="p-3 text-center text-red-400">{match.red_cards || '-'}</td>
                                                            </tr>
                                                            ));
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerDetailsModal;
