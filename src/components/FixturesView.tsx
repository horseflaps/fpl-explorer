import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, ChevronRight, ChevronLeft, Loader2, X } from 'lucide-react';
import type { FPLResponse, Fixture } from '../types/fpl';
import { fetchFixtures, fetchLiveEvent, fetchMatchGoals } from '../services/api';

const FULL_TEAM_NAME: Record<string, string> = {
    'Spurs': 'Tottenham Hotspur',
    'Man City': 'Manchester City',
    'Man Utd': 'Manchester United',
    "Nott'm Forest": 'Nottingham Forest',
    'Brighton': 'Brighton & Hove Albion',
    'West Ham': 'West Ham United',
    'Newcastle': 'Newcastle United',
    'Wolves': 'Wolverhampton Wanderers',
    'Leeds': 'Leeds United',
    'Leicester': 'Leicester City',
    'Ipswich': 'Ipswich Town',
};
const fullName = (name: string) => FULL_TEAM_NAME[name] ?? name;

interface FixturesViewProps {
    data: FPLResponse;
}

const POSITION_SHORT: Record<number, string> = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const POSITION_COLOR: Record<number, string> = {
    1: 'bg-yellow-500/20 text-yellow-300',
    2: 'bg-blue-500/20 text-blue-300',
    3: 'bg-green-500/20 text-green-300',
    4: 'bg-red-500/20 text-red-300',
};

