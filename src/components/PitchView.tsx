import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shirt, Loader2, AlertTriangle, X, Activity, Sparkles, HelpCircle, Info, ChevronLeft, ChevronRight, Search, ArrowLeftRight, Save } from 'lucide-react';
import type { FPLResponse, EntryPicksResponse, Pick, LiveStats, Entry } from '../types/fpl';
import { fetchEntryPicks, fetchLiveEvent, fetchEntry, fetchEntryHistory, fetchEntryTransfers, fetchTransferStatus } from '../services/api';


import { fetchGeminiAnalysis, generateGeminiPrompt } from '../services/gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PitchViewProps {
    data: FPLResponse;
}

const PitchView: React.FC<PitchViewProps> = ({ data }) => {
    // Helper to calculate free transfers based on history
    const calculateFreeTransfers = (history: any, entryData: Entry | null, targetGw: number): number => {
        if (!history || !history.current || history.current.length === 0) return 1;

        // FPL 24/25 Rules: 
        // - Start with 1 FT.
        // - Cap at 5 FTs.
        // - WC/FH reset FTs to 1 for the *next* GW.
        // - Joining the game gives unlimited transfers for that first GW, resets to 1 for next.

        let available = 1;

        // Get chips used map for easy lookup
        const chipsUsed: Record<number, string> = {};
        if (history.chips) {
            history.chips.forEach((c: any) => {
                chipsUsed[c.event] = c.name;
            });
        }

        const startedEvent = entryData?.started_event || 1;

        // Iterate through COMPLETED gameweek history only
        // effectively simulating the state UP TO the target gameweek.
        // We stop BEFORE processing the target gameweek itself.
        const relevantHistory = history.current.filter((gw: any) => gw.event < targetGw);

        relevantHistory.forEach((gw: any) => {
            const eventId = gw.event;
            const transfersUsed = gw.event_transfers;
            const chip = chipsUsed[eventId];

            if (eventId === 1 || eventId === startedEvent) {
                available = 1;
            } else if (chip === 'wildcard' || chip === 'freehit') {
                available = 1;
            } else {
                const remaining = Math.max(0, available - transfersUsed);
                available = Math.min(5, remaining + 1);
            }
        });

        console.log(`[PitchView] Calculated Transfers for GW${targetGw}: ${available}`);
        return available;
    };


    const [searchParams] = useSearchParams();
    const entryId = searchParams.get('entry') ? Number(searchParams.get('entry')) : null;

    // Default to current gameweek
    const currentEvent = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
    const [selectedGw, setSelectedGw] = useState<number>(currentEvent?.id || 1);

    // View State
    const [view, setView] = useState<'pitch' | 'list'>('pitch');
    const [showAnalysis, setShowAnalysis] = useState(false);

    // AI State
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiAnalysisText, setAiAnalysisText] = useState<string | null>(null);

    const [picksData, setPicksData] = useState<EntryPicksResponse | null>(null);
    const [entryData, setEntryData] = useState<Entry | null>(null);
    const [entryHistory, setEntryHistory] = useState<any | null>(null);
    const [transfers, setTransfers] = useState<any[]>([]);
    const [availableTransfers, setAvailableTransfers] = useState<number>(1); // Default to 1
    const [liveStats, setLiveStats] = useState<Record<number, LiveStats>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isReconstructed, setIsReconstructed] = useState(false);

    // Edit Team / Analysis Flow State
    const [isEditingTeam, setIsEditingTeam] = useState(false);
    const [editedPicks, setEditedPicks] = useState<EntryPicksResponse | null>(null);
    const [ghostPlayerIds, setGhostPlayerIds] = useState<number[]>([]);
    const [showPlayerPicker, setShowPlayerPicker] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');
    const [pickerPositionFilter, setPickerPositionFilter] = useState<number | null>(null);
    const [pickerTeamFilter, setPickerTeamFilter] = useState<number | null>(null);
    // const [showConfirm, setShowConfirm] = useState(false); // Unused in this flow

    // Swap Logic State
    const [swapSource, setSwapSource] = useState<Pick | null>(null);




    // Auth context for saving team
    const { user, token } = useAuth(); // Assuming useAuth exposes token, if not we need it from somewhere. 
    // Wait, AuthContext definition: interface AuthContextType { user: User | null; token: string | null; ... }
    // So logic is correct.

    const [isSaving, setIsSaving] = useState(false);
    const [savedTeamIds, setSavedTeamIds] = useState<number[]>([]);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);

    // Fetch Entry Details (Name, history, etc) - only once
    useEffect(() => {
        const fetchEntryDetails = async () => {
            if (!entryId) return;

            try {
                const [entry, history] = await Promise.all([
                    fetchEntry(entryId),
                    fetchEntryHistory(entryId)
                ]);
                setEntryData(entry);
                setEntryHistory(history);

                // Fetch Transfer Status (for available free transfers)
                try {
                    const status = await fetchTransferStatus(entryId);
                    // "limit" usually usually holds the number of free transfers available? 
                    // Actually the API response for transfers-status is confusing sometimes.
                    // But usually if public, it might just return null.
                    // If status exists, use logic.
                    // User said "it will be 1 or 2".
                    // If I can't find it, I'll default to 1.
                    // Let's assume status has 'limit' or 'next_event_transfers_limit'.
                    // If undefined, we can try to infer from history?
                    // But for now, let's trust the user implies it's fetchable.
                    // If status is null, we stick to default 1.
                    if (status && typeof status.limit === 'number') {
                        setAvailableTransfers(status.limit);
                        console.log(`[PitchView] Transfers from API: ${status.limit}`);
                    } else {
                        // Fallback: Check history for saved transfer
                        console.log("[PitchView] Transfer API failed/empty, calculating from history...");
                        // Target the NEXT event (upcoming deadline) to get current available budget
                        // If no next event (end of season), fallback to current + 1 or just current.
                        const nextEvent = data.events.find(e => e.is_next);
                        const targetGw = nextEvent ? nextEvent.id : (currentEvent?.id || 1);

                        const calculated = calculateFreeTransfers(history, entry, targetGw);
                        console.log(`[PitchView] Calculated Transfers: ${calculated}`);
                        setAvailableTransfers(calculated);
                    }
                } catch (e) {
                    console.warn("Could not fetch transfer status (likely private), calculating from history...");
                    if (history) {
                        const nextEvent = data.events.find(e => e.is_next);
                        const targetGw = nextEvent ? nextEvent.id : (currentEvent?.id || 1);
                        const calculated = calculateFreeTransfers(history, entry, targetGw);
                        console.log(`[PitchView] Calculated Transfers (Fallback): ${calculated}`);
                        setAvailableTransfers(calculated);
                    }
                }
            } catch (e) {
                console.error("Error fetching entry details:", e);
            }
        };
        fetchEntryDetails();
    }, [entryId]);

    // Check if team is already saved
    useEffect(() => {
        const checkSavedTeams = async () => {
            if (!user || !token) return;
            try {
                const res = await fetch('/api/user/teams', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const teams = await res.json();
                    // Each team has team_data JSON string. We need to parse it to get entry_id
                    // OR we can make the API return entry_id if we added it as column?
                    // We didn't add it as column in DB schema, but we inserted it into JSON.
                    // So we must parse.
                    const ids = teams.map((t: any) => {
                        try {
                            const data = JSON.parse(t.team_data);
                            return data.entry_id;
                        } catch { return null; }
                    }).filter(Boolean);
                    setSavedTeamIds(ids);
                }
            } catch (e) {
                console.error("Error checking saved teams", e);
            }
        };
        checkSavedTeams();
    }, [user, token, isSaving]); // Re-check after saving

    useEffect(() => {
        const loadPicks = async () => {
            if (!entryId) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                // Check if we are trying to load a future gameweek
                const currentGwId = data.events.find(e => e.is_current)?.id || 0;

                // 1. Fetch Basic Data
                const fetchData = async (gw: number) => {
                    try {
                        const [picks, live, trans] = await Promise.all([
                            fetchEntryPicks(entryId, gw),
                            fetchLiveEvent(gw),
                            fetchEntryTransfers(entryId)
                        ]);
                        return { picks, live, trans };
                    } catch (e: any) {
                        // If future GW returns 404, we need to handle it
                        if (gw > currentGwId) {
                            console.warn(`Picks for GW${gw} not available yet (Deadline not passed). Falling back to reconstruction.`);
                            const [prevPicks, live, trans] = await Promise.all([
                                fetchEntryPicks(entryId, currentGwId),
                                fetchLiveEvent(gw),
                                fetchEntryTransfers(entryId)
                            ]);
                            return { picks: prevPicks, live, trans, isReconstructed: true };
                        }
                        throw e;
                    }
                };

                const { picks, live, trans, isReconstructed: recon } = await fetchData(selectedGw);

                setIsReconstructed(recon || false);
                let processedPicks = { ...picks };

                // 2. Automatic Transfer Replay Logic (The "Live Sync")
                // Only applied if we are viewing a future gameweek (reconstructed)
                if (recon && trans && trans.length > 0) {
                    // We take the currentGw picks (fetched in fetchData fallback) 
                    // and apply transfers for the selectedGw.
                    const relevantTransfers = trans.filter(t => t.event === selectedGw);

                    if (relevantTransfers.length > 0) {
                        console.log(`[AutoSync] Applying ${relevantTransfers.length} pending transfers for GW${selectedGw}`);
                        const newPicks = [...processedPicks.picks];

                        relevantTransfers.forEach(t => {
                            const index = newPicks.findIndex(p => p.element === t.element_out);
                            if (index !== -1) {
                                newPicks[index] = {
                                    ...newPicks[index],
                                    element: t.element_in
                                };
                            }
                        });
                        processedPicks.picks = newPicks;
                    }
                }

                setPicksData(processedPicks);
                setTransfers(trans);

                // Map live stats by element ID
                if (live && live.elements) {
                    const stats: Record<number, LiveStats> = {};
                    live.elements.forEach((el: any) => {
                        stats[el.id] = el.stats;
                    });
                    setLiveStats(stats);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load team data.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadPicks();
    }, [entryId, selectedGw, data.events]); // Removed isLiveSync dependency

    const handlePrevGw = () => setSelectedGw(prev => Math.max(1, prev - 1));
    const handleNextGw = () => {
        const currentGwId = data.events.find(e => e.is_current)?.id || 0;
        setSelectedGw(prev => Math.min(currentGwId, prev + 1));
    };

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

    if (loading && !picksData) {
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

    const calculateTransfersMade = (original: EntryPicksResponse | null, current: EntryPicksResponse | null): number => {
        if (!original || !current) return 0;

        // Create Sets of Element IDs for O(1) lookup
        const originalIds = new Set(original.picks.map(p => p.element));
        const currentIds = current.picks.map(p => p.element);

        // Count how many current players were NOT in the original team
        // This effectively counts "In transfers"
        let transfersIn = 0;
        currentIds.forEach(id => {
            if (!originalIds.has(id)) {
                transfersIn++;
            }
        });

        console.log(`[PitchView] Transfers Made Check: ${transfersIn} new players found.`);
        return transfersIn;
    };

    const handleGeminiAnalysis = async (picksOverride?: EntryPicksResponse) => {
        const picksToUse = picksOverride || picksData;
        if (!picksToUse || !entryData) return;

        setIsAiLoading(true);
        setAiAnalysisText(null); // Clear previous results

        try {
            // Calculate accurate transfers made (New Players In)
            // If picksOverride is provided (Edit Mode), comparing against original picksData.
            // If not (View Mode), standard is 0 unless we track draft changes differently.
            // But usually this function is called with 'editedPicks' when "Unleash Wolf" is clicked.

            const transfersMade = calculateTransfersMade(picksData, picksToUse);

            // transfersAvailable = Initial Budget - Transfers Made - Open Slots (Ghost)
            // Note: Ghost slots are "Pending Transfers Out", so they consume a transfer budget slot effectively.
            // e.g. 1 FT. Sell Salah (Ghost). Net Budget = 0 (1 used).
            // e.g. 1 FT. Sell Salah, Buy Saka. Transfers Made = 1. Ghost = 0. Net Budget = 0.

            const movesMadeInDraft = ghostPlayerIds.length;
            const totalconsumed = transfersMade + movesMadeInDraft;

            const transfersLeft = Math.max(0, availableTransfers - totalconsumed);

            console.log(`[Gemini] Available: ${availableTransfers}, Made: ${transfersMade}, Ghosts: ${movesMadeInDraft} -> Remaining: ${transfersLeft}`);

            const prompt = generateGeminiPrompt(data, picksToUse, liveStats, entryData, entryHistory, transfersLeft);
            const result = await fetchGeminiAnalysis(prompt);
            setAiAnalysisText(result);
        } catch (error: any) {
            console.error("Gemini Error:", error);
            setAiAnalysisText(`Error: ${error.message || "Unknown error occurred"}`);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleSaveTeam = async () => {
        if (!user || !token || !entryData || !picksData) return;

        setIsSaving(true);
        try {
            const res = await fetch('/api/user/teams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: `${entryData.name} (GW${selectedGw})`,
                    entry_id: entryData.id,
                    team_data: {
                        manager: entryData.player_first_name + ' ' + entryData.player_last_name,
                        picks: picksData.picks
                    }
                })
            });

            if (res.ok) {
                setShowSaveSuccess(true);
                setTimeout(() => setShowSaveSuccess(false), 3000);
            } else {
                alert('Failed to save team.');
            }
        } catch (e) {
            console.error(e);
            alert('Error saving team.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAnalyze = () => {
        if (!picksData || !entryData) return;

        // Initialize Edit Mode with current picks (deep copy to avoid mutating original state)
        setEditedPicks(JSON.parse(JSON.stringify(picksData)));
        setIsEditingTeam(true);
    };

    // Actual Analysis Trigger (called after confirmation)
    const runAnalysis = async () => {
        if (!editedPicks || !entryData) return;
        setIsEditingTeam(false); // Close edit modal

        // Open Modal and Trigger AI Analysis directly with EDITED picks
        setShowAnalysis(true);
        handleGeminiAnalysis(editedPicks);
    };

    const handleRemovePlayer = (pick: Pick) => {
        setGhostPlayerIds(prev => [...prev, pick.element]);
        const player = getPlayer(pick.element);
        if (player) {
            setPickerSearch('');
            setPickerTeamFilter(null);
            setPickerPositionFilter(null);
            setShowPlayerPicker(true);
        }
    };



    const handleRestorePlayer = (pick: Pick) => {
        setGhostPlayerIds(prev => prev.filter(id => id !== pick.element));
        setShowPlayerPicker(false); // Close sidebar when restoring
    };

    const handleSelectPlayer = (player: any) => {
        if (!editedPicks || ghostPlayerIds.length === 0) return;

        const newPicks = { ...editedPicks };
        // Smart Replace Logic:
        // Find a ghost slot that matches the new player's element_type (Position)
        // If multiple matches, take the first.
        // If no match, take the first available ghost.

        let ghostIdToReplace = ghostPlayerIds.find(gid => {
            const gp = getPlayer(gid);
            return gp?.element_type === player.element_type;
        });

        if (!ghostIdToReplace) {
            // Fallback: Just take the first one (changes formation effectively)
            ghostIdToReplace = ghostPlayerIds[0];
        }

        const pickIndex = newPicks.picks.findIndex(p => p.element === ghostIdToReplace);

        if (pickIndex !== -1) {
            newPicks.picks[pickIndex] = {
                ...newPicks.picks[pickIndex],
                element: player.id
            };
            setEditedPicks(newPicks);
            // Remove the used ghost ID from the list
            setGhostPlayerIds(prev => prev.filter(id => id !== ghostIdToReplace));
        }

        // Only close picker if no more ghosts? Or user can keep picking?
        // "select 2 players to replace" implies continuous picking.
        if (ghostPlayerIds.length <= 1) { // We just used one, so check length-1? Actually we filtered already.
            // If we just removed the last one, close.
            // Wait, state update is async.
            // Let's simplified close for now.
            setShowPlayerPicker(false);
        }
    };

    // --- SWAP LOGIC ---
    const handleSwap = (targetPick: Pick) => {
        if (!swapSource || !editedPicks) return;

        // If target is same as source, cancel swap
        if (targetPick.element === swapSource.element) {
            setSwapSource(null);
            return;
        }

        const newPicks = { ...editedPicks };
        const sourceIndex = newPicks.picks.findIndex(p => p.element === swapSource.element);
        const targetIndex = newPicks.picks.findIndex(p => p.element === targetPick.element);

        if (sourceIndex !== -1 && targetIndex !== -1) {
            // Swap Elements (ID, Multiplier, Captaincy? No, usually just element moves)
            // Actually, in FPL "Substitutions", the position/role (Captain) stays with the SLOT if you change formation?
            // But if you swap Pitch-Pitch, attributes might move.
            // Let's do a simple element ID swap first, preserving other slot attributes (like captaincy) if desirable?
            // Standard FPL behavior: Direct swap of players. Attributes (C/V) stay with player if possible? 
            // Actually, if I swap Salah (C) to bench, does he stay Captain? No.

            // SIMPLIFIED SWAP: Just swap the element IDs.
            const sourceElement = newPicks.picks[sourceIndex].element;
            const targetElement = newPicks.picks[targetIndex].element;

            newPicks.picks[sourceIndex] = { ...newPicks.picks[sourceIndex], element: targetElement };
            newPicks.picks[targetIndex] = { ...newPicks.picks[targetIndex], element: sourceElement };

            setEditedPicks(newPicks);
        }
        setSwapSource(null);
    };


    const renderPlayerPicker = () => {
        if (!showPlayerPicker) return null;

        const filteredPlayers = data.elements.filter(p => {
            // Filter by position (mandatory)
            if (pickerPositionFilter && p.element_type !== pickerPositionFilter) return false;
            // Filter by Team
            if (pickerTeamFilter && p.team !== pickerTeamFilter) return false;
            // Filter by Search
            if (pickerSearch) {
                const searchLower = pickerSearch.toLowerCase();
                return (
                    p.web_name.toLowerCase().includes(searchLower) ||
                    p.first_name.toLowerCase().includes(searchLower) ||
                    p.second_name.toLowerCase().includes(searchLower)
                );
            }
            return true;
        }).sort((a, b) => b.total_points - a.total_points); // Sort by points by default

        return (
            <div className="w-80 h-[800px] shrink-0 bg-[#220025] border-r border-white/10 shadow-2xl z-30 flex flex-col animate-in slide-in-from-left duration-300 rounded-xl overflow-hidden mr-4">
                <div className="p-4 border-b border-white/10 bg-[#37003c]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-bold uppercase tracking-wider">Select Player</h3>
                        <div className="flex items-center gap-2">
                            {ghostPlayerIds.length > 0 && <span className="text-xs text-[#00ff87] font-bold">{ghostPlayerIds.length} Slot{ghostPlayerIds.length > 1 ? 's' : ''} Open</span>}
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                            <input
                                type="text"
                                placeholder="Search Name..."
                                value={pickerSearch}
                                onChange={(e) => setPickerSearch(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-[#00ff87]"
                            />
                        </div>
                        <select
                            value={pickerTeamFilter || ''}
                            onChange={(e) => setPickerTeamFilter(e.target.value ? Number(e.target.value) : null)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-[#00ff87]"
                        >
                            <option value="" className="text-gray-900">All Teams</option>
                            {data.teams.map(t => (
                                <option key={t.id} value={t.id} className="text-gray-900">{t.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Position Filters */}
                    <div className="flex gap-1 justify-between pt-1">
                        {[null, 1, 2, 3, 4].map((pos) => {
                            const label = pos === 1 ? 'GKP' : pos === 2 ? 'DEF' : pos === 3 ? 'MID' : pos === 4 ? 'FWD' : 'ALL';
                            const isActive = pickerPositionFilter === pos;
                            return (
                                <button
                                    key={pos || 'all'}
                                    onClick={() => setPickerPositionFilter(pos as number | null)}
                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-colors border ${isActive ? 'bg-[#00ff87] text-[#37003c] border-[#00ff87]' : 'bg-transparent text-white/60 border-white/10 hover:border-white/30 hover:text-white'}`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredPlayers.slice(0, 50).map(player => {
                        const team = getTeam(player.team);
                        const isOwned = editedPicks?.picks.some(p => p.element === player.id);

                        return (
                            <button
                                key={player.id}
                                onClick={() => !isOwned && handleSelectPlayer(player)}
                                disabled={isOwned}
                                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${isOwned ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer'}`}
                            >
                                <img
                                    src={`https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${team?.code}-66.png`}
                                    alt={team?.name}
                                    className="w-8 h-8 object-contain"
                                />
                                <div className="text-left flex-1">
                                    <div className="text-white font-bold text-sm leading-tight">{player.web_name}</div>
                                    <div className="text-white/50 text-xs">{team?.short_name} • £{(player.now_cost / 10).toFixed(1)}m</div>
                                </div>
                                <div className="text-[#00ff87] font-bold text-sm">{player.total_points}</div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Categorize players by position for the pitch
    // 1: GKP, 2: DEF, 3: MID, 4: FWD
    const activePicks = (isEditingTeam && editedPicks) ? editedPicks : picksData;
    const startingXI = activePicks?.picks.filter(p => p.position <= 11) || [];
    const bench = activePicks?.picks.filter(p => p.position > 11) || [];

    const gkp = startingXI.filter(p => getPlayer(p.element)?.element_type === 1);
    const def = startingXI.filter(p => getPlayer(p.element)?.element_type === 2);
    const mid = startingXI.filter(p => getPlayer(p.element)?.element_type === 3);
    const fwd = startingXI.filter(p => getPlayer(p.element)?.element_type === 4);

    const renderPlayer = (pick: Pick) => {
        const player = getPlayer(pick.element);
        const team = player ? getTeam(player.team) : null;
        // points based on the selected gameweek (0 for future/projected)
        const points = isReconstructed ? 0 : (liveStats[pick.element]?.total_points ?? player?.event_points ?? 0);
        const isNew = isReconstructed && transfers.some(t => t.element_in === pick.element && t.event === selectedGw);
        const isOut = isReconstructed && transfers.some(t => t.element_out === pick.element && t.event === selectedGw);

        // Edit Mode Logic
        const isGhost = ghostPlayerIds.includes(pick.element);
        // Only show remove button if in edit mode, not a ghost, and we're not running analysis (picker constraint removed)
        const showRemove = isEditingTeam && !isGhost && !isAiLoading;

        if (!player || !team) return null;

        return (
            <div
                key={pick.element}
                className={`flex flex-col items-center justify-center w-[72px] sm:w-24 md:w-30 lg:w-32 animate-in zoom-in duration-300 group cursor-pointer perspective-[500px] relative transition-all ${isGhost ? 'z-10' : 'z-20 hover:z-[60]'}`}
                onClick={() => {
                    if (isEditingTeam) {
                        if (isGhost) {
                            handleRemovePlayer(pick); // Click ghost to re-open picker 
                            if (!showPlayerPicker) setShowPlayerPicker(true);
                        } else if (swapSource) {
                            // If Swap Mode active, clicking any player triggers swap
                            handleSwap(pick);
                        }
                    }
                }}
            >
                {/* Remove Button (Edit Mode) */}
                {showRemove && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleRemovePlayer(pick); }}
                        className="absolute -top-2 -right-2 z-[100] bg-red-500 text-white rounded-full p-1.5 md:p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 scale-0 group-hover:scale-100 duration-200"
                    >
                        <X size={10} />
                    </button>
                )}

                {/* Restore Button (Ghost Mode) */}
                {isEditingTeam && isGhost && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleRestorePlayer(pick); }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-blue-500 text-white rounded-full p-2 hover:bg-blue-400 transition-colors shadow-lg animate-in zoom-in"
                        title="Restore Player"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                    </button>
                )}

                {/* Swap Icon (Edit Mode - Hover) */}
                {isEditingTeam && !isGhost && !swapSource && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setSwapSource(pick); }}
                        className="absolute -top-1 -left-1 z-[70] bg-[#37003c] text-[#00ff87] rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all scale-0 group-hover:scale-100 duration-200 border border-[#00ff87] shadow-lg hover:scale-110"
                        title="Swap Position"
                    >
                        <ArrowLeftRight size={12} />
                    </button>
                )}

                {/* Cancel Swap Button (Active Swap Source) */}
                {isEditingTeam && swapSource?.element === pick.element && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setSwapSource(null); }}
                        className="absolute -top-2 -left-2 z-[80] bg-yellow-400 text-black rounded-full p-1 shadow-lg animate-bounce"
                        title="Cancel Swap"
                    >
                        <X size={12} />
                    </button>
                )}


                {/* Player Content Wrapper - Applies Ghost Styles */}
                <div className={`flex flex-col items-center w-full transition-all duration-300 
                    ${isGhost ? 'opacity-40 grayscale blur-[1px] scale-95' : 'group-hover:scale-110'}
                    ${swapSource?.element === pick.element ? 'ring-2 ring-yellow-400 rounded-lg scale-110 z-50 shadow-[0_0_20px_rgba(250,204,21,0.5)]' : ''}
                    ${swapSource && swapSource.element !== pick.element ? 'cursor-alias opacity-80 hover:opacity-100 hover:ring-2 hover:ring-[#00ff87] hover:scale-105 rounded-lg' : ''}
                `}>

                    {/* Click Ghost Icon (Edit Mode) - Only if restore button isn't handling it */}
                    {/* Removing the old ghost icon overlay to prioritize restore button */}

                    <div className={`relative mb-1 transition-transform duration-300 transform ${pick.is_captain || pick.is_vice_captain ? 'scale-110' : ''} z-20`} style={{ transformStyle: 'preserve-3d' }}>
                        <img
                            src={`https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${team.code}${player.element_type === 1 ? '_1' : ''}-66.png`}
                            alt={team.name}
                            className="w-10 sm:w-12 md:w-14 lg:w-16 object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.3)] relative z-10"
                        />

                        {isNew && !isEditingTeam && (
                            <div className="absolute -top-1 -left-2 bg-[#00ff87] text-[#37003c] text-[8px] md:text-[9px] font-black px-1.5 py-0.5 rounded-sm shadow-lg z-30 animate-bounce">
                                NEW
                            </div>
                        )}
                        {isOut && !isEditingTeam && (
                            <div className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] md:text-[9px] font-black px-1.5 py-0.5 rounded-sm shadow-lg z-30 opacity-80">
                                OUT
                            </div>
                        )}

                        {/* Captain/Vice-Captain Badge - Higher Z-Index */}
                        {pick.is_captain && (
                            <div className="absolute -bottom-1 -right-2 bg-slate-900 text-white text-[8px] md:text-[9px] font-bold w-3.5 md:w-4 flex items-center justify-center rounded-full border border-white z-30 shadow-md">
                                C
                            </div>
                        )}
                        {pick.is_vice_captain && (
                            <div className="absolute -bottom-1 -right-2 bg-slate-900 text-white text-[8px] md:text-[9px] font-bold w-3.5 md:w-4 flex items-center justify-center rounded-full border border-white z-30 shadow-md">
                                V
                            </div>
                        )}
                    </div>

                    {/* Info Card - Styled to match reference exactly */}
                    <div className="flex flex-col w-full max-w-[75px] sm:max-w-[90px] md:max-w-[110px] shadow-lg relative z-10">
                        {/* Name Box (White) */}
                        <div className="bg-white text-slate-900 rounded-t-[3px] text-center w-full h-[16px] sm:h-[18px] md:h-[20px] flex items-center justify-center">
                            <p className="text-[11px] sm:text-xs md:text-[13px] font-bold truncate leading-none px-1">{player.web_name}</p>
                        </div>
                        {/* Points Box (Dark) */}
                        <div className="bg-[#37003c] text-white rounded-b-[3px] text-center w-full border-t border-slate-200/20 h-[18px] sm:h-[20px] md:h-[22px] flex items-center justify-center">
                            <p className="text-[12px] sm:text-[13px] md:text-base font-bold leading-none">
                                {isEditingTeam ? `£${(player.now_cost / 10).toFixed(1)}m` : (points > 0 ? points : '-')}
                            </p>
                        </div>
                    </div>
                </div> {/* End of Player Content Wrapper */}
            </div >
        );
    };

    const renderListView = () => {
        if (!picksData) return null;

        const allPicks = picksData.picks;
        const gks = allPicks.filter(p => getPlayer(p.element)?.element_type === 1);
        const defs = allPicks.filter(p => getPlayer(p.element)?.element_type === 2);
        const mids = allPicks.filter(p => getPlayer(p.element)?.element_type === 3);
        const fwds = allPicks.filter(p => getPlayer(p.element)?.element_type === 4);

        const groups = [
            { title: 'Goalkeeper', players: gks },
            { title: 'Defenders', players: defs },
            { title: 'Midfielders', players: mids },
            { title: 'Forwards', players: fwds },
        ];

        const headerTooltips: Record<string, string> = {
            Pts: "Points scored in this gameweek",
            MP: "Minutes played",
            GS: "Goals scored",
            A: "Assists",
            CS: "Conceded 0 goals (60+ mins for DEF/GKP)",
            GC: "Goals conceded",
            OG: "Goals scored",
            PS: "Penalties saved",
            PM: "Penalties missed",
            YC: "Yellow cards",
            RC: "Red cards",
            S: "Saves",
            B: "Bonus points"
        };

        const renderHeader = (label: string) => {
            const tooltip = headerTooltips[label];
            return (
                <div className="group relative flex justify-center cursor-help">
                    <span className="border-b border-white/10 border-dotted transition-colors group-hover:border-white/40 group-hover:text-white leading-none pb-0.5">{label}</span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-40 p-3 bg-slate-900 border border-white/20 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95 z-50 text-[11px] leading-snug text-white/90 font-medium normal-case text-center">
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-white/20 rotate-45"></div>
                        {tooltip}
                    </div>
                </div>
            );
        };

        return (
            <div className="max-w-4xl mx-auto px-4 md:px-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* View Toggle (List View) */}
                <div className="flex justify-end mb-4">
                    <div className="flex bg-[#37003c]/50 backdrop-blur-sm rounded-lg p-1 gap-1 border border-white/10">
                        <button
                            onClick={() => setView('pitch')}
                            className="px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all text-white/40 hover:text-white"
                        >
                            Pitch View
                        </button>
                        <button
                            onClick={() => setView('list')}
                            className="px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all bg-[#37003c] text-white shadow-lg"
                        >
                            List View
                        </button>
                    </div>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-[3fr,repeat(13,1fr)] gap-0 text-center text-xs md:text-sm text-white/40 font-black uppercase border-b border-white/10 pb-2 mb-4">
                    <div className="text-left pl-2">Player</div>
                    <div>{renderHeader('Pts')}</div>
                    <div>{renderHeader('MP')}</div>
                    <div>{renderHeader('GS')}</div>
                    <div>{renderHeader('A')}</div>
                    <div>{renderHeader('CS')}</div>
                    <div>{renderHeader('GC')}</div>
                    <div>{renderHeader('OG')}</div>
                    <div>{renderHeader('PS')}</div>
                    <div>{renderHeader('PM')}</div>
                    <div>{renderHeader('YC')}</div>
                    <div>{renderHeader('RC')}</div>
                    <div>{renderHeader('S')}</div>
                    <div>{renderHeader('B')}</div>
                </div>

                {groups.map((group) => (
                    <div key={group.title} className="mb-6">
                        <h3 className="text-white font-bold text-sm mb-2 pl-2 border-l-4 border-[#00ff87]">{group.title}</h3>
                        <div className="space-y-1">
                            {group.players.map((pick) => {
                                const player = getPlayer(pick.element);
                                const team = player ? getTeam(player.team) : null;
                                const stats = liveStats[pick.element];
                                const isSub = pick.position > 11;

                                if (!player || !team) return null;

                                return (
                                    <div key={pick.element} className={`grid grid-cols-[3fr,repeat(13,1fr)] gap-0 items-center py-3 text-center text-sm md:text-base border-b border-white/5 hover:bg-white/5 transition-colors ${isSub ? 'opacity-70' : ''}`}>
                                        {/* Player Info */}
                                        <div className="flex items-center gap-3 text-left pl-2 relative">
                                            {isSub && <span className="absolute -left-2 text-[10px] text-yellow-400 rotate-90 origin-right">SUB</span>}
                                            <div className="relative">
                                                <img
                                                    src={`https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${team.code}-66.png`}
                                                    alt={team.name}
                                                    className="w-8 h-8 object-contain"
                                                />
                                                {pick.is_captain && <div className="absolute -bottom-1 -right-1 bg-white text-black text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full">C</div>}
                                                {pick.is_vice_captain && <div className="absolute -bottom-1 -right-1 bg-white text-black text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full">V</div>}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className="font-bold text-white text-base leading-tight">{player.web_name}</div>
                                                    {isReconstructed && transfers.some(t => t.element_in === pick.element && t.event === selectedGw) && (
                                                        <span className="text-[8px] font-black bg-[#00ff87] text-[#37003c] px-1 rounded-sm">NEW</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] md:text-[11px] text-white/50 leading-none mt-0.5">{team.name} <span className="uppercase mx-1">{['', 'GKP', 'DEF', 'MID', 'FWD'][player.element_type]}</span></div>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="font-bold text-white text-lg leading-none">{stats?.total_points ?? 0}</div>
                                        <div className="leading-none">{stats?.minutes ?? 0}</div>
                                        <div className={`leading-none ${stats?.goals_scored ? 'text-[#00ff87] font-bold' : ''}`}>{stats?.goals_scored ?? 0}</div>
                                        <div className={`leading-none ${stats?.assists ? 'text-[#00ff87] font-bold' : ''}`}>{stats?.assists ?? 0}</div>
                                        <div className={`leading-none ${stats?.clean_sheets ? 'text-[#00ff87] font-bold' : ''}`}>{stats?.clean_sheets ?? 0}</div>
                                        <div className="leading-none">{stats?.goals_conceded ?? 0}</div>
                                        <div className={`leading-none ${stats?.own_goals ? 'text-red-400 font-bold' : ''}`}>{stats?.own_goals ?? 0}</div>
                                        <div className="leading-none">{stats?.penalties_saved ?? 0}</div>
                                        <div className={`leading-none ${stats?.penalties_missed ? 'text-red-400 font-bold' : ''}`}>{stats?.penalties_missed ?? 0}</div>
                                        <div className={`leading-none ${stats?.yellow_cards ? 'text-yellow-400 font-bold' : ''}`}>{stats?.yellow_cards ?? 0}</div>
                                        <div className={`leading-none ${stats?.red_cards ? 'text-red-500 font-bold' : ''}`}>{stats?.red_cards ?? 0}</div>
                                        <div className="leading-none">{stats?.saves ?? 0}</div>
                                        <div className={`leading-none ${stats?.bonus ? 'text-[#02efff] font-bold' : ''}`}>{stats?.bonus ?? 0}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };



    const renderAnalysisModal = () => {
        if (!showAnalysis) return null;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAnalysis(false)}></div>
                <div className="relative bg-[#220025] w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-[#37003c] p-6 border-b border-white/10 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#00ff87] p-2 rounded-lg">
                                <Activity className="text-[#37003c]" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight">THE WOLF'S DIAGNOSIS</h2>
                                <p className="text-[#00ff87] text-xs font-bold uppercase tracking-widest">Alpha Wolf Mode</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setShowAnalysis(false)} className="text-white/50 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 md:p-8 space-y-8">
                        {/* Glossary Hook */}
                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <Info className="text-blue-400 shrink-0 mt-0.5" size={20} />
                            <div className="space-y-1">
                                <p className="text-blue-200 text-sm font-bold">First Time? Decode the Hunt</p>
                                <p className="text-blue-200/60 text-xs leading-relaxed">
                                    Hover over <HelpCircle size={12} className="inline mb-0.5" /> icons to translate FPL analytics. Learn about EO, xGI, and Strategy below.
                                </p>
                            </div>
                        </div>

                        {/* Mode Toggle */}
                        {/* Mode Toggle - REMOVED (Direct AI Mode) */}
                        {/* 
                        <div className="flex justify-center mb-6">
                           ...old tabs...
                        </div>
                        */}

                        {/* Gemini Loading / Result */}
                        {isAiLoading && (
                            <div className="flex flex-col items-center justify-center py-12 text-[#02efff] gap-4">
                                <Loader2 className="animate-spin w-8 h-8" />
                                <span className="text-sm font-bold uppercase tracking-widest animate-pulse">Summoning the Wolf...</span>
                            </div>
                        )}

                        {/* Gemini Content */}
                        {aiAnalysisText && !isAiLoading && (
                            <div className="bg-white/5 p-6 md:p-8 rounded-xl border border-white/10 overflow-hidden">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        h1: ({ node, ...props }: any) => <h1 className="text-2xl font-black text-[#02efff] mb-4 uppercase tracking-tight border-b border-white/10 pb-2" {...props} />,
                                        h2: ({ node, ...props }: any) => <h2 className="text-xl font-bold text-[#00ff87] mt-6 mb-3 uppercase tracking-wide" {...props} />,
                                        h3: ({ node, ...props }: any) => <h3 className="text-lg font-bold text-white mt-4 mb-2" {...props} />,
                                        p: ({ node, ...props }: any) => <p className="text-white/80 text-sm leading-relaxed mb-4" {...props} />,
                                        ul: ({ node, ...props }: any) => <ul className="list-disc list-inside space-y-2 mb-4 text-white/80 text-sm" {...props} />,
                                        ol: ({ node, ...props }: any) => <ol className="list-decimal list-inside space-y-2 mb-4 text-white/80 text-sm" {...props} />,
                                        li: ({ node, ...props }: any) => <li className="pl-2" {...props} />,
                                        strong: ({ node, ...props }: any) => <strong className="text-[#02efff] font-bold" {...props} />,
                                        table: ({ node, ...props }: any) => <div className="overflow-x-auto mb-6 rounded-lg border border-white/10"><table className="min-w-full divide-y divide-white/10 text-sm" {...props} /></div>,
                                        thead: ({ node, ...props }: any) => <thead className="bg-white/10" {...props} />,
                                        th: ({ node, ...props }: any) => <th className="px-4 py-3 text-left text-xs font-black text-[#00ff87] uppercase tracking-wider" {...props} />,
                                        td: ({ node, ...props }: any) => <td className="px-4 py-3 text-white/80 whitespace-normal break-words border-t border-white/5" {...props} />,
                                        blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-[#02efff] pl-4 italic text-white/60 my-4" {...props} />,
                                    }}
                                >
                                    {aiAnalysisText}
                                </ReactMarkdown>
                            </div>
                        )}

                        {/* Local Analysis Content (Default) */}
                        {/* Gemini Content - Always shown when available */}
                        {aiAnalysisText && !isAiLoading && (
                            <div className="bg-white/5 p-6 md:p-8 rounded-xl border border-white/10 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        h1: ({ node, ...props }: any) => <h1 className="text-2xl font-black text-[#02efff] mb-4 uppercase tracking-tight border-b border-white/10 pb-2" {...props} />,
                                        h2: ({ node, ...props }: any) => <h2 className="text-xl font-bold text-[#00ff87] mt-6 mb-3 uppercase tracking-wide" {...props} />,
                                        h3: ({ node, ...props }: any) => <h3 className="text-lg font-bold text-white mt-4 mb-2" {...props} />,
                                        p: ({ node, ...props }: any) => <p className="text-white/80 text-sm leading-relaxed mb-4" {...props} />,
                                        ul: ({ node, ...props }: any) => <ul className="list-disc list-inside space-y-2 mb-4 text-white/80 text-sm" {...props} />,
                                        ol: ({ node, ...props }: any) => <ol className="list-decimal list-inside space-y-2 mb-4 text-white/80 text-sm" {...props} />,
                                        li: ({ node, ...props }: any) => <li className="pl-2" {...props} />,
                                        strong: ({ node, ...props }: any) => <strong className="text-[#02efff] font-bold" {...props} />,
                                        table: ({ node, ...props }: any) => <div className="overflow-x-auto mb-6 rounded-lg border border-white/10"><table className="min-w-full divide-y divide-white/10 text-sm" {...props} /></div>,
                                        thead: ({ node, ...props }: any) => <thead className="bg-white/10" {...props} />,
                                        th: ({ node, ...props }: any) => <th className="px-4 py-3 text-left text-xs font-black text-[#00ff87] uppercase tracking-wider" {...props} />,
                                        td: ({ node, ...props }: any) => <td className="px-4 py-3 text-white/80 whitespace-normal break-words border-t border-white/5" {...props} />,
                                        blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-[#02efff] pl-4 italic text-white/60 my-4" {...props} />,
                                    }}
                                >
                                    {aiAnalysisText}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 pt-4 select-none">
            {/* Top Row: Team Name */}
            <div className="max-w-4xl mx-auto px-4 md:px-0 mb-2">
                <h2 className="text-xl md:text-3xl font-black text-white tracking-tight text-center md:text-left">{entryData?.name || 'My Team'}</h2>
            </div>

            {/* Gameweek Nav Row */}
            <div className="max-w-4xl mx-auto flex items-center justify-center gap-6 relative">
                {/* Save Team Button (Top Left) */}
                {!isEditingTeam && entryData && !savedTeamIds.includes(entryData.id) && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 group">
                        <button
                            onClick={user ? handleSaveTeam : undefined}
                            disabled={isSaving || !user}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg 
                                ${user
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                                    : 'bg-slate-800 text-gray-500 cursor-not-allowed border border-slate-700'
                                }`}
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            <span className="hidden md:inline">Save to My Teams</span>
                        </button>

                        {/* Tooltip for non-logged in users */}
                        {!user && (
                            <div className="absolute top-full left-0 mt-2 w-48 p-2 bg-slate-900 border border-white/20 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-50 text-[10px] text-white font-medium text-center">
                                Log in to save to My Teams
                            </div>
                        )}
                    </div>
                )}

                {/* Success Toast */}
                {showSaveSuccess && (
                    <div className="absolute left-0 -top-12 animate-in fade-in slide-in-from-bottom-2 duration-300 z-50">
                        <div className="bg-[#00ff87] text-[#37003c] px-4 py-2 rounded-lg font-bold text-sm shadow-[0_0_20px_rgba(0,255,135,0.4)] flex items-center gap-2 border-2 border-white">
                            <Save size={16} />
                            Team Saved!
                        </div>
                    </div>
                )}

                {!isEditingTeam && (
                    <button
                        onClick={handlePrevGw}
                        disabled={loading || selectedGw <= 1}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-[#37003c]/50 hover:bg-[#4d0c54] transition-colors text-white disabled:opacity-30 border border-white/10"
                    >
                        <ChevronLeft size={16} />
                    </button>
                )}
                <div className="flex flex-col items-center">
                    <h3 className="text-2xl font-black text-white italic tracking-tight">{loading ? 'Loading...' : `Gameweek ${selectedGw}`}</h3>
                    {isReconstructed && (
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="bg-[#02efff] text-[#37003c] text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-tighter">Projected Lineup</span>
                            <div className="group relative">
                                <HelpCircle size={10} className="text-white/40 cursor-help hover:text-white transition-colors" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 border border-white/20 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-50 text-[9px] leading-tight text-white/90 font-medium text-center">
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-white/20 rotate-45"></div>
                                    Official data for GW{selectedGw} isn't available until the deadline. Using GW{selectedGw - 1} data as a base.
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {!isEditingTeam && (
                    <button
                        onClick={handleNextGw}
                        disabled={loading || selectedGw >= (data.events.find(e => e.is_current)?.id || 0) + 1}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-[#37003c]/50 hover:bg-[#4d0c54] transition-colors text-white disabled:opacity-30 border border-white/10"
                    >
                        <ChevronRight size={16} />
                    </button>
                )}
            </div>



            {/* Unified Stats Dashboard */}
            <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-y-6 gap-x-2 md:gap-4 items-end px-2 md:px-0">
                <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-xl border border-white/10 group hover:border-[#00ff87]/30 transition-all hover:bg-[#00ff87]/5">
                    <div className="text-white/40 text-[10px] uppercase font-black tracking-widest mb-1 group-hover:text-[#00ff87]/60 transition-colors">Average Points</div>
                    <div className="text-white font-black text-2xl italic tracking-tighter group-hover:scale-110 transition-transform">
                        {isReconstructed ? '-' : (data.events.find(e => e.id === selectedGw)?.average_entry_score || '-')}
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-xl border border-white/10 group hover:border-[#00ff87]/30 transition-all hover:bg-[#00ff87]/5">
                    <div className="text-white/40 text-[10px] uppercase font-black tracking-widest mb-1 group-hover:text-[#00ff87]/60 transition-colors">Highest Points →</div>
                    <div className="text-white font-black text-2xl italic tracking-tighter group-hover:scale-110 transition-transform">
                        {isReconstructed ? '-' : (data.events.find(e => e.id === selectedGw)?.highest_score || '-')}
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center p-6 bg-[#00ff87] rounded-xl border-4 border-[#00ff87] shadow-[0_0_30px_rgba(0,255,135,0.2)] transform hover:scale-105 transition-all cursor-default">
                    <div className="text-[#37003c] font-black text-5xl md:text-6xl tracking-tighter leading-none mb-1">
                        {isReconstructed ? 0 : (picksData?.entry_history?.points ?? 0)}
                    </div>
                    <div className="text-[#37003c]/60 text-[10px] uppercase font-black tracking-widest">Total Points</div>
                </div>
                <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-xl border border-white/10 group hover:border-[#02efff]/30 transition-all hover:bg-[#02efff]/5">
                    <div className="text-white font-black text-2xl italic tracking-tighter group-hover:scale-110 transition-transform">
                        {isReconstructed ? '-' : (picksData?.entry_history?.rank?.toLocaleString() || '-')}
                    </div>
                    <div className="text-white/40 text-[10px] uppercase font-black tracking-widest mt-1 group-hover:text-[#02efff]/60 transition-colors">GW Rank</div>
                </div>
                <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-xl border border-white/10 group hover:border-[#02efff]/30 transition-all hover:bg-[#02efff]/5">
                    <div className="text-white font-black text-2xl italic tracking-tighter group-hover:scale-110 transition-transform">
                        {(() => {
                            // Calculate Used Transfers in Edit Mode
                            let transfersUsed = 0;
                            if (isEditingTeam && editedPicks && picksData) {
                                // Count slots that are different OR ghosted
                                picksData.picks.forEach((originalPick, index) => {
                                    const currentPick = editedPicks.picks[index];
                                    const isGhost = ghostPlayerIds.includes(currentPick.element);
                                    const isReplaced = currentPick.element !== originalPick.element;

                                    if (isGhost || isReplaced) {
                                        transfersUsed++;
                                    }
                                });
                            }
                            // Calculate Remaining
                            // Formula: StartOfWeek - AnalysisUsed
                            return Math.max(0, availableTransfers - transfersUsed);
                        })()}
                    </div>
                    <div className="text-white/40 text-[10px] uppercase font-black tracking-widest mt-1 group-hover:text-[#02efff]/60 transition-colors">Transfers →</div>
                </div>
            </div>

            {/* TOTW Link */}
            <div className="max-w-4xl mx-auto text-center -mt-2">
                <span className="text-[10px] font-bold text-[#00ff87] uppercase tracking-widest cursor-pointer hover:underline flex items-center justify-center gap-2">
                    <Sparkles size={10} /> Team of the Week →
                </span>
            </div>

            {/* AI Diagnosis CTA - Floating below stats */}
            <div className={`max-w-4xl mx-auto px-4 md:px-0 transition-all duration-500 ${isEditingTeam ? 'sticky bottom-6 z-50' : ''}`}>
                <div
                    className={`
                        w-full relative group overflow-hidden rounded-2xl border transition-all shadow-2xl
                        ${isEditingTeam
                            ? 'bg-[#220025] border-[#00ff87]/50 p-4 md:p-6'
                            : 'bg-gradient-to-r from-[#37003c] to-[#4d0c54] border-white/10 p-4 md:p-6 hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(0,255,135,0.15)] active:scale-[0.99] cursor-pointer'
                        }
                    `}
                    onClick={() => !isEditingTeam && handleAnalyze()}
                >
                    {/* Background Effect */}
                    <div className={`absolute inset-0 transition-opacity ${isEditingTeam ? 'bg-[#00ff87]/5' : 'bg-[#00ff87]/5 opacity-0 group-hover:opacity-100'}`}></div>

                    <div className="relative flex items-center justify-between gap-4 md:gap-6">
                        <div className="flex items-center gap-4 md:gap-6 flex-1">
                            <div className={`
                                w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center border shadow-xl shrink-0 transition-colors
                                ${isEditingTeam ? 'bg-[#220025] border-[#00ff87] shadow-[0_0_15px_rgba(0,255,135,0.2)]' : 'bg-[#37003c] border-white/20 group-hover:border-[#00ff87]/50'}
                            `}>
                                <Activity className={`w-6 h-6 md:w-8 md:h-8 ${isEditingTeam ? 'text-[#00ff87] animate-pulse' : 'text-[#00ff87]'}`} />
                            </div>

                            <div className="text-left flex-1">
                                {isEditingTeam ? (
                                    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg md:text-2xl font-black text-white italic tracking-tighter uppercase leading-none mb-1 text-[#00ff87]">
                                                Analysis Mode Active
                                            </h3>

                                        </div>
                                        <p className="text-xs md:text-sm text-white font-bold tracking-wide mt-0.5 leading-tight">
                                            Update your lineup below to reflect any recent transfers, then Unleash the Wolf.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <h3 className="text-lg md:text-3xl font-black text-white italic tracking-tighter uppercase leading-none mb-1 group-hover:text-[#00ff87] transition-colors">
                                            The Wolf's Diagnosis
                                        </h3>
                                        <p className="text-[10px] md:text-xs text-white/60 font-bold uppercase tracking-[0.1em] md:tracking-[0.2em]">Alpha Strategy Analysis mode</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Button Action */}
                        <div className="shrink-0 flex items-center gap-3">
                            {/* Exit Button */}
                            {isEditingTeam && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsEditingTeam(false);
                                        setGhostPlayerIds([]);
                                        setEditedPicks(null);
                                        setShowPlayerPicker(false);
                                    }}
                                    className="w-12 h-12 md:w-[54px] md:h-[54px] flex items-center justify-center bg-[#220025] border border-white/10 rounded-xl hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 text-white/40 transition-all group/exit shadow-lg"
                                    title="Exit Analysis Mode"
                                >
                                    <X size={24} className="group-hover/exit:scale-110 transition-transform" />
                                </button>
                            )}

                            {isEditingTeam ? (
                                <button
                                    onClick={(e) => { e.stopPropagation(); runAnalysis(); }}
                                    className="px-6 py-3 md:px-8 md:py-4 bg-[#00ff87] text-[#37003c] font-black rounded-xl text-sm md:text-base uppercase flex items-center gap-2 hover:bg-[#02efff] hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,135,0.3)]"
                                >
                                    <span className="text-xl">🐺</span> Unleash Wolf
                                </button>
                            ) : (
                                <div className="hidden md:flex px-6 py-3 bg-[#00ff87] text-[#37003c] font-black rounded-lg text-sm uppercase items-center gap-2 group-hover:bg-[#02efff] transition-all">
                                    Get Analysis <Sparkles size={16} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* View Switching */}
            {view === 'list' ? (
                <div className="pt-4">{renderListView()}</div>
            ) : (
                <div className="flex items-start justify-center relative w-full">
                    {renderPlayerPicker()}
                    {/* Pitch Section Wrapper */}
                    <div className="flex-1 w-full max-w-[1500px] mx-auto transition-all duration-300">
                        {/* ... rest of pitch ... */}
                        <div className="flex justify-center pb-4 px-4 overflow-hidden">
                            <div className="relative w-full max-w-[1500px] mx-auto shadow-2xl min-h-[580px] md:min-h-0 aspect-[1417/788] md:aspect-auto">
                                {/* The Image - Absolute on mobile to fill min-height, relative on desktop */}
                                <img
                                    src="/pitch.png"
                                    className="absolute md:relative inset-0 w-full h-full md:h-auto object-cover md:object-contain block rounded-[10px]"
                                    alt="Football Pitch"
                                />

                                {/* View Toggle (Pitch View) - Absolute Top Right */}
                                <div className="absolute top-4 right-4 z-50">
                                    <div className="flex bg-[#37003c]/80 backdrop-blur-md rounded-lg p-1 gap-1 border border-white/10 shadow-xl">
                                        <button
                                            onClick={() => setView('pitch')}
                                            className="px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all bg-[#37003c] text-white shadow-lg"
                                        >
                                            Pitch View
                                        </button>
                                        <button
                                            onClick={() => setView('list')}
                                            className="px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all text-white/40 hover:text-white"
                                        >
                                            List View
                                        </button>
                                    </div>
                                </div>

                                {/* Players Layer - Absolute Row Positioning for precision on landscape pitch */}
                                <div className="absolute inset-0 z-10">
                                    {/* GKP Row - Lowest Z-Index */}
                                    <div className="absolute top-[1%] md:top-[3%] left-0 right-0 flex justify-center z-10">
                                        {gkp.map((p) => (
                                            <div key={p.element} className="transition-transform hover:scale-110 duration-300">
                                                {renderPlayer(p)}
                                            </div>
                                        ))}
                                    </div>

                                    {/* DEF Row - Higher Z-Index */}
                                    <div className="absolute top-[22%] md:top-[28%] left-0 right-0 flex justify-center gap-3 sm:gap-9 md:gap-8 z-20">
                                        {def.map((p) => (
                                            <div key={p.element} className="transition-transform hover:scale-110 duration-300">
                                                {renderPlayer(p)}
                                            </div>
                                        ))}
                                    </div>

                                    {/* MID Row - Higher Z-Index */}
                                    <div className="absolute top-[42%] md:top-[52%] left-0 right-0 flex justify-center gap-3 sm:gap-9 md:gap-8 z-30">
                                        {mid.map((p) => (
                                            <div key={p.element} className="transition-transform hover:scale-110 duration-300">
                                                {renderPlayer(p)}
                                            </div>
                                        ))}
                                    </div>

                                    {/* FWD Row - Highest Z-Index */}
                                    <div className="absolute top-[62%] md:top-[75%] left-0 right-0 flex justify-center gap-3 sm:gap-9 md:gap-8 z-40">
                                        {fwd.map((p) => (
                                            <div key={p.element} className="transition-transform hover:scale-110 duration-300">
                                                {renderPlayer(p)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* BENCH SECTION MOVED INSIDE PITCH CONTAINER WRAPPER IF NEEDED? 
                        No, Bench is below pitch. */}

                        {/* Bench Section - Floating look */}
                        <div className="relative mt-8 max-w-2xl mx-auto z-30 px-2 md:px-4">
                            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-[20px] p-3 md:p-6 border border-white/20 shadow-2xl">
                                <div className="flex justify-center gap-1 md:gap-8 mb-2 mt-4 md:mt-6">
                                    {bench.map((p, i) => {
                                        const player = getPlayer(p.element);
                                        const typeLabel = player?.element_type === 1 ? 'GKP' : player?.element_type === 2 ? 'DEF' : player?.element_type === 3 ? 'MID' : 'FWD';
                                        return (
                                            <div key={p.element} className="relative group">
                                                <span className="absolute -top-5 md:-top-6 left-1/2 -translate-x-1/2 text-[8px] md:text-[10px] text-white/40 font-black tracking-widest uppercase whitespace-nowrap">
                                                    {i === 0 ? 'GKP' : `${i}. ${typeLabel}`}
                                                </span>
                                                {renderPlayer(p)}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="text-center pt-2 pb-2">
                                    <h3 className="text-lg md:text-xl font-black text-white italic tracking-widest uppercase">Substitutes</h3>
                                </div>
                            </div>
                        </div>
                    </div> {/* End of Pitch/Bench Container Column */}
                </div>
            )}
            {renderAnalysisModal()}
        </div>
    );
};

export default PitchView;
