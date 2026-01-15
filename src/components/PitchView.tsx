import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shirt, Loader2, AlertTriangle } from 'lucide-react';
import type { FPLResponse, EntryPicksResponse, Pick } from '../types/fpl';
import { fetchEntryPicks, getPlayerImageUrl, fallbackPlayerImage } from '../services/api';

interface PitchViewProps {
    data: FPLResponse;
}

const PitchView: React.FC<PitchViewProps> = ({ data }) => {
    const [searchParams] = useSearchParams();
    const entryId = searchParams.get('entry') ? Number(searchParams.get('entry')) : null;

    // Default to current gameweek
    const currentEvent = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
    const eventId = currentEvent?.id || 1;

    const [picksData, setPicksData] = useState<EntryPicksResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadPicks = async () => {
            if (!entryId) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const picks = await fetchEntryPicks(entryId, eventId);
                setPicksData(picks);
            } catch (err) {
                setError('Failed to load team data. Check the Team ID.');
            } finally {
                setLoading(false);
            }
        };

        loadPicks();
    }, [entryId, eventId]);

    const getPlayer = (id: number) => data.elements.find(e => e.id === id);
    const getTeam = (id: number) => data.teams.find(t => t.id === id);

    if (!entryId) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                <Shirt size={48} className="mb-4 text-gray-600" />
                <p>No Team ID provided.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="w-8 h-8 text-fpl-green animate-spin" />
            </div>
        );
    }

    if (error || !picksData) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-red-400">
                <AlertTriangle size={48} className="mb-4" />
                <p>{error || 'Team not found'}</p>
            </div>
        );
    }

    // Categorize players by position for the pitch
    // 1: GKP, 2: DEF, 3: MID, 4: FWD
    const startingXI = picksData.picks.filter(p => p.position <= 11);
    const bench = picksData.picks.filter(p => p.position > 11);

    const gkp = startingXI.filter(p => getPlayer(p.element)?.element_type === 1);
    const def = startingXI.filter(p => getPlayer(p.element)?.element_type === 2);
    const mid = startingXI.filter(p => getPlayer(p.element)?.element_type === 3);
    const fwd = startingXI.filter(p => getPlayer(p.element)?.element_type === 4);

    const renderPlayer = (pick: Pick) => {
        const player = getPlayer(pick.element);
        const team = player ? getTeam(player.team) : null;

        if (!player) return null;

        return (
            <div key={pick.element} className="flex flex-col items-center justify-center p-1 md:p-2 w-20 md:w-28 animate-in zoom-in duration-300">
                <div className="relative mb-1 group cursor-pointer">
                    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden border-2 ${pick.is_captain ? 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'border-white/20'} bg-slate-900 shadow-lg relative`}>
                        <img
                            src={getPlayerImageUrl(player.code)}
                            alt={player.web_name}
                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = fallbackPlayerImage;
                            }}
                        />
                        {pick.is_captain && (
                            <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border border-slate-900">
                                C
                            </div>
                        )}
                        {pick.is_vice_captain && (
                            <div className="absolute -bottom-1 -right-1 bg-gray-400 text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border border-slate-900">
                                V
                            </div>
                        )}
                    </div>
                    {team && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center p-[2px]">
                            <img
                                src={`https://resources.premierleague.com/premierleague/badges/t${team.code}.png`}
                                alt={team.short_name}
                                className="w-full h-full object-contain"
                            />
                        </div>
                    )}
                </div>

                <div className="bg-slate-900/90 backdrop-blur-sm px-2 py-0.5 rounded text-center w-full border border-slate-700/50">
                    <p className="text-[10px] md:text-xs font-bold text-white truncate leading-tight">{player.web_name}</p>
                    <p className="text-[9px] md:text-[10px] text-fpl-green font-mono">{picksData.entry_history.points > 0 ? `${player.event_points} pts` : `${player.now_cost / 10}m`}</p>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-white">Team Selection</h2>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
                    <span className="text-gray-400 text-sm">Gameweek {eventId}</span>
                    <span className="w-px h-4 bg-slate-700"></span>
                    <span className="text-fpl-green font-bold text-sm">{picksData.entry_history.points} pts</span>
                </div>
            </div>

            {/* Pitch */}
            <div className="relative mx-auto bg-green-700 rounded-xl border-4 border-white/10 shadow-2xl overflow-hidden max-w-2xl bg-[url('https://resources.premierleague.com/premierleague/photo/2023/12/22/a894560a-0490-449e-8798-7c050a490ca9/pl-background.png')] bg-cover bg-center">
                {/* Overlay for pitch effect */}
                <div className="absolute inset-0 bg-green-900/80 backdrop-blur-[1px]"></div>

                {/* Lines */}
                <div className="absolute inset-x-4 top-4 bottom-4 border-2 border-white/20 rounded-sm pointer-events-none"></div>
                <div className="absolute top-[50%] left-4 right-4 h-px bg-white/20 pointer-events-none"></div>
                <div className="absolute top-[50%] left-[50%] w-24 h-24 -translate-x-1/2 -translate-y-1/2 border border-white/20 rounded-full pointer-events-none"></div>

                <div className="relative z-10 py-8 space-y-4 md:space-y-8 min-h-[600px] flex flex-col justify-between">
                    {/* GKP */}
                    <div className="flex justify-center">
                        {gkp.map(renderPlayer)}
                    </div>

                    {/* DEF */}
                    <div className="flex justify-center gap-4">
                        {def.map(renderPlayer)}
                    </div>

                    {/* MID */}
                    <div className="flex justify-center gap-4">
                        {mid.map(renderPlayer)}
                    </div>

                    {/* FWD */}
                    <div className="flex justify-center gap-4">
                        {fwd.map(renderPlayer)}
                    </div>
                </div>
            </div>

            {/* Bench */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 max-w-2xl mx-auto">
                <h3 className="text-xs uppercase text-gray-500 font-bold mb-4 text-center">Substitutes</h3>
                <div className="flex justify-center gap-4">
                    {bench.map(renderPlayer)}
                </div>
            </div>
        </div>
    );
};

export default PitchView;