const FixturesView: React.FC<FixturesViewProps> = ({ data }) => {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedGameweek, setSelectedGameweek] = useState<number>(1);
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Modal state
    const [activeFixture, setActiveFixture] = useState<Fixture | null>(null);
    const [liveData, setLiveData] = useState<any>(null);
    const [goalEvents, setGoalEvents] = useState<any[]>([]);
    const [liveLoading, setLiveLoading] = useState(false);

    const loadFixtures = useCallback(async (initial = false) => {
        try {
            const fixturesData = await fetchFixtures();
            setFixtures(fixturesData);
            if (initial) {
                const currentEvent = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
                if (currentEvent) setSelectedGameweek(currentEvent.id);
            }
        } catch (error) {
            console.error("Error loading fixtures", error);
        } finally {
            if (initial) setLoading(false);
        }
    }, [data.events]);

    useEffect(() => { loadFixtures(true); }, [loadFixtures]);

    useEffect(() => {
        const hasLive = fixtures.some(f => f.started && !f.finished);
        if (hasLive) {
            pollRef.current = setInterval(() => loadFixtures(), 60_000);
        } else {
            if (pollRef.current) clearInterval(pollRef.current);
        }
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [fixtures, loadFixtures]);

    const openFixture = async (fixture: Fixture) => {
        if (!fixture.started) return;
        setActiveFixture(fixture);
        setLiveData(null);
        setGoalEvents([]);
        setLiveLoading(true);
        try {
            const homeTeam = data.teams.find(t => t.id === fixture.team_h);
            const awayTeam = data.teams.find(t => t.id === fixture.team_a);
            const [live, goals] = await Promise.all([
                fetchLiveEvent(fixture.event),
                fetchMatchGoals(fixture.kickoff_time, homeTeam?.name ?? '', awayTeam?.name ?? ''),
            ]);
            setLiveData(live);
            setGoalEvents(goals);
        } catch (e) {
            console.error('Failed to fetch fixture data', e);
        } finally {
            setLiveLoading(false);
        }
    };

    const getTeam = (id: number) => data.teams.find(t => t.id === id);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 text-fpl-green animate-spin" />
            </div>
        );
    }

    const currentGameweekId = data.events.find(e => e.is_current)?.id || data.events.find(e => e.is_next)?.id || 1;

    const filteredFixtures = selectedTeamId
        ? fixtures.filter(f => f.team_h === selectedTeamId || f.team_a === selectedTeamId).sort((a, b) => new Date(b.kickoff_time).getTime() - new Date(a.kickoff_time).getTime())
        : fixtures.filter(f => f.event === selectedGameweek);

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between bg-slate-800/50 p-4 rounded-xl backdrop-blur-sm border border-slate-700 gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="p-3 bg-fpl-blue/20 rounded-lg">
                        <Calendar className="w-6 h-6 text-fpl-blue" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Fixtures</h2>
                        <p className="text-gray-400 text-sm">
                            {selectedTeamId ? 'All Matches' : `Gameweek ${selectedGameweek}`}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="w-full sm:w-64">
                        <select
                            value={selectedTeamId || ''}
                            onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fpl-blue cursor-pointer"
                        >
                            <option value="">Filter by Team (All)</option>
                            {data.teams.map((team) => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                        </select>
                    </div>

                    {!selectedTeamId && (
                        <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1 w-full sm:w-auto justify-center">
                            <button
                                onClick={() => setSelectedGameweek(currentGameweekId)}
                                className={`px-3 py-2 text-xs font-bold hover:bg-slate-700 rounded-md transition-colors mr-1 ${selectedGameweek === currentGameweekId ? 'text-fpl-green' : 'text-gray-400'}`}
                            >
                                Current
                            </button>
                            <div className="w-px h-6 bg-slate-800 mx-1" />
                            <button
                                onClick={() => setSelectedGameweek(prev => Math.max(1, prev - 1))}
                                className="p-2 hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50"
                                disabled={selectedGameweek <= 1}
                            >
                                <ChevronLeft size={20} className="text-gray-400" />
                            </button>
                            <span className="w-24 text-center font-bold text-white">GW {selectedGameweek}</span>
                            <button
                                onClick={() => setSelectedGameweek(prev => Math.max(1, prev + 1))}
                                className="p-2 hover:bg-slate-700 rounded-md transition-colors"
                            >
                                <ChevronRight size={20} className="text-gray-400" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Fixture Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
                {filteredFixtures.map((fixture) => {
                    const homeTeam = getTeam(fixture.team_h);
                    const awayTeam = getTeam(fixture.team_a);
                    const date = new Date(fixture.kickoff_time);
                    const isOver = fixture.finished || fixture.finished_provisional;
                    const isLive = fixture.started && !isOver;
                    const clickable = fixture.started;

                    return (
                        <div
                            key={fixture.id}
                            onClick={() => clickable && openFixture(fixture)}
                            className={`bg-slate-800/50 border rounded-xl p-4 transition-colors group ${isLive ? 'border-green-500/50 bg-green-900/10' : 'border-slate-700/50'} ${clickable ? 'cursor-pointer hover:border-fpl-green/60 hover:bg-slate-700/50' : ''}`}
                        >
                            <div className="text-center text-xs text-gray-500 mb-3 flex justify-between uppercase tracking-wider font-semibold">
                                <span>{date.toLocaleDateString()}</span>
                                {selectedTeamId && fixture.event && (
                                    <span className="text-fpl-blue font-bold">GW{fixture.event}</span>
                                )}
                                <span>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex flex-col items-center flex-1">
                                    <div className="w-12 h-12 mb-2 bg-white/5 rounded-full flex items-center justify-center p-2">
                                        <img
                                            src={`https://resources.premierleague.com/premierleague/badges/t${homeTeam?.code}.png`}
                                            alt={homeTeam?.name}
                                            className="w-full h-full object-contain"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold text-white text-center">{homeTeam?.name}</span>
                                </div>

                                <div className="mx-4 flex flex-col items-center justify-center gap-1">
                                    {fixture.started ? (
                                        <>
                                                            <div className={`px-4 py-2 rounded-lg font-mono text-xl font-bold text-white ${isOver ? 'bg-slate-900 border border-slate-700' : 'bg-green-900/40 border border-green-500/60'}`}>
                                                {fixture.team_h_score ?? 0} - {fixture.team_a_score ?? 0}
                                            </div>
                                            {isLive && (
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 uppercase tracking-widest">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                                    Live {fixture.minutes > 0 ? `${fixture.minutes}'` : ''}
                                                </span>
                                            )}
                                            {isOver && (
                                                <span className="text-[10px] text-gray-500 uppercase tracking-widest">Full Time</span>
                                            )}
                                        </>
                                    ) : (
                                        <div className="p-2 rounded-full bg-slate-900 border border-slate-700 text-xs text-gray-400">
                                            VS
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col items-center flex-1">
                                    <div className="w-12 h-12 mb-2 bg-white/5 rounded-full flex items-center justify-center p-2">
                                        <img
                                            src={`https://resources.premierleague.com/premierleague/badges/t${awayTeam?.code}.png`}
                                            alt={awayTeam?.name}
                                            className="w-full h-full object-contain"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold text-white text-center">{awayTeam?.name}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredFixtures.length === 0 && (
                <div className="text-center py-12 text-gray-500">No fixtures found for this Gameweek.</div>
            )}

            {/* Fixture Detail Modal */}
            {activeFixture && (
                <FixtureModal
                    fixture={activeFixture}
                    liveData={liveData}
                    goalEvents={goalEvents}
                    liveLoading={liveLoading}
                    data={data}
                    onClose={() => setActiveFixture(null)}
                />
            )}
        </div>
    );
};

interface FixtureModalProps {
    fixture: Fixture;
    liveData: any;
    goalEvents: any[];
    liveLoading: boolean;
    data: FPLResponse;
    onClose: () => void;
}

const FixtureModal: React.FC<FixtureModalProps> = ({ fixture, liveData, goalEvents, liveLoading, data, onClose }) => {
    const homeTeam = data.teams.find(t => t.id === fixture.team_h);
    const awayTeam = data.teams.find(t => t.id === fixture.team_a);

    // Build scorer display: use football-data.org events (with minutes) if available,
    // otherwise fall back to fixture.stats element IDs
    interface ScorerEntry { label: string; minute: number | null; }

    const getScorers = (side: 'h' | 'a'): ScorerEntry[] => {
        if (goalEvents.length > 0) {
            return goalEvents
                .filter(g => g.team === side)
                .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
                .map(g => {
                    const suffix = g.type === 'OWN' ? ' (og)' : g.type === 'PENALTY' ? ' (pen)' : '';
                    const min = g.minute != null ? `${g.minute}${g.extraTime ? '+' + g.extraTime : ''}'` : null;
                    // Try to find short web_name from FPL elements by surname match
                    const lastName = g.scorer.split(' ').pop() ?? g.scorer;
                    const fplName = data.elements.find(p =>
                        p.web_name.toLowerCase() === lastName.toLowerCase() ||
                        p.second_name.toLowerCase() === lastName.toLowerCase()
                    )?.web_name ?? lastName;
                    return { label: `${fplName}${suffix}`, minute: g.minute };
                });
        }
        // Fallback: fixture.stats (no timing)
        const fixtureStats: any[] = (fixture as any).stats ?? [];
        const goals = fixtureStats.find((s: any) => s.identifier === 'goals_scored');
        const ownGoals = fixtureStats.find((s: any) => s.identifier === 'own_goals');
        const oppSide = side === 'h' ? 'a' : 'h';
        const result: ScorerEntry[] = [];
        goals?.[side]?.forEach((g: any) => {
            const name = data.elements.find(p => p.id === g.element)?.web_name ?? '?';
            for (let i = 0; i < g.value; i++) result.push({ label: name, minute: null });
        });
        ownGoals?.[oppSide]?.forEach((g: any) => {
            const name = data.elements.find(p => p.id === g.element)?.web_name ?? '?';
            for (let i = 0; i < g.value; i++) result.push({ label: `${name} (og)`, minute: null });
        });
        return result;
    };
    const homeScorers = getScorers('h');
    const awayScorers = getScorers('a');

    // Build per-fixture player rows from live data
    const buildTeamRows = (teamId: number) => {
        if (!liveData?.elements) return [];

        const teamPlayers = data.elements.filter(p => p.team === teamId);

        return teamPlayers.map(player => {
            const liveEl = liveData.elements.find((el: any) => el.id === player.id);
            if (!liveEl) return null;

            // Use the explain entry for this specific fixture if available
            const explainForFixture = liveEl.explain?.find((ex: any) => ex.fixture === fixture.id);
            const stats = explainForFixture
                ? Object.fromEntries(explainForFixture.stats.map((s: any) => [s.identifier, { value: s.value, points: s.points }]))
                : null;

            const minutes = stats?.minutes?.value ?? liveEl.stats.minutes;
            if (minutes === 0 && !explainForFixture) return null; // didn't play

            const totalPoints = explainForFixture
                ? explainForFixture.stats.reduce((sum: number, s: any) => sum + s.points, 0)
                : liveEl.stats.total_points;

            return {
                player,
                minutes,
                goals: stats?.goals_scored?.value ?? liveEl.stats.goals_scored,
                assists: stats?.assists?.value ?? liveEl.stats.assists,
                cleanSheet: stats?.clean_sheets?.value ?? liveEl.stats.clean_sheets,
                bonus: stats?.bonus?.value ?? liveEl.stats.bonus,
                yellowCards: stats?.yellow_cards?.value ?? liveEl.stats.yellow_cards,
                redCards: stats?.red_cards?.value ?? liveEl.stats.red_cards,
                saves: stats?.saves?.value ?? liveEl.stats.saves,
                ownGoals: stats?.own_goals?.value ?? liveEl.stats.own_goals,
                totalPoints,
            };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null && r.totalPoints !== 0)
        .sort((a, b) => (b.totalPoints - a.totalPoints || b.minutes - a.minutes));
    };

    const homeRows = buildTeamRows(fixture.team_h);
    const awayRows = buildTeamRows(fixture.team_a);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
                className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="relative px-5 py-4 border-b border-slate-700 shrink-0">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
                        {/* Home — right-aligned */}
                        <div className="flex flex-col items-end gap-1 pt-1">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-white">{fullName(homeTeam?.name ?? '')}</span>
                                <img src={`https://resources.premierleague.com/premierleague/badges/t${homeTeam?.code}.png`} alt={homeTeam?.name} className="w-8 h-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                            {homeScorers.map((s, i) => (
                                <span key={i} className="text-xs text-gray-400">
                                    {s.label} ⚽{s.minute != null && <span className="text-gray-500 ml-1">{s.minute}'</span>}
                                </span>
                            ))}
                        </div>

                        {/* Score */}
                        <div className={`px-5 py-2 rounded-lg font-mono text-2xl font-bold text-white text-center ${(fixture.finished || fixture.finished_provisional) ? 'bg-slate-800 border border-slate-700' : 'bg-green-900/40 border border-green-500/60'}`}>
                            {fixture.team_h_score ?? 0} - {fixture.team_a_score ?? 0}
                        </div>

                        {/* Away — left-aligned */}
                        <div className="flex flex-col items-start gap-1 pt-1">
                            <div className="flex items-center gap-2">
                                <img src={`https://resources.premierleague.com/premierleague/badges/t${awayTeam?.code}.png`} alt={awayTeam?.name} className="w-8 h-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                <span className="font-bold text-white">{fullName(awayTeam?.name ?? '')}</span>
                            </div>
                            {awayScorers.map((s, i) => (
                                <span key={i} className="text-xs text-gray-400">
                                    {s.minute != null && <span className="text-gray-500 mr-1">{s.minute}'</span>}⚽ {s.label}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 p-4">
                    {liveLoading ? (
                        <div className="flex justify-center items-center py-16">
                            <Loader2 className="w-8 h-8 text-fpl-green animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TeamColumn label={fullName(homeTeam?.name ?? '')} rows={homeRows} />
                            <TeamColumn label={fullName(awayTeam?.name ?? '')} rows={awayRows} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface TeamColumnProps {
    label: string;
    rows: any[];
}

const StatBadge: React.FC<{ value: number; label: string; color: string; tooltip: string }> = ({ value, label, color, tooltip }) => {
    if (!value) return null;
    return (
        <span title={tooltip} className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-default ${color}`}>
            {value}{label}
        </span>
    );
};

const TeamColumn: React.FC<TeamColumnProps> = ({ label, rows }) => (
    <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 pb-1 border-b border-slate-700">{label}</h3>
        {rows.length === 0 ? (
            <p className="text-gray-600 text-xs py-4 text-center">No data</p>
        ) : (
            <div className="space-y-1.5">
                {rows.map((row: any) => (
                    <div key={row.player.id} className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${POSITION_COLOR[row.player.element_type]}`}>
                            {POSITION_SHORT[row.player.element_type]}
                        </span>
                        <span className="text-white text-sm font-medium flex-1 truncate">{row.player.web_name}</span>
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                            <StatBadge value={row.goals} label="G" color="bg-green-500/20 text-green-300" tooltip="Goals scored" />
                            <StatBadge value={row.assists} label="A" color="bg-blue-500/20 text-blue-300" tooltip="Assists" />
                            <StatBadge value={row.cleanSheet} label="CS" color="bg-yellow-500/20 text-yellow-300" tooltip="Clean sheet" />
                            <StatBadge value={row.saves} label="Sv" color="bg-purple-500/20 text-purple-300" tooltip="Saves" />
                            <StatBadge value={row.bonus} label="B" color="bg-orange-500/20 text-orange-300" tooltip="Bonus points" />
                            <StatBadge value={row.ownGoals} label="OG" color="bg-red-500/20 text-red-300" tooltip="Own goals" />
                            <StatBadge value={row.yellowCards} label="Y" color="bg-yellow-500/20 text-yellow-300" tooltip="Yellow cards" />
                            <StatBadge value={row.redCards} label="R" color="bg-red-500/20 text-red-300" tooltip="Red cards" />
                        </div>
                        <span className="text-gray-500 text-[10px] shrink-0">{row.minutes}'</span>
                        <span className={`text-sm font-bold shrink-0 w-6 text-right ${row.totalPoints > 0 ? 'text-fpl-green' : 'text-gray-500'}`}>
                            {row.totalPoints}
                        </span>
                    </div>
                ))}
            </div>
        )}
    </div>
);

export default FixturesView;
