import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FPLResponse, Fixture, Player } from '../types/fpl';
import { Shield, Calendar, Users, Activity, Loader2, ChevronDown, TrendingUp } from 'lucide-react';
import { fetchFixtures } from '../services/api';

interface TeamsViewProps {
    data: FPLResponse;
}

const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const POSITION_COLORS: Record<number, string> = {
    1: 'text-yellow-400 bg-yellow-400/10',
    2: 'text-blue-400 bg-blue-400/10',
    3: 'text-green-400 bg-green-400/10',
    4: 'text-red-400 bg-red-400/10',
};

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
    const colors: Record<string, string> = { a: 'bg-green-500', d: 'bg-yellow-500', i: 'bg-red-500', u: 'bg-gray-500', s: 'bg-gray-600', n: 'bg-gray-600' };
    return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? 'bg-gray-500'}`} title={status === 'a' ? 'Available' : status === 'd' ? 'Doubtful' : status === 'i' ? 'Injured' : 'Unavailable'} />;
};

const StrengthBar: React.FC<{ label: string; home: number; away: number }> = ({ label, home, away }) => {
    const min = 1000, max = 1400;
    const pctH = Math.round(((home - min) / (max - min)) * 100);
    const pctA = Math.round(((away - min) / (max - min)) * 100);
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-semibold uppercase tracking-wider">{label}</span>
                <div className="flex gap-3">
                    <span className="text-fpl-green font-mono font-bold">{home}<span className="text-gray-500 font-normal"> H</span></span>
                    <span className="text-fpl-blue font-mono font-bold">{away}<span className="text-gray-500 font-normal"> A</span></span>
                </div>
            </div>
            <div className="flex gap-1 h-1.5">
                <div className="flex-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-fpl-green rounded-full" style={{ width: `${pctH}%` }} />
                </div>
                <div className="flex-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-fpl-blue rounded-full" style={{ width: `${pctA}%` }} />
                </div>
            </div>
        </div>
    );
};


const TeamsView: React.FC<TeamsViewProps> = ({ data }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedTeamId = searchParams.get('id') ? Number(searchParams.get('id')) : null;
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(true);
    const [squadTab, setSquadTab] = useState<0 | 1 | 2 | 3 | 4>(0); // 0=All, 1-4=pos
    const [squadSort, setSquadSort] = useState<keyof Player>('total_points');
    const [squadSortDir, setSquadSortDir] = useState<'asc' | 'desc'>('desc');

    const onSelectTeam = (id: number | null) => {
        if (id) setSearchParams({ id: id.toString() });
        else setSearchParams({});
    };

    useEffect(() => {
        fetchFixtures().then(f => { setFixtures(f); setLoading(false); });
    }, []);

    const activeTeam = selectedTeamId ? data.teams.find(t => t.id === selectedTeamId) : null;

    const teamFixtures = useMemo(() =>
        activeTeam ? fixtures.filter(f => f.team_h === activeTeam.id || f.team_a === activeTeam.id) : [],
        [fixtures, activeTeam]);

    const sortedFixtures = useMemo(() =>
        [...teamFixtures].sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()),
        [teamFixtures]);

    const nextFixtures = sortedFixtures.filter(f => !f.finished).slice(0, 5);
    const recentResults = sortedFixtures.filter(f => f.finished).slice(-5).reverse();

    const teamPlayers = useMemo(() =>
        activeTeam ? data.elements.filter(p => p.team === activeTeam.id) : [],
        [data.elements, activeTeam]);

    const squadPlayers = useMemo(() => {
        const filtered = squadTab === 0 ? teamPlayers : teamPlayers.filter(p => p.element_type === squadTab);
        return [...filtered].sort((a, b) => {
            const av = a[squadSort] as number;
            const bv = b[squadSort] as number;
            return squadSortDir === 'desc' ? bv - av : av - bv;
        });
    }, [teamPlayers, squadTab, squadSort, squadSortDir]);

    const getOpponent = (fix: Fixture) => {
        if (!activeTeam) return null;
        const oppId = fix.team_h === activeTeam.id ? fix.team_a : fix.team_h;
        return data.teams.find(t => t.id === oppId);
    };


    const sortedLeague = useMemo(() =>
        [...data.teams].sort((a, b) => a.position - b.position),
        [data.teams]);

    const toggleSort = (key: keyof Player) => {
        if (squadSort === key) setSquadSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSquadSort(key); setSquadSortDir('desc'); }
    };

    const Th: React.FC<{ col: keyof Player; label: string; title?: string }> = ({ col, label, title }) => (
        <th
            className="text-right text-[10px] text-gray-500 uppercase font-bold py-2 px-2 cursor-pointer hover:text-white transition-colors select-none whitespace-nowrap"
            title={title}
            onClick={() => toggleSort(col)}
        >
            {label}
            {squadSort === col && <span className="ml-0.5 opacity-60">{squadSortDir === 'desc' ? '↓' : '↑'}</span>}
        </th>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header / Selector */}
            <div className="glass p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Team Hub</h2>
                    <p className="text-gray-400 text-sm">Select a club to view the full picture</p>
                </div>
                <div className="w-full md:w-72 relative">
                    <select
                        value={selectedTeamId || ''}
                        onChange={(e) => onSelectTeam(e.target.value ? Number(e.target.value) : null)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-3 pr-10 focus:outline-none focus:border-fpl-blue focus:ring-1 focus:ring-fpl-blue appearance-none cursor-pointer"
                    >
                        <option value="">Select a Team...</option>
                        {sortedLeague.map((team) => (
                            <option key={team.id} value={team.id}>{team.position}. {team.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
            </div>

            {activeTeam ? (
                <div className="space-y-6">

                    {/* Hero Card */}
                    <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-fpl-green via-fpl-blue to-fpl-pink" />
                        <div className="p-6 md:p-8">
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                {/* Badge + name */}
                                <div className="flex items-center gap-5">
                                    <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center p-3 border border-white/10 shadow-xl shrink-0">
                                        <img
                                            src={`https://resources.premierleague.com/premierleague/badges/t${activeTeam.code}.png`}
                                            alt={activeTeam.name}
                                            className="w-full h-full object-contain"
                                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://resources.premierleague.com/premierleague/badges/t1.png'; }}
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-baseline gap-3">
                                            <h3 className="text-3xl md:text-4xl font-black text-white tracking-tight">{activeTeam.name}</h3>
                                            <span className="text-gray-500 font-mono text-sm">{activeTeam.short_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-fpl-green font-black text-lg">#{activeTeam.position}</span>
                                            <span className="text-gray-500 text-sm">Premier League</span>
                                        </div>
                                    </div>
                                </div>

                                {/* League record */}
                                <div className="flex-1 grid grid-cols-5 gap-2 md:gap-4 text-center md:ml-8">
                                    {[
                                        { label: 'Played', val: activeTeam.played },
                                        { label: 'Won', val: activeTeam.win, color: 'text-fpl-green' },
                                        { label: 'Drawn', val: activeTeam.draw, color: 'text-gray-400' },
                                        { label: 'Lost', val: activeTeam.loss, color: 'text-red-400' },
                                        { label: 'Points', val: activeTeam.points, color: 'text-fpl-blue' },
                                    ].map(({ label, val, color }) => (
                                        <div key={label} className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                                            <div className={`text-2xl font-black ${color ?? 'text-white'}`}>{val}</div>
                                            <div className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">{label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Three column: Strengths | Recent Form | Next Fixtures */}
                    <div className="grid lg:grid-cols-3 gap-6">

                        {/* FPL Strength Ratings */}
                        <div className="glass-card p-6 space-y-5">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="text-fpl-green" size={20} />
                                <h4 className="text-lg font-bold text-white">FPL Strength Ratings</h4>
                            </div>
                            <div className="space-y-4">
                                <StrengthBar label="Overall" home={activeTeam.strength_overall_home} away={activeTeam.strength_overall_away} />
                                <StrengthBar label="Attack" home={activeTeam.strength_attack_home} away={activeTeam.strength_attack_away} />
                                <StrengthBar label="Defence" home={activeTeam.strength_defence_home} away={activeTeam.strength_defence_away} />
                            </div>
                            <div className="flex gap-4 text-xs text-gray-500 pt-1 border-t border-slate-800">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-fpl-green inline-block" /> Home</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-fpl-blue inline-block" /> Away</span>
                                <span className="ml-auto">FDR Base: <span className="text-white font-bold">{activeTeam.strength}</span></span>
                            </div>
                        </div>

                        {/* Recent Form */}
                        <div className="glass-card p-6 flex flex-col">
                            <div className="flex items-center gap-3 mb-5">
                                <Activity className="text-blue-400" size={20} />
                                <h4 className="text-lg font-bold text-white">Recent Results</h4>
                            </div>
                            {loading ? (
                                <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-fpl-green" /></div>
                            ) : (
                                <div className="space-y-2.5">
                                    {recentResults.map(fix => {
                                        const opponent = getOpponent(fix);
                                        const isHome = fix.team_h === activeTeam.id;
                                        const scoreHome = fix.team_h_score ?? 0;
                                        const scoreAway = fix.team_a_score ?? 0;
                                        const myScore = isHome ? scoreHome : scoreAway;
                                        const oppScore = isHome ? scoreAway : scoreHome;
                                        let result = 'D', color = 'text-gray-400 bg-gray-400/10';
                                        if (myScore > oppScore) { result = 'W'; color = 'text-green-400 bg-green-400/10'; }
                                        else if (myScore < oppScore) { result = 'L'; color = 'text-red-400 bg-red-400/10'; }
                                        return (
                                            <div key={fix.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/40 border border-slate-800">
                                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${color}`}>{result}</span>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-white font-semibold text-sm">{opponent?.short_name ?? '?'}</span>
                                                    <span className="text-gray-500 text-xs ml-2">({isHome ? 'H' : 'A'})</span>
                                                </div>
                                                <span className="font-black text-white text-sm font-mono">{scoreHome}–{scoreAway}</span>
                                                <span className="text-gray-600 text-xs font-mono">{new Date(fix.kickoff_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                            </div>
                                        );
                                    })}
                                    {recentResults.length === 0 && <p className="text-gray-500 text-sm">No completed matches.</p>}
                                </div>
                            )}
                        </div>

                        {/* Next Fixtures */}
                        <div className="glass-card p-6 flex flex-col">
                            <div className="flex items-center gap-3 mb-5">
                                <Calendar className="text-yellow-400" size={20} />
                                <h4 className="text-lg font-bold text-white">Upcoming Fixtures</h4>
                            </div>
                            {loading ? (
                                <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-fpl-green" /></div>
                            ) : (
                                <div className="space-y-2.5">
                                    {nextFixtures.map(fix => {
                                        const opponent = getOpponent(fix);
                                        const isHome = fix.team_h === activeTeam.id;
                                        const fdr = fix.difficulty;
                                        const fdrColor = fdr <= 2 ? 'text-green-400 bg-green-400/10' : fdr === 3 ? 'text-yellow-400 bg-yellow-400/10' : fdr === 4 ? 'text-orange-400 bg-orange-400/10' : 'text-red-400 bg-red-400/10';
                                        return (
                                            <div key={fix.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/40 border border-slate-800">
                                                <div className={`w-1.5 h-8 rounded-full shrink-0 ${isHome ? 'bg-fpl-green' : 'bg-fpl-blue'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-white font-semibold text-sm">{opponent?.name ?? '?'}</div>
                                                    <div className="text-gray-500 text-xs">{isHome ? 'Home' : 'Away'} · GW{fix.event}</div>
                                                </div>
                                                <span className={`text-xs font-black px-2 py-1 rounded-lg ${fdrColor}`} title="Fixture Difficulty Rating">FDR {fdr}</span>
                                                <span className="text-gray-600 text-xs font-mono">{new Date(fix.kickoff_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                            </div>
                                        );
                                    })}
                                    {nextFixtures.length === 0 && <p className="text-gray-500 text-sm">No upcoming fixtures scheduled.</p>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Full Squad Table */}
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <Users className="text-fpl-purple" size={20} />
                                <h4 className="text-lg font-bold text-white">Squad ({teamPlayers.length})</h4>
                            </div>
                            {/* Position tabs */}
                            <div className="flex gap-1">
                                {([['All', 0], ['GK', 1], ['DEF', 2], ['MID', 3], ['FWD', 4]] as [string, 0|1|2|3|4][]).map(([label, val]) => (
                                    <button
                                        key={val}
                                        onClick={() => setSquadTab(val)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${squadTab === val ? 'bg-fpl-green text-slate-900' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left text-[10px] text-gray-500 uppercase font-bold py-2 px-2">Player</th>
                                        <th className="text-left text-[10px] text-gray-500 uppercase font-bold py-2 px-2">Pos</th>
                                        <Th col="now_cost" label="Price" title="Current price" />
                                        <Th col="total_points" label="Pts" title="Total points this season" />
                                        <Th col="points_per_game" label="PPG" title="Points per game" />
                                        <Th col="form" label="Form" title="Average points over last 4 games" />
                                        <Th col="selected_by_percent" label="Own%" title="Ownership percentage" />
                                        <Th col="minutes" label="Mins" title="Minutes played" />
                                        <Th col="goals_scored" label="G" title="Goals scored" />
                                        <Th col="assists" label="A" title="Assists" />
                                        <Th col="expected_goal_involvements" label="xGI" title="Expected goal involvements" />
                                        <Th col="clean_sheets" label="CS" title="Clean sheets" />
                                        <Th col="expected_goals_conceded" label="xGC" title="Expected goals conceded" />
                                        <Th col="saves" label="Sv" title="Saves" />
                                        <Th col="bonus" label="Bon" title="Bonus points" />
                                        <Th col="transfers_in_event" label="Tr+" title="Transfers in this gameweek" />
                                        <Th col="transfers_out_event" label="Tr-" title="Transfers out this gameweek" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {squadPlayers.map(player => {
                                        const posColor = POSITION_COLORS[player.element_type] ?? 'text-gray-400';
                                        const isUnavail = player.status !== 'a';
                                        return (
                                            <tr key={player.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                                <td className="py-2 px-2">
                                                    <div className="flex items-center gap-2">
                                                        <StatusDot status={player.status} />
                                                        <span className={`font-semibold ${isUnavail ? 'text-gray-400' : 'text-white'}`}>{player.web_name}</span>
                                                        {player.news && (
                                                            <span className="text-[10px] text-yellow-400 truncate max-w-[120px]" title={player.news}>⚠</span>
                                                        )}
                                                        {player.in_dreamteam && (
                                                            <span className="text-[10px] text-fpl-green font-black" title="In Dream Team">★</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-2 px-2">
                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${posColor}`}>
                                                        {POSITION_LABELS[player.element_type]}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-2 text-right font-mono text-gray-300">£{(player.now_cost / 10).toFixed(1)}m</td>
                                                <td className="py-2 px-2 text-right font-bold text-fpl-green">{player.total_points}</td>
                                                <td className="py-2 px-2 text-right text-gray-300">{player.points_per_game}</td>
                                                <td className="py-2 px-2 text-right text-gray-300">{player.form}</td>
                                                <td className="py-2 px-2 text-right text-gray-300">{player.selected_by_percent}%</td>
                                                <td className="py-2 px-2 text-right text-gray-400">{player.minutes}</td>
                                                <td className="py-2 px-2 text-right text-gray-300">{player.goals_scored}</td>
                                                <td className="py-2 px-2 text-right text-gray-300">{player.assists}</td>
                                                <td className="py-2 px-2 text-right text-gray-400">{parseFloat(player.expected_goal_involvements).toFixed(1)}</td>
                                                <td className="py-2 px-2 text-right text-gray-400">{player.clean_sheets}</td>
                                                <td className="py-2 px-2 text-right text-gray-400">{parseFloat(player.expected_goals_conceded).toFixed(1)}</td>
                                                <td className="py-2 px-2 text-right text-gray-400">{player.saves || '–'}</td>
                                                <td className="py-2 px-2 text-right text-gray-400">{player.bonus}</td>
                                                <td className="py-2 px-2 text-right text-green-400 text-xs">{player.transfers_in_event > 0 ? `+${player.transfers_in_event.toLocaleString()}` : '–'}</td>
                                                <td className="py-2 px-2 text-right text-red-400 text-xs">{player.transfers_out_event > 0 ? `-${player.transfers_out_event.toLocaleString()}` : '–'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {squadPlayers.length === 0 && (
                                <p className="text-center text-gray-500 py-8">No players found.</p>
                            )}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-[10px] text-gray-600 border-t border-slate-800 pt-3">
                            <span><span className="text-green-500 font-bold">●</span> Available</span>
                            <span><span className="text-yellow-500 font-bold">●</span> Doubtful</span>
                            <span><span className="text-red-500 font-bold">●</span> Injured/Suspended</span>
                            <span><span className="text-fpl-green font-bold">★</span> In Dream Team</span>
                            <span>⚠ Injury news</span>
                            <span className="ml-auto">Click column headers to sort</span>
                        </div>
                    </div>

                </div>
            ) : (
                /* League table overview when no team selected */
                <div className="space-y-4">
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Shield className="text-fpl-green" size={20} />
                            <h4 className="text-lg font-bold text-white">Premier League Table</h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left text-[10px] text-gray-500 uppercase font-bold py-2 px-2 w-8">#</th>
                                        <th className="text-left text-[10px] text-gray-500 uppercase font-bold py-2 px-2">Club</th>
                                        <th className="text-right text-[10px] text-gray-500 uppercase font-bold py-2 px-2">P</th>
                                        <th className="text-right text-[10px] text-gray-500 uppercase font-bold py-2 px-2">W</th>
                                        <th className="text-right text-[10px] text-gray-500 uppercase font-bold py-2 px-2">D</th>
                                        <th className="text-right text-[10px] text-gray-500 uppercase font-bold py-2 px-2">L</th>
                                        <th className="text-right text-[10px] text-gray-500 uppercase font-bold py-2 px-2 font-black text-white">Pts</th>
                                        <th className="text-right text-[10px] text-gray-500 uppercase font-bold py-2 px-2">FDR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedLeague.map((team) => (
                                        <tr
                                            key={team.id}
                                            className="border-b border-slate-800/50 hover:bg-slate-800/40 cursor-pointer transition-colors"
                                            onClick={() => onSelectTeam(team.id)}
                                        >
                                            <td className="py-2 px-2 text-gray-500 font-mono text-xs">{team.position}</td>
                                            <td className="py-2 px-2">
                                                <div className="flex items-center gap-2">
                                                    <img
                                                        src={`https://resources.premierleague.com/premierleague/badges/t${team.code}.png`}
                                                        alt={team.name}
                                                        className="w-5 h-5 object-contain"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                    <span className="text-white font-semibold">{team.name}</span>
                                                    <span className="text-gray-600 text-xs font-mono">({team.short_name})</span>
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 text-right text-gray-400">{team.played}</td>
                                            <td className="py-2 px-2 text-right text-green-400">{team.win}</td>
                                            <td className="py-2 px-2 text-right text-gray-400">{team.draw}</td>
                                            <td className="py-2 px-2 text-right text-red-400">{team.loss}</td>
                                            <td className="py-2 px-2 text-right font-black text-white">{team.points}</td>
                                            <td className="py-2 px-2 text-right text-gray-500 text-xs">{team.strength}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-3">Click any team to view full details</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamsView;
