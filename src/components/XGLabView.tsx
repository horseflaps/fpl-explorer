import React, { useState, useMemo } from 'react';
import type { FPLResponse, Player, History } from '../types/fpl';
import { fetchPlayerSummary, getPlayerImageUrl, fallbackPlayerImage } from '../services/api';
import { ArrowUpDown, X, TrendingUp, TrendingDown, FlaskConical } from 'lucide-react';

interface XGLabViewProps { data: FPLResponse; }

// ── Scoring rules ────────────────────────────────────────────────────────────
const goalPts = (pos: number) => pos <= 2 ? 6 : pos === 3 ? 5 : 4;
const csPts   = (pos: number) => pos <= 2 ? 4 : pos === 3 ? 1 : 0;
// P(clean sheet) via Poisson P(X=0) = e^(-λ)
const pCS = (xgc: number) => Math.exp(-xgc);

// Season xP from bootstrap fields (appearance pts estimated from minutes)
function seasonXP(p: Player): number {
    const xg  = parseFloat(p.expected_goals || '0');
    const xa  = parseFloat(p.expected_assists || '0');
    const xgc = parseFloat(p.expected_goals_conceded || '0');
    const est  = p.minutes / 75;
    const full = p.minutes / 90;
    const appPts = full * 2 + Math.max(0, est - full) * 1;
    const xcsPerGame = est > 0 ? pCS(xgc / est) : 0;
    const xCSPts = csPts(p.element_type) * xcsPerGame * est;
    const savePts = p.element_type === 1 ? p.saves / 3 : 0;
    return appPts + xg * goalPts(p.element_type) + xa * 3 + xCSPts + savePts;
}

// Per-match xP from history
function matchXP(h: History, pos: number): number {
    if (h.minutes === 0) return 0;
    const xg  = parseFloat(h.expected_goals  || '0');
    const xa  = parseFloat(h.expected_assists || '0');
    const xgc = parseFloat(h.expected_goals_conceded || '0');
    const app = h.minutes >= 60 ? 2 : 1;
    const xCSPts = csPts(pos) * pCS(xgc);
    const savePts = pos === 1 ? h.saves / 3 : 0;
    return app + xg * goalPts(pos) + xa * 3 + xCSPts + savePts;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt2 = (v: number) => v.toFixed(2);
const fmt1 = (v: number) => v.toFixed(1);
const POSITIONS = [
    { id: 1, label: 'GK',  full: 'Goalkeepers' },
    { id: 2, label: 'DEF', full: 'Defenders' },
    { id: 3, label: 'MID', full: 'Midfielders' },
    { id: 4, label: 'FWD', full: 'Forwards' },
];

const DiffBadge: React.FC<{ diff: number; decimals?: number }> = ({ diff, decimals = 2 }) => {
    if (Math.abs(diff) < 0.05) return <span className="text-gray-500 text-xs">≈0</span>;
    const pos = diff > 0;
    return (
        <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${pos ? 'text-fpl-green' : 'text-red-400'}`}>
            {pos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {pos ? '+' : ''}{diff.toFixed(decimals)}
        </span>
    );
};

const Th: React.FC<{ children: React.ReactNode; tooltip: string; center?: boolean; onClick?: () => void; active?: boolean; className?: string }> =
    ({ children, tooltip, center = true, onClick, active, className = '' }) => (
        <th
            title={tooltip}
            onClick={onClick}
            className={`p-3 text-xs font-bold uppercase tracking-wide select-none
                ${center ? 'text-center' : 'text-left'}
                ${onClick ? 'cursor-pointer hover:text-white transition-colors' : 'cursor-default'}
                ${active ? 'text-fpl-green' : 'text-gray-400'}
                ${className}`}
        >
            <span className="inline-flex items-center gap-1">
                {children}
                {onClick && <ArrowUpDown size={9} className="opacity-40" />}
            </span>
        </th>
    );

// ── Drill-down modal ─────────────────────────────────────────────────────────
const DrillDown: React.FC<{ player: Player; teams: FPLResponse['teams']; onClose: () => void }> = ({ player, teams, onClose }) => {
    const [history, setHistory] = useState<History[] | null>(null);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        fetchPlayerSummary(player.id)
            .then(s => setHistory(s.history))
            .catch(() => setHistory([]))
            .finally(() => setLoading(false));
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; };
    }, [player.id]);

    const played = history?.filter(h => h.minutes > 0) ?? [];
    const pos = player.element_type;
    const showCS = pos <= 3;

    let cumXG = 0, cumG = 0, cumXP = 0, cumPts = 0;
    const cumData = played.map(h => {
        cumXG += parseFloat(h.expected_goals || '0');
        cumG  += h.goals_scored;
        cumXP += matchXP(h, pos);
        cumPts += h.total_points;
        return { round: h.round, cumXG, cumG, cumXP, cumPts };
    });
    const maxCum = Math.max(cumXG, cumG, 1);
    const maxPts = Math.max(cumXP, cumPts, 1);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl lg:max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl relative z-10 flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <img src={getPlayerImageUrl(player.code)} alt={player.web_name}
                            onError={e => { (e.target as HTMLImageElement).src = fallbackPlayerImage; }}
                            className="w-10 h-12 object-cover object-top rounded" />
                        <div>
                            <h2 className="text-lg font-black text-white">{player.first_name} {player.second_name}</h2>
                            <p className="text-xs text-gray-400">
                                xG {player.expected_goals} → {player.goals_scored} goals &nbsp;·&nbsp;
                                xA {player.expected_assists} → {player.assists} assists
                                {showCS && ` · xGC ${player.expected_goals_conceded} · ${player.clean_sheets} CS`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-red-500/80 rounded-full transition-colors">
                        <X size={18} className="text-white" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-7">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-fpl-green" />
                        </div>
                    ) : played.length === 0 ? (
                        <p className="text-gray-400 text-center py-12">No match data available.</p>
                    ) : (<>
                        <div className="grid md:grid-cols-2 gap-5">
                            <div>
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Cumulative xG vs Goals</p>
                                <div className="flex gap-3 mb-2 text-xs text-gray-400">
                                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#02efff] inline-block rounded" />xG</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-fpl-green inline-block rounded" />Actual</span>
                                </div>
                                <div className="bg-slate-950 rounded-xl p-3 h-24 flex items-end gap-px overflow-hidden">
                                    {cumData.map((d, i) => (
                                        <div key={i} className="flex-1 flex items-end gap-px h-full" title={`GW${d.round}: xG ${fmt2(d.cumXG)} | G ${d.cumG}`}>
                                            <div className="flex-1 bg-[#02efff]/50 rounded-t-sm" style={{ height: `${(d.cumXG / maxCum) * 100}%` }} />
                                            <div className="flex-1 bg-fpl-green/70 rounded-t-sm" style={{ height: `${(d.cumG / maxCum) * 100}%` }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Cumulative xP vs Actual Points</p>
                                <div className="flex gap-3 mb-2 text-xs text-gray-400">
                                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-400 inline-block rounded" />xP</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-fpl-green inline-block rounded" />Actual</span>
                                </div>
                                <div className="bg-slate-950 rounded-xl p-3 h-24 flex items-end gap-px overflow-hidden">
                                    {cumData.map((d, i) => (
                                        <div key={i} className="flex-1 flex items-end gap-px h-full" title={`GW${d.round}: xP ${fmt1(d.cumXP)} | Pts ${d.cumPts}`}>
                                            <div className="flex-1 bg-purple-400/50 rounded-t-sm" style={{ height: `${(d.cumXP / maxPts) * 100}%` }} />
                                            <div className="flex-1 bg-fpl-green/70 rounded-t-sm" style={{ height: `${(d.cumPts / maxPts) * 100}%` }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Per Gameweek Breakdown</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm whitespace-nowrap">
                                    <thead className="bg-slate-950">
                                        <tr>
                                            <Th tooltip="Gameweek number" center={false}>GW</Th>
                                            <Th tooltip="Opponent — H = Home, A = Away" center={false}>Opp</Th>
                                            <Th tooltip="Minutes played">Mins</Th>
                                            <Th tooltip="Expected goals — quality of chances created">xG</Th>
                                            <Th tooltip="Actual goals scored">G</Th>
                                            <Th tooltip="Goals minus xG. Positive = scored more than chances suggested">G−xG</Th>
                                            <Th tooltip="Expected assists — quality of chance creation">xA</Th>
                                            <Th tooltip="Actual assists">A</Th>
                                            <Th tooltip="Assists minus xA">A−xA</Th>
                                            {showCS && <Th tooltip="Probability of a clean sheet this match, calculated as e^(−xGC) using the Poisson distribution">xCS%</Th>}
                                            {showCS && <Th tooltip="Actual clean sheet — 1 = kept, 0 = conceded">CS</Th>}
                                            <Th tooltip="Estimated FPL points: appearance pts + xG × goal pts + xA × 3 + P(CS) × CS pts. Bonus not included.">xP</Th>
                                            <Th tooltip="Actual FPL points earned this gameweek">Pts</Th>
                                            <Th tooltip="Actual points minus expected points — difference is largely bonus points and model error">Pts−xP</Th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {[...played].reverse().map(h => {
                                            const xg  = parseFloat(h.expected_goals  || '0');
                                            const xa  = parseFloat(h.expected_assists || '0');
                                            const xgc = parseFloat(h.expected_goals_conceded || '0');
                                            const xp  = matchXP(h, pos);
                                            const opp = teams.find(t => t.id === h.opponent_team);
                                            return (
                                                <tr key={h.fixture} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="p-3 text-gray-300">GW{h.round}</td>
                                                    <td className="p-3 text-gray-400">{h.was_home ? '(H)' : '(A)'} {opp?.short_name ?? h.opponent_team}</td>
                                                    <td className="p-3 text-center text-gray-400">{h.minutes}</td>
                                                    <td className="p-3 text-center text-[#02efff]">{fmt2(xg)}</td>
                                                    <td className="p-3 text-center font-bold text-white">{h.goals_scored}</td>
                                                    <td className="p-3 text-center"><DiffBadge diff={h.goals_scored - xg} /></td>
                                                    <td className="p-3 text-center text-[#02efff]">{fmt2(xa)}</td>
                                                    <td className="p-3 text-center font-bold text-white">{h.assists}</td>
                                                    <td className="p-3 text-center"><DiffBadge diff={h.assists - xa} /></td>
                                                    {showCS && <td className="p-3 text-center text-gray-300">{(pCS(xgc) * 100).toFixed(0)}%</td>}
                                                    {showCS && <td className="p-3 text-center font-bold text-white">{h.clean_sheets}</td>}
                                                    <td className="p-3 text-center text-purple-300">{fmt1(xp)}</td>
                                                    <td className="p-3 text-center font-bold text-fpl-green">{h.total_points}</td>
                                                    <td className="p-3 text-center"><DiffBadge diff={h.total_points - xp} decimals={1} /></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-xs text-gray-600 mt-2">
                                xP = appearance pts + xG×{goalPts(pos)} + xA×3{csPts(pos) > 0 ? ` + P(CS)×${csPts(pos)}` : ''}{pos === 1 ? ' + saves÷3' : ''}. Bonus points excluded.
                            </p>
                        </div>
                    </>)}
                </div>
            </div>
        </div>
    );
};

// ── Aggregate card ───────────────────────────────────────────────────────────
const AggCard: React.FC<{ label: string; tooltip: string; predicted: number; actual: number; actualLabel?: string; decimals?: number }> =
    ({ label, tooltip, predicted, actual, actualLabel = 'Actual', decimals = 1 }) => {
        const diff = actual - predicted;
        const pct = predicted > 0 ? (actual / predicted) * 100 : 0;
        return (
            <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-5" title={tooltip}>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">{label}</p>
                <div className="flex items-end gap-3 mb-3">
                    <div><div className="text-xs text-[#02efff] mb-0.5">Predicted</div><div className="text-2xl font-black text-white">{predicted.toFixed(decimals)}</div></div>
                    <div className="text-gray-600 mb-1">→</div>
                    <div><div className="text-xs text-fpl-green mb-0.5">{actualLabel}</div><div className="text-2xl font-black text-fpl-green">{actual.toFixed(decimals)}</div></div>
                </div>
                <div className="flex items-center justify-between text-xs">
                    <DiffBadge diff={diff} decimals={decimals} />
                    <span className={`font-bold ${pct > 105 ? 'text-fpl-green' : pct < 90 ? 'text-red-400' : 'text-gray-300'}`}>{fmt1(pct)}%</span>
                </div>
                <div className="mt-3 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#02efff] to-fpl-green rounded-full" style={{ width: `${Math.min(pct, 150)}%` }} />
                </div>
            </div>
        );
    };

// ── Main view ────────────────────────────────────────────────────────────────
type TabId = 'xg' | 'xp' | 'cs';

const XGLabView: React.FC<XGLabViewProps> = ({ data }) => {
    const [tab, setTab] = useState<TabId>('xg');
    const [posFilter, setPosFilter] = useState<number | null>(null);
    const [minGames, setMinGames] = useState(1);
    const [sortKey, setSortKey] = useState('xg_diff');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

    const pool = useMemo(() =>
        data.elements
            .filter(p => p.minutes / 90 >= minGames)
            .filter(p => posFilter ? p.element_type === posFilter : true),
        [data.elements, minGames, posFilter]);

    const enriched = useMemo(() => pool.map(p => {
        const est = p.minutes / 75;
        const xgc = parseFloat(p.expected_goals_conceded || '0');
        const xgcPerGame = est > 0 ? xgc / est : 0;
        const xcs = pCS(xgcPerGame) * est;
        const xp = seasonXP(p);
        return {
            ...p,
            xg:      parseFloat(p.expected_goals || '0'),
            xa:      parseFloat(p.expected_assists || '0'),
            xgi:     parseFloat(p.expected_goal_involvements || '0'),
            xgc,
            xcs,
            xp,
            xg_diff: p.goals_scored - parseFloat(p.expected_goals || '0'),
            xa_diff: p.assists - parseFloat(p.expected_assists || '0'),
            cs_diff: p.clean_sheets - xcs,
            xp_diff: p.total_points - xp,
            gc_diff: p.goals_conceded - xgc,
        };
    }).sort((a, b) => {
        const va = (a as any)[sortKey] ?? 0;
        const vb = (b as any)[sortKey] ?? 0;
        return sortDir === 'desc' ? vb - va : va - vb;
    }), [pool, sortKey, sortDir]);

    const toggleSort = (key: string) => {
        if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const agg = useMemo(() => ({
        xg:      enriched.reduce((s, p) => s + p.xg, 0),
        goals:   enriched.reduce((s, p) => s + p.goals_scored, 0),
        xa:      enriched.reduce((s, p) => s + p.xa, 0),
        assists: enriched.reduce((s, p) => s + p.assists, 0),
        xgi:     enriched.reduce((s, p) => s + p.xgi, 0),
        gi:      enriched.reduce((s, p) => s + p.goals_scored + p.assists, 0),
        xp:      enriched.reduce((s, p) => s + p.xp, 0),
        pts:     enriched.reduce((s, p) => s + p.total_points, 0),
    }), [enriched]);

    const posSummary = useMemo(() => POSITIONS.map(pos => {
        const pp = data.elements.filter(p => p.element_type === pos.id && p.minutes / 90 >= minGames);
        const xg  = pp.reduce((s, p) => s + parseFloat(p.expected_goals || '0'), 0);
        const xa  = pp.reduce((s, p) => s + parseFloat(p.expected_assists || '0'), 0);
        const xp  = pp.reduce((s, p) => s + seasonXP(p), 0);
        const xgc = pp.reduce((s, p) => s + parseFloat(p.expected_goals_conceded || '0'), 0);
        const xcs = pp.reduce((s, p) => {
            const est = p.minutes / 75;
            return s + pCS(est > 0 ? parseFloat(p.expected_goals_conceded || '0') / est : 0) * est;
        }, 0);
        return {
            ...pos,
            xg,  goals:   pp.reduce((s, p) => s + p.goals_scored, 0),
            xa,  assists: pp.reduce((s, p) => s + p.assists, 0),
            xp,  pts:     pp.reduce((s, p) => s + p.total_points, 0),
            xgc, gc:      pp.reduce((s, p) => s + p.goals_conceded, 0),
            xcs, cs:      pp.reduce((s, p) => s + p.clean_sheets, 0),
            count: pp.length,
        };
    }), [data.elements, minGames]);

    const CSPool = enriched.filter(p => p.element_type <= 3);

    const TABS: { id: TabId; label: string; tooltip: string }[] = [
        { id: 'xg', label: 'Goals & Assists', tooltip: 'Compare expected goals (xG) and expected assists (xA) against actual output' },
        { id: 'xp', label: 'Points',          tooltip: 'Compare estimated expected FPL points (xP) against actual points scored' },
        { id: 'cs', label: 'Clean Sheets',    tooltip: 'Compare expected clean sheets from Poisson model (e^−xGC) vs actual — GK, DEF, MID only' },
    ];

    const PlayerRow: React.FC<{ p: typeof enriched[0]; cols: React.ReactNode[] }> = ({ p, cols }) => (
        <tr className="hover:bg-slate-800/40 cursor-pointer transition-colors border-b border-slate-800" onClick={() => setSelectedPlayer(p)}>
            <td className="p-3">
                <div className="flex items-center gap-2">
                    <img src={getPlayerImageUrl(p.code)} alt={p.web_name}
                        onError={e => { (e.target as HTMLImageElement).src = fallbackPlayerImage; }}
                        className="w-7 h-9 object-cover object-top rounded shrink-0" />
                    <div>
                        <div className="font-bold text-white text-sm">{p.web_name}</div>
                        <div className="text-xs text-gray-500">{data.teams.find(t => t.id === p.team)?.short_name}</div>
                    </div>
                </div>
            </td>
            <td className="p-3 text-gray-400 text-xs text-center">{data.element_types.find(e => e.id === p.element_type)?.singular_name_short}</td>
            {cols.map((c, i) => <td key={i} className="p-3 text-center">{c}</td>)}
        </tr>
    );

    const TopList: React.FC<{ title: string; players: typeof enriched; positive: boolean; subtitle: (p: typeof enriched[0]) => string; diff: (p: typeof enriched[0]) => number }> =
        ({ title, players, positive, subtitle, diff }) => (
            <div className={`bg-slate-900/60 border rounded-2xl p-5 ${positive ? 'border-fpl-green/30' : 'border-red-500/20'}`}>
                <h2 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: positive ? '#00ff87' : '#f87171' }}>{title}</h2>
                <div className="space-y-2">
                    {players.map(p => (
                        <button key={p.id} onClick={() => setSelectedPlayer(p)}
                            className="w-full flex items-center gap-3 hover:bg-slate-800/50 rounded-xl p-2 transition-colors text-left">
                            <img src={getPlayerImageUrl(p.code)} alt={p.web_name}
                                onError={e => { (e.target as HTMLImageElement).src = fallbackPlayerImage; }}
                                className="w-8 h-10 object-cover object-top rounded shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-white text-sm truncate">{p.web_name}</div>
                                <div className="text-xs text-gray-400">{data.teams.find(t => t.id === p.team)?.short_name} · {subtitle(p)}</div>
                            </div>
                            <DiffBadge diff={diff(p)} />
                        </button>
                    ))}
                </div>
            </div>
        );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <FlaskConical className="text-fpl-green w-7 h-7" />
                    <h1 className="text-3xl font-black text-white">The Lab</h1>
                </div>
                <p className="text-gray-400 text-sm max-w-3xl leading-relaxed">
                    How well do FPL's official expected stats predict reality? This tool compares three key predictions against actual outcomes for every player this season:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-gray-400 max-w-3xl">
                    <li><span className="text-[#02efff] font-bold">Goals & Assists</span> — expected goals (xG) and expected assists (xA) vs actual goals and assists scored.</li>
                    <li><span className="text-purple-300 font-bold">Points</span> — estimated expected FPL points (xP), derived from xG, xA, and xGC, vs actual points earned. The gap is mostly bonus points.</li>
                    <li><span className="text-fpl-green font-bold">Clean Sheets</span> — expected clean sheet probability per appearance (e<sup>−xGC</sup> from the Poisson model) vs actual clean sheets, for GKs, DEFs, and MIDs.</li>
                </ul>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="flex gap-1 bg-slate-900 border border-slate-700 rounded-xl p-1">
                    <button onClick={() => setPosFilter(null)} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${posFilter === null ? 'bg-fpl-green text-slate-900' : 'text-gray-400 hover:text-white'}`}>All</button>
                    {POSITIONS.map(pos => (
                        <button key={pos.id} onClick={() => setPosFilter(posFilter === pos.id ? null : pos.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${posFilter === pos.id ? 'bg-fpl-green text-slate-900' : 'text-gray-400 hover:text-white'}`}>
                            {pos.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-400">
                    <span>Min games:</span>
                    <select value={minGames} onChange={e => setMinGames(Number(e.target.value))} className="bg-transparent text-white outline-none cursor-pointer">
                        {[0, 1, 3, 5, 10, 20].map(v => <option key={v} value={v} className="bg-slate-800">{v === 0 ? 'All' : `${v}+`}</option>)}
                    </select>
                </div>
                <span className="text-xs text-gray-500">{enriched.length} players</span>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800">
                {TABS.map(t => (
                    <button key={t.id} title={t.tooltip} onClick={() => setTab(t.id)}
                        className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${tab === t.id ? 'border-fpl-green text-fpl-green' : 'border-transparent text-gray-400 hover:text-white'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── GOALS & ASSISTS ──────────────────────────────────────────── */}
            {tab === 'xg' && (<>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <AggCard label="xG Accuracy" tooltip="Total expected goals vs actual goals scored" predicted={agg.xg} actual={agg.goals} actualLabel="Goals" />
                    <AggCard label="xA Accuracy" tooltip="Total expected assists vs actual assists" predicted={agg.xa} actual={agg.assists} actualLabel="Assists" />
                    <AggCard label="xGI Accuracy" tooltip="Expected goal involvements (xG+xA) vs actual (goals+assists)" predicted={agg.xgi} actual={agg.gi} actualLabel="GI" />
                </div>

                <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-5">
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">By Position</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr>
                                <Th tooltip="Player position" center={false}>Position</Th>
                                <Th tooltip="Sum of expected goals for all players in this position this season">xG</Th>
                                <Th tooltip="Actual goals scored">Goals</Th>
                                <Th tooltip="Goals minus xG — positive means scoring more than chances suggested">G−xG</Th>
                                <Th tooltip="Actual goals as % of xG — 100% = perfectly predicted">Conv %</Th>
                                <Th tooltip="Sum of expected assists">xA</Th>
                                <Th tooltip="Actual assists">Assists</Th>
                                <Th tooltip="Assists minus xA">A−xA</Th>
                            </tr></thead>
                            <tbody className="divide-y divide-slate-800">
                                {posSummary.map(pos => (
                                    <tr key={pos.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="py-3 font-bold text-white">{pos.full}</td>
                                        <td className="py-3 text-center text-[#02efff]">{fmt1(pos.xg)}</td>
                                        <td className="py-3 text-center font-bold text-white">{pos.goals}</td>
                                        <td className="py-3 text-center"><DiffBadge diff={pos.goals - pos.xg} /></td>
                                        <td className="py-3 text-center">
                                            <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${pos.xg > 0 && (pos.goals / pos.xg) > 1.05 ? 'bg-fpl-green/20 text-fpl-green' : pos.xg > 0 && (pos.goals / pos.xg) < 0.9 ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-gray-300'}`}>
                                                {pos.xg > 0 ? fmt1((pos.goals / pos.xg) * 100) : '–'}%
                                            </span>
                                        </td>
                                        <td className="py-3 text-center text-[#02efff]">{fmt1(pos.xa)}</td>
                                        <td className="py-3 text-center font-bold text-white">{pos.assists}</td>
                                        <td className="py-3 text-center"><DiffBadge diff={pos.assists - pos.xa} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                    <TopList title="Biggest Overperformers vs xG" positive={true}
                        players={[...enriched].sort((a, b) => b.xg_diff - a.xg_diff).slice(0, 5)}
                        subtitle={p => `xG ${fmt2(p.xg)} → ${p.goals_scored} goals`}
                        diff={p => p.xg_diff} />
                    <TopList title="Biggest Underperformers vs xG" positive={false}
                        players={[...enriched].sort((a, b) => a.xg_diff - b.xg_diff).slice(0, 5)}
                        subtitle={p => `xG ${fmt2(p.xg)} → ${p.goals_scored} goals`}
                        diff={p => p.xg_diff} />
                </div>

                <div className="bg-slate-900/60 border border-slate-700 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">All Players — click any row for per-GW breakdown</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm whitespace-nowrap">
                            <thead className="bg-slate-950">
                                <tr>
                                    <Th tooltip="Player name" center={false}>Player</Th>
                                    <Th tooltip="Position">Pos</Th>
                                    <Th tooltip="Season expected goals" onClick={() => toggleSort('xg')} active={sortKey === 'xg'}>xG</Th>
                                    <Th tooltip="Actual goals scored" onClick={() => toggleSort('goals_scored')} active={sortKey === 'goals_scored'}>Goals</Th>
                                    <Th tooltip="Goals minus xG — positive = scoring more than chances suggested (elite finishing or luck)" onClick={() => toggleSort('xg_diff')} active={sortKey === 'xg_diff'}>G−xG</Th>
                                    <Th tooltip="Season expected assists" onClick={() => toggleSort('xa')} active={sortKey === 'xa'}>xA</Th>
                                    <Th tooltip="Actual assists" onClick={() => toggleSort('assists')} active={sortKey === 'assists'}>A</Th>
                                    <Th tooltip="Assists minus xA" onClick={() => toggleSort('xa_diff')} active={sortKey === 'xa_diff'}>A−xA</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {enriched.map(p => (
                                    <PlayerRow key={p.id} p={p} cols={[
                                        <span className="text-[#02efff]">{fmt2(p.xg)}</span>,
                                        <span className="font-bold text-white">{p.goals_scored}</span>,
                                        <DiffBadge diff={p.xg_diff} />,
                                        <span className="text-[#02efff]">{fmt2(p.xa)}</span>,
                                        <span className="font-bold text-white">{p.assists}</span>,
                                        <DiffBadge diff={p.xa_diff} />,
                                    ]} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>)}

            {/* ── POINTS ──────────────────────────────────────────────────── */}
            {tab === 'xp' && (<>
                <div className="bg-fpl-green/5 border border-fpl-green/20 rounded-xl p-4 text-xs text-gray-400 leading-relaxed">
                    <strong className="text-fpl-green">xP formula:</strong> appearance pts (1 or 2) + xG × goal pts + xA × 3 + P(CS | xGC) × CS pts.
                    GK saves use actual saves (no "expected saves" available in the FPL API). <strong className="text-white">Bonus points are excluded</strong> from xP — they're the main reason actual points exceed xP.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AggCard label="xP vs Actual Points" tooltip="Sum of estimated expected FPL points vs actual total points — the gap is largely bonus points" predicted={agg.xp} actual={agg.pts} actualLabel="Points" decimals={0} />
                    <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-5">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Avg pts above xP per player</p>
                        <div className="text-2xl font-black text-white mb-1">{fmt1((agg.pts - agg.xp) / Math.max(enriched.length, 1))}</div>
                        <p className="text-xs text-gray-400">Mostly bonus points and model variance — shows how much the FPL scoring system rewards performance beyond raw chance quality.</p>
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-5">
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">By Position</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr>
                                <Th tooltip="Player position" center={false}>Position</Th>
                                <Th tooltip="FPL points awarded for a goal by this position">Goal pts</Th>
                                <Th tooltip="FPL bonus points for a clean sheet by this position">CS pts</Th>
                                <Th tooltip="Sum of estimated expected FPL points">Total xP</Th>
                                <Th tooltip="Actual total FPL points scored">Actual Pts</Th>
                                <Th tooltip="Actual points minus xP — positive = outperforming the model (mostly bonus points)">Pts−xP</Th>
                                <Th tooltip="Average extra points above xP per player in this position">Avg gap</Th>
                            </tr></thead>
                            <tbody className="divide-y divide-slate-800">
                                {posSummary.map(pos => (
                                    <tr key={pos.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="py-3 font-bold text-white">{pos.full}</td>
                                        <td className="py-3 text-center text-gray-300">{goalPts(pos.id)}</td>
                                        <td className="py-3 text-center text-gray-300">{csPts(pos.id)}</td>
                                        <td className="py-3 text-center text-purple-300">{fmt1(pos.xp)}</td>
                                        <td className="py-3 text-center font-bold text-fpl-green">{pos.pts}</td>
                                        <td className="py-3 text-center"><DiffBadge diff={pos.pts - pos.xp} decimals={0} /></td>
                                        <td className="py-3 text-center text-gray-400 text-xs">{pos.count > 0 ? fmt1((pos.pts - pos.xp) / pos.count) : '–'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                    <TopList title="Biggest Overperformers vs xP" positive={true}
                        players={[...enriched].sort((a, b) => b.xp_diff - a.xp_diff).slice(0, 5)}
                        subtitle={p => `xP ${fmt1(p.xp)} → ${p.total_points} pts`}
                        diff={p => p.xp_diff} />
                    <TopList title="Biggest Underperformers vs xP" positive={false}
                        players={[...enriched].sort((a, b) => a.xp_diff - b.xp_diff).slice(0, 5)}
                        subtitle={p => `xP ${fmt1(p.xp)} → ${p.total_points} pts`}
                        diff={p => p.xp_diff} />
                </div>

                <div className="bg-slate-900/60 border border-slate-700 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">All Players — click any row for per-GW breakdown</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm whitespace-nowrap">
                            <thead className="bg-slate-950">
                                <tr>
                                    <Th tooltip="Player name" center={false}>Player</Th>
                                    <Th tooltip="Position">Pos</Th>
                                    <Th tooltip="Estimated expected FPL points for the season" onClick={() => toggleSort('xp')} active={sortKey === 'xp'}>xP</Th>
                                    <Th tooltip="Actual FPL total points" onClick={() => toggleSort('total_points')} active={sortKey === 'total_points'}>Pts</Th>
                                    <Th tooltip="Actual points minus xP — positive = outperforming the model, largely via bonus points" onClick={() => toggleSort('xp_diff')} active={sortKey === 'xp_diff'}>Pts−xP</Th>
                                    <Th tooltip="Points per game average">PPG</Th>
                                    <Th tooltip="FPL's own expected points for the current gameweek" onClick={() => toggleSort('ep_this')} active={sortKey === 'ep_this'}>EP This GW</Th>
                                    <Th tooltip="FPL's own expected points for the next gameweek" onClick={() => toggleSort('ep_next')} active={sortKey === 'ep_next'}>EP Next GW</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {enriched.map(p => (
                                    <PlayerRow key={p.id} p={p} cols={[
                                        <span className="text-purple-300">{fmt1(p.xp)}</span>,
                                        <span className="font-bold text-fpl-green">{p.total_points}</span>,
                                        <DiffBadge diff={p.xp_diff} decimals={0} />,
                                        <span className="text-gray-300">{p.points_per_game}</span>,
                                        <span className="text-gray-300">{p.ep_this}</span>,
                                        <span className="text-gray-300">{p.ep_next}</span>,
                                    ]} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>)}

            {/* ── CLEAN SHEETS ────────────────────────────────────────────── */}
            {tab === 'cs' && (<>
                <div className="bg-fpl-green/5 border border-fpl-green/20 rounded-xl p-4 text-xs text-gray-400 leading-relaxed">
                    <strong className="text-fpl-green">How expected clean sheets are calculated:</strong> For each appearance, P(CS) = e<sup>−xGC</sup> using the Poisson distribution — the probability of conceding 0 goals.
                    Season xCS sums this across all appearances. GK & DEF earn 4 pts for a CS; MID earns 1 pt; FWD earns 0 (not shown here).
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <AggCard label="Expected vs Actual CS" tooltip="Total expected clean sheets (Poisson model) vs actual clean sheets — GK, DEF, MID"
                        predicted={CSPool.reduce((s, p) => s + p.xcs, 0)}
                        actual={CSPool.reduce((s, p) => s + p.clean_sheets, 0)}
                        actualLabel="CS" decimals={1} />
                    <AggCard label="xGC vs Goals Conceded" tooltip="Total expected goals conceded vs actual goals conceded"
                        predicted={CSPool.reduce((s, p) => s + p.xgc, 0)}
                        actual={CSPool.reduce((s, p) => s + p.goals_conceded, 0)}
                        actualLabel="Conceded" decimals={1} />
                    <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-5">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Clean Sheet Points</p>
                        <div className="space-y-2 mt-1">
                            {POSITIONS.map(pos => (
                                <div key={pos.id} className={`flex justify-between items-center ${csPts(pos.id) === 0 ? 'opacity-35' : ''}`}>
                                    <span className="text-gray-300 text-sm">{pos.full}</span>
                                    <span className={`font-black text-sm ${csPts(pos.id) > 0 ? 'text-fpl-green' : 'text-gray-500'}`}>{csPts(pos.id)} pts</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-5">
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">By Position</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr>
                                <Th tooltip="Player position" center={false}>Position</Th>
                                <Th tooltip="Total expected goals conceded (xGC) from the StatsBomb data via FPL API">Total xGC</Th>
                                <Th tooltip="Actual goals conceded this season">GC</Th>
                                <Th tooltip="Goals conceded minus xGC — negative means conceding fewer than expected (good defending or luck)">GC−xGC</Th>
                                <Th tooltip="Sum of P(CS) per appearance using e^(−xGC per game) — total expected clean sheets">xCS</Th>
                                <Th tooltip="Actual clean sheets kept">CS</Th>
                                <Th tooltip="Actual CS minus expected CS — positive = keeping more clean sheets than model predicts">CS−xCS</Th>
                            </tr></thead>
                            <tbody className="divide-y divide-slate-800">
                                {posSummary.filter(p => csPts(p.id) > 0).map(pos => (
                                    <tr key={pos.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="py-3 font-bold text-white">{pos.full}</td>
                                        <td className="py-3 text-center text-[#02efff]">{fmt1(pos.xgc)}</td>
                                        <td className="py-3 text-center font-bold text-white">{pos.gc}</td>
                                        <td className="py-3 text-center"><DiffBadge diff={pos.gc - pos.xgc} /></td>
                                        <td className="py-3 text-center text-purple-300">{fmt1(pos.xcs)}</td>
                                        <td className="py-3 text-center font-bold text-fpl-green">{pos.cs}</td>
                                        <td className="py-3 text-center"><DiffBadge diff={pos.cs - pos.xcs} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                    <TopList title="Most CS Above Expected" positive={true}
                        players={[...CSPool].sort((a, b) => b.cs_diff - a.cs_diff).slice(0, 5)}
                        subtitle={p => `xCS ${fmt2(p.xcs)} → ${p.clean_sheets} CS`}
                        diff={p => p.cs_diff} />
                    <TopList title="Most CS Below Expected" positive={false}
                        players={[...CSPool].sort((a, b) => a.cs_diff - b.cs_diff).slice(0, 5)}
                        subtitle={p => `xCS ${fmt2(p.xcs)} → ${p.clean_sheets} CS`}
                        diff={p => p.cs_diff} />
                </div>

                <div className="bg-slate-900/60 border border-slate-700 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">GK, DEF & MID — click any row for per-GW breakdown</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm whitespace-nowrap">
                            <thead className="bg-slate-950">
                                <tr>
                                    <Th tooltip="Player name" center={false}>Player</Th>
                                    <Th tooltip="Position">Pos</Th>
                                    <Th tooltip="Season expected goals conceded — lower means fewer chances the opposition created" onClick={() => toggleSort('xgc')} active={sortKey === 'xgc'}>xGC</Th>
                                    <Th tooltip="Actual goals conceded this season" onClick={() => toggleSort('goals_conceded')} active={sortKey === 'goals_conceded'}>GC</Th>
                                    <Th tooltip="Goals conceded minus xGC — negative = conceding fewer than the model predicted" onClick={() => toggleSort('gc_diff')} active={sortKey === 'gc_diff'}>GC−xGC</Th>
                                    <Th tooltip="Expected clean sheets — sum of P(CS) per appearance using Poisson e^(−xGC per game)" onClick={() => toggleSort('xcs')} active={sortKey === 'xcs'}>xCS</Th>
                                    <Th tooltip="Actual clean sheets kept" onClick={() => toggleSort('clean_sheets')} active={sortKey === 'clean_sheets'}>CS</Th>
                                    <Th tooltip="Clean sheets minus expected CS — positive means keeping more clean sheets than the model predicts" onClick={() => toggleSort('cs_diff')} active={sortKey === 'cs_diff'}>CS−xCS</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {CSPool.map(p => (
                                    <PlayerRow key={p.id} p={p} cols={[
                                        <span className="text-[#02efff]">{fmt2(p.xgc)}</span>,
                                        <span className="font-bold text-white">{p.goals_conceded}</span>,
                                        <DiffBadge diff={p.gc_diff} />,
                                        <span className="text-purple-300">{fmt2(p.xcs)}</span>,
                                        <span className="font-bold text-fpl-green">{p.clean_sheets}</span>,
                                        <DiffBadge diff={p.cs_diff} />,
                                    ]} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>)}

            {selectedPlayer && (
                <DrillDown player={selectedPlayer} teams={data.teams} onClose={() => setSelectedPlayer(null)} />
            )}
        </div>
    );
};

export default XGLabView;
