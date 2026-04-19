import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertTriangle, X, Activity, Sparkles, HelpCircle, Info, ChevronLeft, ChevronRight, Search, ArrowLeftRight, Save, Users, AlertCircle, RefreshCw, LogIn, Unlink, Tv } from 'lucide-react';
import type { FPLResponse, EntryPicksResponse, Pick, LiveStats, Entry, LeagueStandingsResponse, NewsArticle } from '../types/fpl';
import { fetchEntryPicks, fetchLiveEvent, fetchEntry, fetchEntryHistory, fetchEntryTransfers, fetchTransferStatus, fetchLeagueStandings, searchTeamsByName, fetchFixtures } from '../services/api';


import { fetchGeminiAnalysis, generateGeminiPrompt } from '../services/gemini';

let _quotesCache: { quote: string; author: string }[] | null = null;
async function getRandomQuote() {
    if (!_quotesCache) {
        try {
            const res = await fetch('/quotes.xml');
            _quotesCache = await res.json();
        } catch { _quotesCache = []; }
    }
    if (!_quotesCache?.length) return null;
    return _quotesCache[Math.floor(Math.random() * _quotesCache.length)];
}
import { LoginModal } from './LoginModal';
import { track } from '../utils/analytics';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface WolfPlan {
    transfers: { out_name: string; in_name: string; sell_price: number; buy_price: number }[];
    chip: string | null;
    captain: string;
    vice_captain: string;
    hits_taken: number;
    bank_after: number;
    bench_order: string[] | null; // web_names for bench positions 12, 13, 14 (outfield only, GK excluded)
}

interface PitchViewProps {
    data: FPLResponse;
}

const PitchView: React.FC<PitchViewProps> = ({ data }) => {
    // Auth context — must be first so user is available throughout
    const { user, token, fplEntryId, fplConnected, setFplEntryId, refreshUser } = useAuth();

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


    // Search State
    const navigate = useNavigate();
    const [teamReloadKey, setTeamReloadKey] = useState(0); // Incrementing this re-triggers the loadPicks useEffect
    const [searchMode, setSearchMode] = useState<'name' | 'team' | 'league' | 'fpl'>('name');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [teamIdInput, setTeamIdInput] = useState('');
    const [leagueId, setLeagueId] = useState('');
    const [leagueData, setLeagueData] = useState<LeagueStandingsResponse | null>(null);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [fplSaving, setFplSaving] = useState(false);
    const [fplError, setFplError] = useState<string | null>(null);
    const [fplFreeCreditToast, setFplFreeCreditToast] = useState(false);
    const [fplManualId, setFplManualId] = useState('');
    const [hoveredPickElement, setHoveredPickElement] = useState<number | null>(null);
    const [captainSaving, setCaptainSaving] = useState<'captain' | 'vice_captain' | null>(null);
    const [captainError, setCaptainError] = useState<string | null>(null);
    const [captainSuccess, setCaptainSuccess] = useState<string | null>(null);
    const [captainModalPick, setCaptainModalPick] = useState<Pick | null>(null);

    const handleNameSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.length < 2) return;

        setIsSearchLoading(true);
        setSearchError(null);
        try {
            const results = await searchTeamsByName(searchTerm);
            setSearchResults(results);
            if (results.length === 0) setSearchError('No teams found matching that name.');
        } catch (err) {
            setSearchError('Search failed. Try again.');
        } finally {
            setIsSearchLoading(false);
        }
    };

    const handleTeamSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (teamIdInput) {
            navigate(`/analyse?entry=${teamIdInput}`);
        }
    };

    const handleLeagueSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!leagueId) return;

        setIsSearchLoading(true);
        setSearchError(null);
        setLeagueData(null);

        try {
            const data = await fetchLeagueStandings(Number(leagueId));
            setLeagueData(data);
        } catch (err) {
            setSearchError('League not found. Check the ID.');
        } finally {
            setIsSearchLoading(false);
        }
    };

    const handleFplSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fplManualId) return;
        setFplError(null);
        if (token) {
            setFplSaving(true);
            try {
                const res = await fetch('/api/fpl/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ entry_id: fplManualId }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Failed');
                setFplEntryId(json.entry_id);
                track('FPL Account Linked', { entry_id: json.entry_id, free_credit_awarded: !!json.free_credit_awarded });
                if (json.free_credit_awarded) {
                    setFplFreeCreditToast(true);
                    setTimeout(() => setFplFreeCreditToast(false), 5000);
                    refreshUser().catch(() => {});
                }
            } catch (err: any) {
                setFplError(err.message);
                setFplSaving(false);
                return;
            }
            setFplSaving(false);
        }
        navigate(`/analyse?entry=${fplManualId}`);
    };

    const handleFplDisconnect = async () => {
        if (!token) return;
        await fetch('/api/fpl/disconnect', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        setFplEntryId(null);
    };

    const handleReset = () => {
        localStorage.removeItem('last_analysed_entry');
        navigate('/analyse');
        window.location.reload();
    };


    const [searchParams, setSearchParams] = useSearchParams();
    const entryId = searchParams.get('entry') ? Number(searchParams.get('entry')) : null;

    // Persistence: Redirect to last analysed entry if none provided
    useEffect(() => {
        if (!user) return;
        if (!entryId) {
            const savedId = localStorage.getItem('last_analysed_entry');
            if (savedId) {
                setSearchParams({ entry: savedId }, { replace: true });
            }
        }
    }, [entryId, setSearchParams, user]);

    // Default to current gameweek
    const currentEvent = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
    const [selectedGw, setSelectedGw] = useState<number>(currentEvent?.id || 1);

    // View State
    const [view, setView] = useState<'pitch' | 'list'>('pitch');
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showWolfConfirm, setShowWolfConfirm] = useState(false);

    // AI State
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiAnalysisText, setAiAnalysisText] = useState<string | null>(null);
    const [aiProvider, setAiProvider] = useState<string | null>(null);
    const [loadingQuote, setLoadingQuote] = useState<{ quote: string; author: string } | null>(null);
    const [quoteVisible, setQuoteVisible] = useState(true);
    const [wolfPlan, setWolfPlan] = useState<WolfPlan | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [executeResult, setExecuteResult] = useState<{ success: boolean; error?: string; skipped?: string[]; invalidPlan?: string[] } | null>(null);
    const [lastExecutedPlan, setLastExecutedPlan] = useState<{ transfers: { out_name: string; in_name: string }[]; chip: string | null } | null>(null);
    const [lastRecommendedPlan, setLastRecommendedPlan] = useState<{ transfers: { out_name: string; in_name: string }[]; chip: string | null; captain?: string } | null>(null);
    const [showFplLoginModal, setShowFplLoginModal] = useState(false);
    const [showNotConnectedWarning, setShowNotConnectedWarning] = useState(false);
    const [news, setNews] = useState<NewsArticle[]>([]);

    // Fetch News on Mount
    useEffect(() => {
        const loadNews = async () => {
            try {
                const res = await fetch('/api/news');
                if (res.ok) {
                    const data = await res.json();
                    setNews(data);
                }
            } catch (e) {
                console.error("News fetch error:", e);
            }
        };
        loadNews();
    }, []);


    const [picksData, setPicksData] = useState<EntryPicksResponse | null>(null);
    const [entryData, setEntryData] = useState<Entry | null>(null);
    const [entryHistory, setEntryHistory] = useState<any | null>(null);
    const [transfers, setTransfers] = useState<any[]>([]);
    const [availableTransfers, setAvailableTransfers] = useState<number>(1); // Default to 1
    const [chips, setChips] = useState<any[]>([]);
    const [liveStats, setLiveStats] = useState<Record<number, LiveStats>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isReconstructed, setIsReconstructed] = useState(false);
    const [isCachedLineup, setIsCachedLineup] = useState(false);
    const [cachedLineupGw, setCachedLineupGw] = useState<number | null>(null);
    const [cachedLineupDate, setCachedLineupDate] = useState<string | null>(null);
    const [gwFixtures, setGwFixtures] = useState<any[]>([]);
    const [userCountry, setUserCountry] = useState<string>('GB');
    const [tvData, setTvData] = useState<Record<number, { name: string; logo: string | null }[]>>({});

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




    const isOwnTeam = !!(fplConnected && fplEntryId && entryId === fplEntryId);
    const hasLivePicksRef = useRef(false);
    const failedKeyRef = useRef<string | null>(null);
    const quoteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentGwId = useMemo(() => data.events.find(e => e.is_current)?.id || 0, [data.events]);
    const nextGwId = useMemo(() => data.events.find(e => e.is_next)?.id || currentGwId, [data.events, currentGwId]);
    const [fixturesGw, setFixturesGw] = useState<number | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [savedTeamIds, setSavedTeamIds] = useState<number[]>([]);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);

    // Fetch Entry Details (Name, history, etc) - only once
    useEffect(() => {
        const fetchEntryDetails = async () => {
            // Persistence Logic: If no entryId in URL, try to get from localStorage
            let activeEntryId = entryId;
            if (!activeEntryId) {
                const savedId = localStorage.getItem('last_analysed_entry');
                if (savedId) {
                    // Update URL silently or just use it? 
                    // Updating URL is cleaner for copy-paste sharing and consistency
                    // But we can't update URL easily inside async effect without causing loop or nav header sync issues.
                    // A better place might be at the component root or a redirect.
                    // However, we can just use it for fetching.
                    // BUT: The component props/hooks depend on `entryId` derived from searchParams.
                    // So we should navigate.
                }
            } else {
                localStorage.setItem('last_analysed_entry', activeEntryId.toString());
            }

            if (!activeEntryId) return;

            try {
                const [entry, history] = await Promise.all([
                    fetchEntry(activeEntryId),
                    fetchEntryHistory(activeEntryId)
                ]);
                setEntryData(entry);
                setEntryHistory(history);

                // Load last recommended plan from localStorage to prevent oscillation
                try {
                    const stored = localStorage.getItem(`wolf_last_plan_${entry.id}`);
                    if (stored) setLastRecommendedPlan(JSON.parse(stored));
                    else setLastRecommendedPlan(null);
                } catch { setLastRecommendedPlan(null); }

                // Fetch Transfer Status (for available free transfers)
                // Skip if viewing own connected team — live picks fetch handles this accurately
                if (isOwnTeam) return;
                try {
                    const status = await fetchTransferStatus(activeEntryId);
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
                        console.log("[PitchView] Public entry: calculating free transfers from history...");
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

    // Initialize fixturesGw when nextGwId is ready
    useEffect(() => {
        if (nextGwId && fixturesGw === null) {
            setFixturesGw(nextGwId);
        }
    }, [nextGwId, fixturesGw]);

    // Fetch fixtures for the selected fixturesGw
    useEffect(() => {
        const gwToFetch = fixturesGw || nextGwId;
        if (!gwToFetch) return;
        fetchFixtures(gwToFetch).then(setGwFixtures).catch(() => { });
    }, [fixturesGw, nextGwId]);

    // Detect user country via IP geolocation, fallback to timezone (with URL override for testing)
    useEffect(() => {
        const override = searchParams.get('country');
        if (override && override.length === 2) {
            setUserCountry(override.toUpperCase());
            return;
        }

        const tzCountryMap: Record<string, string> = {
            'Europe/London': 'GB', 'Europe/Dublin': 'IE',
            'Europe/Berlin': 'DE', 'Europe/Vienna': 'AT', 'Europe/Zurich': 'CH',
            'Europe/Paris': 'FR', 'Europe/Amsterdam': 'NL',
            'Europe/Madrid': 'ES', 'Europe/Rome': 'IT',
            'Europe/Oslo': 'NO', 'Europe/Stockholm': 'SE',
            'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI',
            'Europe/Lisbon': 'PT', 'Europe/Warsaw': 'PL',
            'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA',
            'America/Sao_Paulo': 'BR', 'America/Manaus': 'BR', 'America/Fortaleza': 'BR',
            'America/Argentina/Buenos_Aires': 'AR', 'America/Santiago': 'CL', 'America/Bogota': 'CO',
            'America/Mexico_City': 'MX', 'America/Cancun': 'MX',
            'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU',
            'Pacific/Auckland': 'NZ',
            'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR',
            'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
            'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Jakarta': 'ID',
            'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE', 'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Asia/Bahrain': 'BH',
            'Africa/Johannesburg': 'ZA', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE',
        };
        const detectCountry = async () => {
            const cached = sessionStorage.getItem('user_country');
            if (cached && cached.length === 2) { setUserCountry(cached); return; }

            try {
                const controller = new AbortController();
                const t = setTimeout(() => controller.abort(), 3000);
                const res = await fetch('https://ipapi.co/country/', { signal: controller.signal });
                clearTimeout(t);
                if (res.ok) {
                    const code = (await res.text()).trim();
                    if (code.length === 2) {
                        setUserCountry(code);
                        sessionStorage.setItem('user_country', code);
                        return;
                    }
                }
            } catch { }
            // Fallback: timezone
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const fromTz = tzCountryMap[tz];
            if (fromTz) { setUserCountry(fromTz); return; }
            if (tz.startsWith('America/')) setUserCountry('US');
        };
        detectCountry();
    }, []);

    // Fetch per-match TV broadcast data once country and GW are known
    useEffect(() => {
        const gwToFetch = fixturesGw || nextGwId;
        if (!gwToFetch || !userCountry) return;
        fetch(`/api/fixtures/tv?event=${gwToFetch}&country=${userCountry}`)
            .then(r => r.ok ? r.json() : {})
            .then(d => setTvData(d))
            .catch(() => { });
    }, [fixturesGw, nextGwId, userCountry]);

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

            // Stop retrying if this entry+gw+ownTeam combo already hard-failed
            const failKey = `${entryId}:${selectedGw}:${isOwnTeam}`;
            if (failedKeyRef.current === failKey) return;

            // If live picks were already loaded, don't overwrite them when connection drops
            if (hasLivePicksRef.current && !isOwnTeam) return;

            try {
                setLoading(true);
                setError(null);

                // Check if we are trying to load a future gameweek

                // 1. Fetch Basic Data
                // If viewing own connected team, use authenticated my-team endpoint for live picks
                const fetchLivePicks = async (): Promise<EntryPicksResponse | null> => {
                    if (!isOwnTeam || !token) return null;
                    try {
                        const res = await fetch('/api/fpl/my-picks', { headers: { Authorization: `Bearer ${token}` } });
                        if (res.ok) {
                            const data = await res.json();
                            hasLivePicksRef.current = true;
                            console.log('[PitchView] Using live authenticated picks');
                            console.log('[PitchView] active_chip:', data.active_chip, '| _transfers.active_chip:', data._transfers?.active_chip, '| chips:', data._chips?.map((c: any) => `${c.name}:${c.status_for_entry}`));
                            if (data._transfers?.limit != null) {
                                const realFreeTransfers = data._transfers.limit - (data._transfers.made || 0);
                                setAvailableTransfers(Math.max(0, realFreeTransfers));
                            }
                            if (data._chips?.length) setChips(data._chips);
                            // Save to lineup cache (fire-and-forget)
                            fetch(`/api/user/lineup-cache/${entryId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ picks_data: data.picks, gameweek: currentGwId, chips_data: data._chips || [] })
                            }).catch(() => { });
                            return data;
                        }
                    } catch { }
                    return null;
                };

                const fetchData = async (gw: number) => {
                    // Only fetch live picks for the current GW (or for reconstruction base)
                    const livePicks = (gw >= currentGwId) ? await fetchLivePicks() : null;

                    // If we have live picks, public picks are optional (only needed for entry_history)
                    if (livePicks) {
                        const [publicPicks, live, trans] = await Promise.all([
                            (gw <= currentGwId ? fetchEntryPicks(entryId, gw) : Promise.resolve(null)).catch(() => null),
                            fetchLiveEvent(gw),
                            fetchEntryTransfers(entryId)
                        ]);
                        return {
                            picks: { ...livePicks, entry_history: (publicPicks as any)?.entry_history ?? null },
                            live,
                            trans,
                            isReconstructed: false
                        };
                    }

                    // No live picks — fetch public picks and fail gracefully if unavailable
                    try {
                        const [picksOrPublic, live, trans] = await Promise.all([
                            (gw <= currentGwId ? fetchEntryPicks(entryId, gw) : Promise.resolve(null)),
                            fetchLiveEvent(gw),
                            fetchEntryTransfers(entryId)
                        ]);
                        if (!picksOrPublic) throw new Error('NO_PICKS_YET');
                        return { picks: picksOrPublic, live, trans };
                    } catch (e: any) {
                        if (gw > currentGwId) {
                            console.log(`[PitchView] Picks for GW${gw} not published yet — reconstructing from GW${currentGwId}.`);
                            try {
                                const [prevPicks, live, trans] = await Promise.all([
                                    (currentGwId > 0 ? fetchEntryPicks(entryId, currentGwId) : Promise.resolve(null)),
                                    fetchLiveEvent(gw),
                                    fetchEntryTransfers(entryId)
                                ]);
                                if (!prevPicks) throw new Error('NO_PICKS_YET');
                                return { picks: prevPicks, live, trans, isReconstructed: true };
                            } catch (_ignored: any) {
                                throw new Error('NO_PICKS_YET');
                            }
                        }
                        if (gw === currentGwId) {
                            const prevGw = Math.max(1, currentGwId - 1);
                            console.log(`[PitchView] GW${gw} public picks not yet available — using GW${prevGw} for display.`);
                            try {
                                const [prevPicks, live, trans] = await Promise.all([
                                    (prevGw > 0 ? fetchEntryPicks(entryId, prevGw) : Promise.resolve(null)),
                                    fetchLiveEvent(gw),
                                    fetchEntryTransfers(entryId)
                                ]);
                                if (!prevPicks) throw new Error('NO_PICKS_YET');
                                return { picks: prevPicks, live, trans, isReconstructed: true };
                            } catch (_ignored: any) {
                                // Try saved lineup cache before giving up
                                if (token) {
                                    try {
                                        const cacheRes = await fetch(`/api/user/lineup-cache/${entryId}`, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        });
                                        if (cacheRes.ok) {
                                            const cached = await cacheRes.json();
                                            if (cached?.picks_data?.length) {
                                                const live = await fetchLiveEvent(gw).catch(() => null);
                                                if (cached.chips_data?.length) setChips(cached.chips_data);
                                                return {
                                                    picks: { active_chip: null, automatic_subs: [], entry_history: null, picks: cached.picks_data },
                                                    live,
                                                    trans: [],
                                                    isCachedLineup: true,
                                                    cachedGw: cached.gameweek,
                                                    cachedDate: cached.updated_at,
                                                };
                                            }
                                        }
                                    } catch (_cacheErr: any) { }
                                }
                                throw new Error('NO_PICKS_YET');
                            }
                        }
                        throw e;
                    }
                };

                const { picks, live, trans, isReconstructed: recon, isCachedLineup: cached, cachedGw: cachedGwVal, cachedDate } = await fetchData(selectedGw) as any;

                setIsReconstructed(recon || false);
                setIsCachedLineup(cached || false);
                setCachedLineupGw(cachedGwVal || null);
                setCachedLineupDate(cachedDate || null);
                let processedPicks = { ...picks };

                // 2. Automatic Transfer Replay Logic (The "Live Sync")
                // Only applied if we are viewing a future gameweek (reconstructed)
                if (recon && trans && trans.length > 0) {
                    // We take the currentGw picks (fetched in fetchData fallback) 
                    // and apply transfers for the selectedGw.
                    const relevantTransfers = trans.filter((t: any) => t.event === selectedGw);

                    if (relevantTransfers.length > 0) {
                        console.log(`[AutoSync] Applying ${relevantTransfers.length} pending transfers for GW${selectedGw}`);
                        const newPicks = [...processedPicks.picks];

                        relevantTransfers.forEach((t: any) => {
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
                const failKey = `${entryId}:${selectedGw}:${isOwnTeam}`;
                failedKeyRef.current = failKey;
                setError(err.message === 'NO_PICKS_YET' ? 'NO_PICKS_YET' : (err.message || 'Failed to load team data.'));
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadPicks();
    }, [entryId, selectedGw, currentGwId, isOwnTeam, teamReloadKey]);

    // Reset flags when navigating to a different team
    useEffect(() => {
        hasLivePicksRef.current = false;
        failedKeyRef.current = null;
        setIsCachedLineup(false);
        setCachedLineupGw(null);
        setCachedLineupDate(null);
        setChips([]);
    }, [entryId]);

    // Always show player picker when in edit mode
    useEffect(() => {
        if (isEditingTeam) setShowPlayerPicker(true);
    }, [isEditingTeam]);

    const handlePrevGw = () => setSelectedGw(prev => Math.max(1, prev - 1));
    const handleNextGw = () => {
        setSelectedGw(prev => Math.min(38, prev + 1));
    };

    const getPlayer = (id: number) => data.elements.find(e => e.id === id);
    const getTeam = (id: number) => data.teams.find(t => t.id === id);

    // Require login to view any team
    if (!user) {
        return (
            <>
                <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-32 text-center space-y-6 animate-in fade-in zoom-in duration-500">
                    <button
                        onClick={() => setShowLoginModal(true)}
                        className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center hover:border-fpl-green hover:bg-slate-700 transition-all"
                    >
                        <LogIn size={36} className="text-gray-500" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-white mb-2">Login Required</h2>
                        <p className="text-gray-400">Please log in to analyse your team and access the Manager Hub.</p>
                    </div>
                    <button
                        onClick={() => setShowLoginModal(true)}
                        className="px-6 py-3 bg-fpl-green text-slate-900 font-black rounded-xl hover:bg-fpl-green/90 transition-all"
                    >
                        Login / Sign Up
                    </button>
                </div>
                <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
            </>
        );
    }

    // Render Search UI if no entry selected
    if (!entryId) {
        return (
            <div className="max-w-4xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-500 py-12">
                <div className="space-y-6">
                    <h2 className="text-4xl font-black text-white tracking-tight">Team Search</h2>
                    <p className="text-gray-400 max-w-lg mx-auto">
                        Search by name, league, ID — or log in to load your team instantly.
                    </p>

                    {/* My Team Banner — shown when FPL is connected */}
                    {fplEntryId && (
                        <div className="max-w-md mx-auto flex items-center justify-between gap-3 bg-[#00ff87]/10 border border-[#00ff87]/30 rounded-xl px-4 py-3 animate-in fade-in duration-300">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-[#00ff87]/20 rounded-full flex items-center justify-center">
                                    <LogIn size={16} className="text-[#00ff87]" />
                                </div>
                                <div className="text-left">
                                    <div className="text-xs text-[#00ff87] font-bold uppercase tracking-wide">FPL Connected</div>
                                    <div className="text-sm text-white">Team ID: {fplEntryId}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigate(`/analyse?entry=${fplEntryId}`)}
                                    className="bg-[#00ff87] text-slate-900 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-green-400 transition-colors"
                                >
                                    Load My Team
                                </button>
                                <button
                                    onClick={handleFplDisconnect}
                                    title="Disconnect FPL account"
                                    className="text-gray-500 hover:text-red-400 transition-colors p-1"
                                >
                                    <Unlink size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Toggle */}
                    <div className="flex justify-center mb-8">
                        <div className="bg-slate-900 p-1 rounded-xl border border-slate-700 flex gap-1">
                            <button
                                onClick={() => setSearchMode('name')}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${searchMode === 'name'
                                    ? 'bg-fpl-green text-slate-900 shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                Search Name
                            </button>
                            <button
                                onClick={() => setSearchMode('league')}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${searchMode === 'league'
                                    ? 'bg-fpl-green text-slate-900 shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                By League
                            </button>
                            <button
                                onClick={() => setSearchMode('team')}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${searchMode === 'team'
                                    ? 'bg-fpl-green text-slate-900 shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                By ID
                            </button>
                            <button
                                onClick={() => setSearchMode('fpl')}
                                className={`flex items-center gap-1.5 px-6 py-2 rounded-lg text-sm font-bold transition-all ${searchMode === 'fpl'
                                    ? 'bg-[#02efff] text-slate-900 shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                <LogIn size={14} />
                                My Team
                            </button>
                        </div>
                    </div>

                    <div className="max-w-md mx-auto min-h-[160px]">
                        {searchMode === 'name' ? (
                            <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-4">
                                <form onSubmit={handleNameSearch}>
                                    <label className="block text-sm font-bold text-gray-300 mb-2 text-left">
                                        Search Team or Manager Name
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Search className="h-5 w-5 text-gray-500" />
                                            </div>
                                            <input
                                                type="text"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="e.g. The Wolf"
                                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-fpl-green focus:ring-1 focus:ring-fpl-green transition-all"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={searchTerm.length < 2 || isSearchLoading}
                                            className="bg-fpl-green text-slate-900 font-bold px-6 py-3 rounded-xl hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-fpl-green/10"
                                        >
                                            {isSearchLoading ? <Loader2 className="animate-spin" /> : 'Find'}
                                        </button>
                                    </div>
                                </form>

                                {searchError && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                                        <AlertCircle size={16} />
                                        {searchError}
                                    </div>
                                )}

                                {searchResults.length > 0 && (
                                    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700 overflow-hidden text-left animate-in slide-in-from-bottom-2">
                                        <div className="p-3 border-b border-slate-700 bg-slate-950/50">
                                            <p className="text-xs text-gray-400 uppercase font-black tracking-widest">Matching Managers</p>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/50">
                                            {searchResults.map((result) => (
                                                <button
                                                    key={result.team_id}
                                                    onClick={() => navigate(`/analyse?entry=${result.team_id}`)}
                                                    className="w-full p-3 flex items-center justify-between hover:bg-slate-800 transition-colors group text-left"
                                                >
                                                    <div>
                                                        <div className="font-bold text-sm text-white group-hover:text-fpl-green transition-colors">
                                                            {result.team_name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {result.manager_name}
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={16} className="text-gray-600 group-hover:text-fpl-green" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : searchMode === 'team' ? (
                            <form onSubmit={handleTeamSearch} className="animate-in fade-in slide-in-from-left-4 duration-300">
                                <label className="block text-sm font-bold text-gray-300 mb-2 text-left">
                                    Enter your Team ID
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search className="h-5 w-5 text-gray-500" />
                                        </div>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={teamIdInput}
                                            onChange={(e) => setTeamIdInput(e.target.value.replace(/\D/g, ''))}
                                            placeholder="e.g. 123456"
                                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-fpl-green focus:ring-1 focus:ring-fpl-green transition-all"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!teamIdInput}
                                        className="bg-fpl-green text-slate-900 font-bold px-6 py-3 rounded-xl hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-fpl-green/10"
                                    >
                                        Go
                                    </button>
                                </div>
                            </form>
                        ) : searchMode === 'league' ? (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                                <form onSubmit={handleLeagueSearch}>
                                    <label className="block text-sm font-bold text-gray-300 mb-2 text-left">
                                        Enter League ID
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Users className="h-5 w-5 text-gray-500" />
                                            </div>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={leagueId}
                                                onChange={(e) => setLeagueId(e.target.value.replace(/\D/g, ''))}
                                                placeholder="e.g. 314"
                                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-fpl-green focus:ring-1 focus:ring-fpl-green transition-all"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={!leagueId || isSearchLoading}
                                            className="bg-fpl-green text-slate-900 font-bold px-6 py-3 rounded-xl hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-fpl-green/10"
                                        >
                                            {isSearchLoading ? <Loader2 className="animate-spin" /> : 'Find'}
                                        </button>
                                    </div>
                                </form>

                                {searchError && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                                        <AlertCircle size={16} />
                                        {searchError}
                                    </div>
                                )}

                                {leagueData && (
                                    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700 overflow-hidden text-left animate-in slide-in-from-bottom-2">
                                        <div className="p-3 border-b border-slate-700 bg-slate-950/50">
                                            <h3 className="font-bold text-white truncate">{leagueData.league.name}</h3>
                                            <p className="text-xs text-gray-400">Select yourself from the list:</p>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/50">
                                            {leagueData.standings.results.map((entry) => (
                                                <button
                                                    key={entry.id}
                                                    onClick={() => navigate(`/analyse?entry=${entry.entry}`)}
                                                    className="w-full p-3 flex items-center justify-between hover:bg-slate-800 transition-colors group text-left"
                                                >
                                                    <div>
                                                        <div className="font-bold text-sm text-white group-hover:text-fpl-green transition-colors">
                                                            {entry.entry_name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {entry.player_name}
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={16} className="text-gray-600 group-hover:text-fpl-green" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* FPL Login Panel */
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                                {!user ? (
                                    <div className="p-6 bg-slate-900/80 border border-slate-700 rounded-xl text-center space-y-3">
                                        <LogIn size={32} className="mx-auto text-[#02efff]" />
                                        <p className="text-white font-bold">Sign in to FantasyPremierWolf first</p>
                                        <p className="text-gray-400 text-sm">You need a FantasyPremierWolf account to connect your FPL team.</p>
                                    </div>
                                ) : (
                                    /* My Team — save FPL entry ID to profile */
                                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                                        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-left space-y-2">
                                            <p className="text-sm font-bold text-[#02efff] uppercase tracking-wide">How to find your Team ID</p>
                                            <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                                                <li>Go to <a href="https://fantasy.premierleague.com" target="_blank" rel="noreferrer" className="text-[#02efff] hover:underline">fantasy.premierleague.com</a></li>
                                                <li>Click <strong className="text-white">Points</strong> in the top nav</li>
                                                <li>Your Team ID is the number in the URL:<br /><span className="text-gray-500 font-mono text-[11px]">…/entry/<strong className="text-[#00ff87]">XXXXXX</strong>/event/…</span></li>
                                            </ol>
                                        </div>
                                        <form onSubmit={handleFplSave} className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-300 mb-1 text-left">Your FPL Team ID</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={fplManualId}
                                                    onChange={(e) => setFplManualId(e.target.value.replace(/\D/g, ''))}
                                                    placeholder="e.g. 1234567"
                                                    autoFocus
                                                    required
                                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#02efff] focus:ring-1 focus:ring-[#02efff] transition-all"
                                                />
                                            </div>
                                            {fplFreeCreditToast && (
                                                <div className="p-3 bg-[#00ff87]/10 border border-[#00ff87]/30 rounded-lg flex items-center gap-2 text-[#00ff87] text-sm font-semibold">
                                                    1 free analysis credit added to your account — enjoy your first Wolf analysis on us.
                                                </div>
                                            )}
                                            {fplError && (
                                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                                                    <AlertCircle size={16} />{fplError}
                                                </div>
                                            )}
                                            <button
                                                type="submit"
                                                disabled={fplSaving || !fplManualId}
                                                className="w-full bg-[#02efff] text-slate-900 font-bold py-3 rounded-xl hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                            >
                                                {fplSaving ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
                                                {fplSaving ? 'Saving...' : (user ? 'Save & Load My Team' : 'Load My Team')}
                                            </button>
                                        </form>
                                        {!user && <p className="text-xs text-gray-600 text-center">Sign in to save your Team ID for future visits.</p>}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
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

    if (error === 'NO_PICKS_YET') {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <Loader2 size={28} className="text-[#00ff87]" />
                </div>
                <p className="text-white font-bold text-lg">No picks available yet</p>
                <p className="text-gray-400 text-sm max-w-xs">
                    {isOwnTeam
                        ? `GW${currentGwId} picks aren't locked in yet — the deadline hasn't passed. Check back after the gameweek starts.`
                        : 'This team has no gameweek history available yet.'}
                </p>
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

        if ((user?.credits ?? 0) < 1) return;

        track('Analysis Started', { entry_id: entryId, gw: picksToUse.entry_history?.event, is_own_team: isOwnTeam });
        setIsAiLoading(true);
        setAiAnalysisText(null);
        setWolfPlan(null);
        setExecuteResult(null);
        setQuoteVisible(true);
        getRandomQuote().then(q => setLoadingQuote(q));
        quoteIntervalRef.current = setInterval(() => {
            setQuoteVisible(false);
            setTimeout(() => {
                getRandomQuote().then(q => { setLoadingQuote(q); setQuoteVisible(true); });
            }, 800);
        }, 15000);

        try {
            const transfersMade = calculateTransfersMade(picksData, picksToUse);
            const movesMadeInDraft = ghostPlayerIds.length;
            const transfersLeft = Math.max(0, availableTransfers - (transfersMade + movesMadeInDraft));

            // Fetch next 4 GWs of fixtures (for DGW/BGW awareness)
            const currentGwId = data.events.find(e => e.is_current)?.id ?? 0;
            const nextGwId = data.events.find(e => e.is_next)?.id ?? (currentGwId + 1);
            const fixtureGws = [nextGwId, nextGwId + 1, nextGwId + 2, nextGwId + 3].filter(gw => gw <= 38);
            const fixtureArrays = await Promise.all(fixtureGws.map(gw => fetchFixtures(gw).catch(() => [])));
            // Tag each fixture with its event ID and flatten
            const fixtures = fixtureArrays.flatMap((arr, i) =>
                arr.map((f: any) => ({ ...f, event: fixtureGws[i] }))
            );

            // Derive available chips from history
            const usedChipNames: string[] = entryHistory?.chips?.map((c: any) => c.name) ?? [];
            const wildcardCount = usedChipNames.filter(c => c === 'wildcard').length;
            const availableChips = (['wildcard', 'freehit', 'bboost', '3xc'] as const).filter(c => {
                if (c === 'wildcard') return wildcardCount < 2;
                return !usedChipNames.includes(c);
            });

            console.log(`[Gemini] FT remaining: ${transfersLeft} | Next GW: ${nextGwId} | Fixtures loaded: ${fixtures.length} | Chips available: ${availableChips.join(', ')}`);

            // If a plan was just executed, that takes priority over the previous recommendation
            const prevPlan = lastExecutedPlan ? null : lastRecommendedPlan;
            const activeChipNow = picksToUse.active_chip ?? null;
            const prompt = generateGeminiPrompt(data, picksToUse, entryData, entryHistory, transfersLeft, news, fixtures, availableChips, user?.manager_dna ?? null, lastExecutedPlan, transfers, prevPlan, activeChipNow);
            setLastExecutedPlan(null); // consume — only warn once per execute
            const { text: result, provider: resultProvider } = await fetchGeminiAnalysis(prompt, token ?? '');
            setAiProvider(resultProvider);

            // Parse structured plan from response — try multiple strategies
            let displayText = result;
            const tryParsePlan = (jsonStr: string): any | null => {
                try {
                    // Strip markdown fences, collapse internal whitespace/newlines
                    const clean = jsonStr
                        .replace(/^```(?:json)?\s*/i, '')
                        .replace(/\s*```\s*$/, '')
                        .replace(/\n\s*/g, ' ')
                        .trim();
                    const obj = JSON.parse(clean);
                    // Must have a transfers array to be a valid wolf plan
                    if (!obj || !Array.isArray(obj.transfers)) return null;
                    return obj;
                } catch { return null; }
            };

            let parsed: any = null;

            // Strategy 1: exact markers
            const planStart = result.indexOf('---WOLF_PLAN_JSON---');
            const planEnd = result.indexOf('---END_WOLF_PLAN---');
            if (planStart !== -1 && planEnd !== -1) {
                const between = result.slice(planStart + '---WOLF_PLAN_JSON---'.length, planEnd);
                displayText = result.slice(0, planStart).trim();
                parsed = tryParsePlan(between);
            }

            // Strategy 2: find last {...} containing "transfers" — handles { "transfers" with space
            if (!parsed) {
                const lastBrace = result.lastIndexOf('}');
                if (lastBrace !== -1) {
                    // Search for opening brace of an object containing "transfers"
                    const transfersIdx = result.lastIndexOf('"transfers"', lastBrace);
                    if (transfersIdx !== -1) {
                        // Walk backwards from "transfers" to find the opening {
                        let openBrace = -1;
                        for (let i = transfersIdx - 1; i >= 0; i--) {
                            if (result[i] === '{') { openBrace = i; break; }
                        }
                        if (openBrace !== -1) {
                            parsed = tryParsePlan(result.slice(openBrace, lastBrace + 1));
                            if (parsed) displayText = result.slice(0, openBrace).trim();
                        }
                    }
                }
            }

            // Strategy 3: regex — find anything that looks like a JSON object with transfers key
            if (!parsed) {
                const match = result.match(/(\{[\s\S]*?"transfers"[\s\S]*?\})\s*$/);
                if (match) {
                    parsed = tryParsePlan(match[1]);
                    if (parsed) displayText = result.slice(0, result.lastIndexOf(match[1])).trim();
                }
            }

            if (!parsed) console.warn('[Wolf] Could not parse plan from response. Raw tail:', result.slice(-300));

            if (parsed) {
                setWolfPlan(parsed);
                console.log('[Wolf] Plan parsed:', parsed);
                const planToSave = { transfers: parsed.transfers ?? [], chip: parsed.chip ?? null, captain: parsed.captain ?? undefined };
                setLastRecommendedPlan(planToSave);
                if (entryData?.id) {
                    try { localStorage.setItem(`wolf_last_plan_${entryData.id}`, JSON.stringify(planToSave)); } catch {}
                }
            }

            setAiAnalysisText(displayText);
            track('Analysis Completed', { entry_id: entryId, gw: picksToUse.entry_history?.event, has_plan: !!parsed, provider: resultProvider });

            // Credit already deducted server-side (atomically, before Gemini was called)
            // Just refresh the user so the UI shows the updated credit count
            if (token) refreshUser().catch(() => {});

            if (token) {
                fetch('/api/user/analyses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        team_name: entryData.name,
                        entry_id: entryData.id,
                        gameweek: picksToUse.entry_history?.event ?? 0,
                        analysis_text: displayText,
                        ai_provider: resultProvider,
                    })
                }).catch(e => console.warn('[DEV] Failed to save analysis:', e));
            }
        } catch (error: any) {
            console.error('Gemini Error:', error);
            track('Analysis Failed', { entry_id: entryId, error: error.message });
            setAiAnalysisText(`Error: ${error.message || 'Unknown error occurred'}`);
        } finally {
            setIsAiLoading(false);
            if (quoteIntervalRef.current) { clearInterval(quoteIntervalRef.current); quoteIntervalRef.current = null; }
        }
    };

    const handleExecutePlan = async () => {
        if (!picksData || !data || !entryData || !token) return;
        if (!wolfPlan) {
            setExecuteResult({ success: false, error: 'No structured plan available. The Wolf\'s plan could not be parsed from the analysis.' });
            return;
        }

        track('Plan Execution Started', { entry_id: entryId, transfers: wolfPlan.transfers.length, chip: wolfPlan.chip ?? null });
        setIsExecuting(true);
        setExecuteResult(null);

        try {
            const nextGwId = data.events.find(e => e.is_next)?.id
                ?? ((data.events.find(e => e.is_current)?.id ?? 0) + 1);

            // Normalise chip — AI sometimes outputs the string "None" instead of null
            const TRANSFER_CHIPS = ['wildcard', 'freehit', 'bboost']; // chips activated via transfers endpoint
            const MY_TEAM_CHIPS = ['3xc'];                             // chips activated via my-team endpoint
            const rawChip = wolfPlan.chip ? wolfPlan.chip.toLowerCase() : null;

            // If a chip is already active FPL requires we keep sending it in the payload —
            // sending null is treated as "cancel chip" which the API rejects.
            // Check all three sources — picksData.active_chip is often null even when a chip is live.
            const currentActiveChip = picksData?.active_chip
                || (picksData as any)?._transfers?.active_chip
                || chips.find((c: any) => c.status_for_entry === 'active')?.name
                || null;

            // chip for the transfers endpoint — never send 3xc here
            const transfersChip = TRANSFER_CHIPS.includes(currentActiveChip ?? '')
                ? currentActiveChip
                : TRANSFER_CHIPS.includes(rawChip ?? '') ? rawChip : null;

            // chip for the my-team endpoint — 3xc goes here.
            // Also preserve an already-active 3xc so FPL doesn't interpret chip:null as "cancel chip".
            const activeMyTeamChip = chips.find((c: any) => MY_TEAM_CHIPS.includes(c.name) && c.status_for_entry === 'active')?.name ?? null;
            const myTeamChip = activeMyTeamChip ?? (MY_TEAM_CHIPS.includes(rawChip ?? '') ? rawChip : null);

            const chip = transfersChip;

            // Fetch live team to get ACTUAL selling prices (AI estimates may not match FPL exactly)
            let sellingPriceMap: Record<number, number> = {};
            if (fplConnected && token) {
                try {
                    const liveRes = await fetch('/api/fpl/my-picks', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (liveRes.ok) {
                        const liveData = await liveRes.json();
                        for (const p of (liveData.picks || [])) {
                            if (p.element && p.selling_price != null) {
                                sellingPriceMap[p.element] = p.selling_price;
                            }
                        }
                    }
                } catch { /* proceed with AI prices as fallback */ }
            }

            // 1. Submit transfers (includes chip activation)
            let validTransfers: { element_in: number; element_out: number; purchase_price: number; selling_price: number }[] = [];
            let skippedReasons: string[] = [];
            if (wolfPlan.transfers.length > 0 || chip) {
                // --- Pre-flight validation ---
                const currentSquadIds = new Set(picksData.picks.map(p => p.element));

                // Build initial per-club count from current squad
                const squadClubCount: Record<number, number> = {};
                for (const p of picksData.picks) {
                    const pl = data.elements.find(e => e.id === p.element);
                    if (pl) squadClubCount[pl.team] = (squadClubCount[pl.team] ?? 0) + 1;
                }

                // Resolve all transfers — keep metadata needed for validation
                type ResolvedTransfer = {
                    element_in: number; element_out: number;
                    purchase_price: number; selling_price: number;
                    type_in: number; type_out: number;
                    team_in: number; team_out: number;
                };
                // For name lookups, build a squad-member set so we can prioritise
                // finding the squad's own player when multiple FPL elements share a web_name.
                const squadElementIds = new Set(picksData.picks.map(p => p.element));

                const resolvedTransfers: ResolvedTransfer[] = wolfPlan.transfers.map(t => {
                    // Outgoing: must be in the squad — search squad members first to avoid
                    // matching a different player who happens to share the same web_name.
                    const outPlayer = data.elements.find(e => e.web_name === t.out_name && squadElementIds.has(e.id))
                        ?? data.elements.find(e => e.web_name === t.out_name);
                    // Incoming: must NOT be in the squad already.
                    const inPlayer = data.elements.find(e => e.web_name === t.in_name && !squadElementIds.has(e.id))
                        ?? data.elements.find(e => e.web_name === t.in_name);
                    if (!outPlayer || !inPlayer) {
                        console.warn(`[Execute] Skipping unresolvable transfer: ${t.out_name} → ${t.in_name}`);
                        return null;
                    }
                    const actualSellPrice = sellingPriceMap[outPlayer.id] ?? Math.round((t.sell_price ?? 0) * 10);
                    return {
                        element_in: inPlayer.id, element_out: outPlayer.id,
                        purchase_price: inPlayer.now_cost, selling_price: actualSellPrice,
                        type_in: inPlayer.element_type, type_out: outPlayer.element_type,
                        team_in: inPlayer.team, team_out: outPlayer.team,
                    };
                }).filter(Boolean) as ResolvedTransfer[];

                const posLabel = ['?', 'GKP', 'DEF', 'MID', 'FWD'];

                // squadState is needed both in the re-pairing loop (auto-substitution) and
                // in the sequential validation loop below — declare it here so both can use it.
                const squadState = new Set(currentSquadIds);

                // Auto-fix position mismatches by re-pairing transfers by position type.
                // Groups all OUTs by their position and all INs by their position, then pairs
                // each OUT with an IN of the same position. When an imbalance exists (e.g. 2 MIDs
                // out but only 1 MID in the IN list), auto-substitute with the best available
                // player of the correct position from the data to fill the gap.
                const outByPos: Record<number, ResolvedTransfer[]> = {};
                const inByPos: Record<number, ResolvedTransfer[]> = {};
                for (const t of resolvedTransfers) {
                    if (!outByPos[t.type_out]) outByPos[t.type_out] = [];
                    if (!inByPos[t.type_in]) inByPos[t.type_in] = [];
                    outByPos[t.type_out].push(t);
                    inByPos[t.type_in].push(t);
                }

                // Build a set of all element_in IDs already chosen (to avoid duplicates when substituting)
                const chosenInIds = new Set(resolvedTransfers.map(t => t.element_in));

                const repairedTransfers: ResolvedTransfer[] = [];
                const allPositions = new Set([...Object.keys(outByPos), ...Object.keys(inByPos)].map(Number));
                for (const pos of allPositions) {
                    const outs = outByPos[pos] ?? [];
                    let ins = [...(inByPos[pos] ?? [])];
                    // If not enough INs for this position, find substitutes from data.elements
                    while (ins.length < outs.length) {
                        // Find best available player: same position, not in squad, not already chosen, sorted by ep_next
                        const substitute = data.elements
                            .filter(e =>
                                e.element_type === pos &&
                                e.status !== 'u' &&
                                !squadState.has(e.id) &&
                                !chosenInIds.has(e.id) &&
                                !resolvedTransfers.some(t => t.element_out === e.id)
                            )
                            .sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next))[0];
                        if (!substitute) break; // no valid substitute found
                        chosenInIds.add(substitute.id);
                        // Create a synthetic transfer using the OUT player's original transfer as base
                        const base = outs[ins.length];
                        ins.push({
                            ...base,
                            element_in: substitute.id,
                            purchase_price: substitute.now_cost,
                            team_in: substitute.team,
                            type_in: pos,
                        });
                    }
                    const pairCount = Math.min(outs.length, ins.length);
                    for (let i = 0; i < pairCount; i++) {
                        repairedTransfers.push({
                            ...outs[i],
                            element_in: ins[i].element_in,
                            purchase_price: ins[i].purchase_price,
                            team_in: ins[i].team_in,
                            type_in: pos,
                        });
                    }
                    // Any remaining unmatched OUTs = truly unresolvable (no eligible player exists)
                    for (let i = pairCount; i < outs.length; i++) {
                        const outName = data.elements.find(e => e.id === outs[i].element_out)?.web_name ?? String(outs[i].element_out);
                        skippedReasons.push(`${outName}: no valid ${posLabel[pos] ?? 'position'} replacement could be found`);
                    }
                }

                // Simulate transfers sequentially, enforcing all FPL API rules
                const clubCount = { ...squadClubCount }; // mutable copy
                const allOutIds = new Set(repairedTransfers.map(t => t.element_out));

                for (const t of repairedTransfers) {
                    const outName = data.elements.find(e => e.id === t.element_out)?.web_name ?? String(t.element_out);
                    const inName = data.elements.find(e => e.id === t.element_in)?.web_name ?? String(t.element_in);
                    if (!squadState.has(t.element_out)) {
                        skippedReasons.push(`${outName} → ${inName}: ${outName} is not in your squad`); continue;
                    }
                    if (squadState.has(t.element_in)) {
                        skippedReasons.push(`${outName} → ${inName}: ${inName} is already in your squad`); continue;
                    }
                    if (allOutIds.has(t.element_in)) {
                        skippedReasons.push(`${outName} → ${inName}: circular transfer`); continue;
                    }
                    if (Number(t.type_in) !== Number(t.type_out)) {
                        skippedReasons.push(`${outName} → ${inName}: position mismatch (${posLabel[t.type_out]} → ${posLabel[t.type_in]})`); continue;
                    }
                    const inClubCountAfter = (clubCount[Number(t.team_in)] ?? 0) + 1;
                    if (inClubCountAfter > 3) {
                        skippedReasons.push(`${outName} → ${inName}: club limit reached for ${inName}'s team`); continue;
                    }

                    validTransfers.push({ element_in: t.element_in, element_out: t.element_out, purchase_price: t.purchase_price, selling_price: t.selling_price });
                    squadState.delete(t.element_out);
                    squadState.add(t.element_in);
                    clubCount[t.team_out] = Math.max(0, (clubCount[t.team_out] ?? 1) - 1);
                    clubCount[t.team_in] = (clubCount[t.team_in] ?? 0) + 1;
                }

                console.log(`[Execute] ${resolvedTransfers.length} resolved → ${repairedTransfers.length} after re-pairing → ${validTransfers.length} valid after pre-flight`);

                // Block execution entirely if any transfer couldn't be validated — partial execution is worse than no execution
                if (skippedReasons.length > 0) {
                    throw new Error(`INVALID_PLAN:${JSON.stringify(skippedReasons)}`);
                }

                const transferPayload = {
                    confirmed: true,
                    transfers: validTransfers,
                    chip,
                    entry: entryData.id,
                    event: nextGwId,
                };

                const res = await fetch('/api/fpl-auth/transfers/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(transferPayload),
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    console.error('[Execute] Transfer 400 body:', JSON.stringify(err));
                    const msg = err.detail || err.non_field_errors?.[0] || (Array.isArray(err) ? JSON.stringify(err) : null) || err.error || `Transfer failed (${res.status})`;
                    throw new Error(msg);
                }
            }

            // 2. Update captain / VC via my-team
            const captainPlayer = data.elements.find(e => e.web_name === wolfPlan.captain);
            const vcPlayer = data.elements.find(e => e.web_name === wolfPlan.vice_captain);

            // Build updated picks — apply only VALID transfers (those that passed pre-flight), then captain flags
            const updatedPicks = picksData.picks.map(p => ({ ...p }));
            for (const t of validTransfers) {
                const idx = updatedPicks.findIndex(p => p.element === t.element_out);
                if (idx !== -1) updatedPicks[idx] = { ...updatedPicks[idx], element: t.element_in };
            }

            // Apply bench order if Wolf recommended one.
            // Bench positions 12-14 = outfield subs (priority order). Position 15 = backup GK (never moved).
            let positionMap: Record<number, number> = {}; // elementId -> new position
            if (wolfPlan.bench_order && wolfPlan.bench_order.length >= 3) {
                const benchGk = updatedPicks.find(p => p.position === 15);
                const outfieldBench = updatedPicks.filter(p => p.position >= 12 && p.position <= 14);
                wolfPlan.bench_order.slice(0, 3).forEach((webName, i) => {
                    const player = data.elements.find(e => e.web_name === webName);
                    const pick = player ? outfieldBench.find(p => p.element === player.id) : null;
                    if (pick) positionMap[pick.element] = 12 + i;
                });
                // Any outfield bench player not mentioned keeps a position after the specified ones
                let fallbackPos = 12;
                for (const p of outfieldBench) {
                    if (!positionMap[p.element]) {
                        while (Object.values(positionMap).includes(fallbackPos)) fallbackPos++;
                        positionMap[p.element] = fallbackPos++;
                    }
                }
                if (benchGk) positionMap[benchGk.element] = 15;
            }

            const myTeamPicks = updatedPicks.map(p => ({
                element: p.element,
                position: positionMap[p.element] ?? p.position,
                is_captain: captainPlayer ? p.element === captainPlayer.id : p.is_captain,
                is_vice_captain: vcPlayer ? p.element === vcPlayer.id : p.is_vice_captain,
            }));

            const teamRes = await fetch(`/api/fpl-auth/my-team/${entryData.id}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ picks: myTeamPicks, chip: myTeamChip }),
            });

            if (!teamRes.ok) {
                const err = await teamRes.json().catch(() => ({}));
                throw new Error(err.detail || err.non_field_errors?.[0] || err.error || `Captain update failed (${teamRes.status})`);
            }

            setExecuteResult({ success: true });
            track('Plan Executed Successfully', { entry_id: entryId, transfers: wolfPlan.transfers.length, chip: wolfPlan.chip ?? null });
            setLastExecutedPlan({ transfers: wolfPlan.transfers, chip: wolfPlan.chip ?? null });
            // Clear the "last recommended" plan now that it's been executed — next analysis starts fresh
            setLastRecommendedPlan(null);
            if (entryData?.id) { try { localStorage.removeItem(`wolf_last_plan_${entryData.id}`); } catch {} }
            // Reload team data to reflect the changes just applied
            hasLivePicksRef.current = false;
            setTeamReloadKey(k => k + 1);
            // Close the modal after a short delay so the user sees the success message
            setTimeout(() => setShowAnalysis(false), 2000);
        } catch (err: any) {
            if (err.message?.startsWith('INVALID_PLAN:')) {
                try {
                    const reasons = JSON.parse(err.message.slice('INVALID_PLAN:'.length));
                    setExecuteResult({ success: false, invalidPlan: reasons });
                } catch {
                    setExecuteResult({ success: false, error: err.message });
                }
            } else {
                track('Plan Execution Failed', { entry_id: entryId, error: err.message });
                setExecuteResult({ success: false, error: err.message });
            }
        } finally {
            setIsExecuting(false);
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
                    name: entryData.name,
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

    const handleSetCaptain = async (pick: Pick, role: 'captain' | 'vice_captain') => {
        if (!picksData) return;

        // Update locally
        const updatedPicks = picksData.picks.map(p => ({
            ...p,
            is_captain: role === 'captain' ? p.element === pick.element : p.is_captain && p.element !== pick.element,
            is_vice_captain: role === 'vice_captain' ? p.element === pick.element : p.is_vice_captain && p.element !== pick.element,
        }));
        setPicksData({ ...picksData, picks: updatedPicks });
        setCaptainError(null);

        // Save to FPL if own team
        if (isOwnTeam && token && fplEntryId) {
            setCaptainSaving(role);
            setCaptainError(null);
            setCaptainSuccess(null);
            try {
                const res = await fetch('/api/fpl/set-captain', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ element: pick.element, role }),
                });
                if (!res.ok) {
                    const err = await res.json();
                    const msg = err.error || 'Failed to save captain';
                    setCaptainError(msg);
                    setTimeout(() => setCaptainError(null), 4000);
                } else {
                    const label = role === 'captain' ? 'Captain' : 'Vice Captain';
                    const playerName = getPlayer(pick.element)?.web_name || 'Player';
                    setCaptainSuccess(`${playerName} set as ${label}`);
                    setTimeout(() => setCaptainSuccess(null), 3000);
                }
            } catch (e: any) {
                setCaptainError(e.message);
                setTimeout(() => setCaptainError(null), 4000);
            } finally {
                setCaptainSaving(null);
            }
        }
    };

    const handleAnalyze = () => {
        if (!picksData || !entryData) return;

        // Warn Co-Pilot & Autopilot users if not connected to their FPL team
        const tier = user?.membership_tier ?? 1;
        if (tier >= 2 && !fplConnected) {
            setShowNotConnectedWarning(true);
            return;
        }

        // Initialize Edit Mode with current picks (deep copy to avoid mutating original state)
        setEditedPicks(JSON.parse(JSON.stringify(picksData)));
        setIsEditingTeam(true);
    };

    // Actual Analysis Trigger (called after confirmation)
    const runAnalysis = async () => {
        const picksToAnalyse = editedPicks || picksData;
        if (!picksToAnalyse || !entryData) return;
        setIsEditingTeam(false); // Close edit modal

        // Open Modal and Trigger AI Analysis directly with EDITED picks (or current picks if no edits made)
        setShowAnalysis(true);
        handleGeminiAnalysis(picksToAnalyse);
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
    const startingXI = activePicks?.picks?.filter(p => p.position <= 11) || [];
    const bench = activePicks?.picks?.filter(p => p.position > 11) || [];

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

        const isHovered = hoveredPickElement === pick.element;

        return (
            <div
                key={pick.element}
                className={`flex flex-col items-center justify-center w-[72px] sm:w-24 md:w-30 lg:w-32 animate-in zoom-in duration-300 group cursor-pointer perspective-[500px] relative transition-all ${isGhost ? 'z-10' : isHovered ? 'z-[200]' : 'z-20'}`}
                onMouseEnter={() => setHoveredPickElement(pick.element)}
                onMouseLeave={() => setHoveredPickElement(null)}
                onClick={() => {
                    if (isEditingTeam) {
                        if (isGhost) {
                            handleRemovePlayer(pick);
                            if (!showPlayerPicker) setShowPlayerPicker(true);
                        } else if (swapSource) {
                            handleSwap(pick);
                        }
                    } else if (!isEditingTeam && pick.position <= 11 && isOwnTeam) {
                        // Mobile: open captain modal on tap
                        setCaptainModalPick(pick);
                    }
                }}
            >
                {/* Remove Button (Edit Mode) */}
                {showRemove && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleRemovePlayer(pick); }}
                        className={`absolute -top-2 -right-2 z-[100] bg-red-500 text-white rounded-full p-1.5 md:p-2 transition-opacity shadow-lg hover:bg-red-600 duration-200 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
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
                        className={`absolute -top-1 -left-1 z-[70] bg-[#37003c] text-[#00ff87] rounded-full p-1 transition-all duration-200 border border-[#00ff87] shadow-lg hover:scale-110 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
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
                    ${isGhost ? 'opacity-40 grayscale blur-[1px] scale-95' : isHovered ? 'scale-110' : ''}
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
                        {/* Points Box (Dark) — shows C/V buttons on hover for own team starting XI */}
                        <div className="bg-[#37003c] text-white rounded-b-[3px] text-center w-full border-t border-slate-200/20 h-[18px] sm:h-[20px] md:h-[22px] flex items-center justify-center relative overflow-visible">
                            {/* Default: points/price — hidden when showing C/V */}
                            <p className={`text-[12px] sm:text-[13px] md:text-base font-bold leading-none transition-opacity duration-100 ${!isEditingTeam && pick.position <= 11 && isOwnTeam && isHovered ? 'opacity-0' : 'opacity-100'}`}>
                                {isEditingTeam ? `£${(player.now_cost / 10).toFixed(1)}m` : (points > 0 ? points : '-')}
                            </p>
                            {/* C/V buttons — shown when hovered (own team starting XI, non-edit) */}
                            {!isEditingTeam && pick.position <= 11 && isOwnTeam && isHovered && (
                                <div className="absolute inset-0 flex items-center justify-center gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleSetCaptain(pick, 'captain'); }}
                                        title="Set as Captain"
                                        className={`text-[8px] font-black w-5 h-5 rounded-full flex items-center justify-center border transition-colors shadow-md
                                            ${pick.is_captain ? 'bg-[#00ff87] text-black border-[#00ff87]' : 'bg-slate-800 text-white border-white/60 hover:bg-[#00ff87] hover:text-black hover:border-[#00ff87]'}`}
                                    >C</button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleSetCaptain(pick, 'vice_captain'); }}
                                        title="Set as Vice Captain"
                                        className={`text-[8px] font-black w-5 h-5 rounded-full flex items-center justify-center border transition-colors shadow-md
                                            ${pick.is_vice_captain ? 'bg-[#02efff] text-black border-[#02efff]' : 'bg-slate-800 text-white border-white/60 hover:bg-[#02efff] hover:text-black hover:border-[#02efff]'}`}
                                    >V</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div> {/* End of Player Content Wrapper */}
            </div >
        );
    };

    const renderListView = () => {
        if (!picksData) return null;

        const allPicks = (isEditingTeam && editedPicks ? editedPicks : picksData).picks;
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
                {isEditingTeam ? (
                    <div className="grid grid-cols-[3fr,1fr,1fr,auto] gap-0 text-center text-xs md:text-sm text-white/40 font-black uppercase border-b border-white/10 pb-2 mb-4">
                        <div className="text-left pl-2">Player</div>
                        <div>Price</div>
                        <div>Form</div>
                        <div className="w-8" />
                    </div>
                ) : (
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
                )}

                {groups.map((group) => (
                    <div key={group.title} className="mb-6">
                        <h3 className="text-white font-bold text-sm mb-2 pl-2 border-l-4 border-[#00ff87]">{group.title}</h3>
                        <div className="space-y-1">
                            {group.players.map((pick) => {
                                const isGhost = ghostPlayerIds.includes(pick.element);
                                const player = getPlayer(pick.element);
                                const team = player ? getTeam(player.team) : null;
                                const stats = liveStats[pick.element];
                                const isSub = pick.position > 11;
                                const isOut = !isEditingTeam && picksData && !picksData.picks.find(p => p.element === pick.element);
                                const isNew = !isEditingTeam && isReconstructed && transfers.some(t => t.element_in === pick.element && t.event === selectedGw);

                                // Ghost slot in edit mode — click to open player picker
                                if (isGhost) {
                                    const posType = player?.element_type;
                                    const posLabel = ['', 'GKP', 'DEF', 'MID', 'FWD'][posType ?? 0];
                                    return (
                                        <div
                                            key={pick.element}
                                            onClick={() => { setSwapSource(null); setShowPlayerPicker(true); }}
                                            className={`grid ${isEditingTeam ? 'grid-cols-[3fr,1fr,1fr,auto]' : 'grid-cols-[3fr,repeat(13,1fr)]'} gap-0 items-center py-3 border-b border-white/5 cursor-pointer hover:bg-[#00ff87]/5 transition-colors ${isSub ? 'opacity-60' : ''}`}
                                        >
                                            <div className="flex items-center gap-3 pl-2">
                                                <div className="w-8 h-8 rounded-full border-2 border-dashed border-[#00ff87]/50 flex items-center justify-center">
                                                    <span className="text-[#00ff87] text-lg font-black">+</span>
                                                </div>
                                                <div>
                                                    <div className="text-[#00ff87] font-bold text-sm">Select {posLabel}</div>
                                                    <div className="text-white/30 text-xs">Tap to choose replacement</div>
                                                </div>
                                            </div>
                                            <div className="text-center text-white/20 text-xs">—</div>
                                            <div className="text-center text-white/20 text-xs">—</div>
                                            <div className="w-8" />
                                        </div>
                                    );
                                }

                                if (!player || !team) return null;

                                return (
                                    <div key={pick.element} className={`grid ${isEditingTeam ? 'grid-cols-[3fr,1fr,1fr,auto]' : 'grid-cols-[3fr,repeat(13,1fr)]'} gap-0 items-center py-3 text-center text-sm md:text-base border-b border-white/5 hover:bg-white/5 transition-colors ${isSub ? 'opacity-70' : ''}`}>
                                        {/* Player Info */}
                                        <div className="flex items-center gap-3 text-left pl-2 relative">
                                            {isSub && <span className="absolute -left-2 text-[10px] text-yellow-400 rotate-90 origin-right">SUB</span>}
                                            <div className="relative">
                                                <img
                                                    src={`https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${team.code}${player.element_type === 1 ? '_1' : ''}-66.png`}
                                                    alt={team.name}
                                                    className="w-8 h-8 object-contain"
                                                />
                                                {pick.is_captain && <div className="absolute -bottom-1 -right-1 bg-white text-black text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full">C</div>}
                                                {pick.is_vice_captain && <div className="absolute -bottom-1 -right-1 bg-white text-black text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full">V</div>}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className="font-bold text-white text-base leading-tight">{player.web_name}</div>
                                                    {isNew && <span className="text-[8px] font-black bg-[#00ff87] text-[#37003c] px-1 rounded-sm">NEW</span>}
                                                    {isOut && <span className="text-[8px] font-black bg-red-500 text-white px-1 rounded-sm">OUT</span>}
                                                </div>
                                                <div className="text-[10px] md:text-[11px] text-white/50 leading-none mt-0.5">{team.name} <span className="uppercase mx-1">{['', 'GKP', 'DEF', 'MID', 'FWD'][player.element_type]}</span></div>
                                            </div>
                                        </div>

                                        {isEditingTeam ? (<>
                                            {/* Price */}
                                            <div className="text-center text-[#00ff87] font-bold text-sm">£{(player.now_cost / 10).toFixed(1)}m</div>
                                            {/* Form */}
                                            <div className="text-center text-white/60 text-sm">{player.form}</div>
                                            {/* Remove button */}
                                            <div className="flex items-center justify-center w-8">
                                                <button
                                                    onClick={() => setGhostPlayerIds(prev => [...prev, pick.element])}
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full p-1 transition-colors"
                                                    title="Remove player"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                </button>
                                            </div>
                                        </>) : (<>
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
                                        </>)}
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
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[#00ff87] text-xs font-bold uppercase tracking-widest">Alpha Wolf Mode</p>
                                    {aiProvider && (
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${aiProvider === 'gemini' ? 'text-blue-300 border-blue-500/40 bg-blue-500/10' : 'text-orange-300 border-orange-500/40 bg-orange-500/10'}`}>
                                            {aiProvider === 'gemini' ? 'Gemini' : 'Claude'}
                                        </span>
                                    )}
                                </div>
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
                            <div className="flex flex-col items-center justify-center py-12 text-[#02efff] gap-6">
                                <Loader2 className="animate-spin w-8 h-8" />
                                <span className="text-sm font-bold uppercase tracking-widest animate-pulse">Summoning the Wolf...</span>
                                <span className="text-white/30 text-xs">Typically 30–90 seconds</span>
                                {loadingQuote && (
                                    <div
                                        className="max-w-sm text-center space-y-2"
                                        style={{ transition: 'opacity 0.8s ease', opacity: quoteVisible ? 1 : 0 }}
                                    >
                                        <p className="text-white/60 text-sm italic leading-relaxed">"{loadingQuote.quote}"</p>
                                        <p className="text-[#02efff]/60 text-xs font-semibold">— {loadingQuote.author}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Wolf's Plan Card */}
                        {wolfPlan && !isAiLoading && (
                            <div className="bg-[#0d1f0f] border-2 border-[#00ff87] rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,255,135,0.15)]">
                                <div className="bg-[#00ff87] px-5 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">🐺</span>
                                        <span className="text-[#0d1f0f] font-black text-base uppercase tracking-widest">The Wolf's Plan</span>
                                    </div>
                                    {wolfPlan.hits_taken > 0 && (
                                        <span className="bg-red-600 text-white text-xs font-black px-2 py-1 rounded-lg">
                                            -{wolfPlan.hits_taken * 4} pts ({wolfPlan.hits_taken} hit{wolfPlan.hits_taken > 1 ? 's' : ''})
                                        </span>
                                    )}
                                </div>
                                <div className="p-5 space-y-4">
                                    {/* Transfers */}
                                    {wolfPlan.transfers.length === 0 ? (
                                        wolfPlan.chip === 'wildcard' || wolfPlan.chip === 'freehit' ? (
                                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 space-y-1">
                                                <p className="text-yellow-300 text-sm font-bold">🃏 {wolfPlan.chip === 'wildcard' ? 'Wildcard' : 'Free Hit'} — rebuild your squad manually</p>
                                                <p className="text-white/60 text-xs leading-relaxed">The Wolf wants you to use your {wolfPlan.chip === 'wildcard' ? 'Wildcard' : 'Free Hit'} to overhaul the squad, but couldn't specify every replacement in one plan. Head to fantasy.premierleague.com to rebuild your full squad, then use the chip there.</p>
                                            </div>
                                        ) : (
                                            <p className="text-white/60 text-sm italic">No transfers recommended — hold your free transfers.</p>
                                        )
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="text-white/40 text-xs uppercase font-bold tracking-widest mb-2">Transfers</div>
                                            {wolfPlan.transfers.map((t, i) => (
                                                <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-3">
                                                    <span className="text-red-400 font-bold text-sm flex-1">↑ {t.out_name} <span className="text-white/40 font-normal">£{t.sell_price}m</span></span>
                                                    <span className="text-white/30 text-lg">→</span>
                                                    <span className="text-[#00ff87] font-bold text-sm flex-1 text-right">{t.in_name} ↓ <span className="text-white/40 font-normal">£{t.buy_price}m</span></span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Meta row */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                                        <div className="bg-white/5 rounded-lg px-3 py-2 text-center">
                                            <div className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Captain</div>
                                            <div className="text-[#00ff87] font-black text-sm">{wolfPlan.captain || '—'}</div>
                                        </div>
                                        <div className="bg-white/5 rounded-lg px-3 py-2 text-center">
                                            <div className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Vice-Captain</div>
                                            <div className="text-[#02efff] font-black text-sm">{wolfPlan.vice_captain || '—'}</div>
                                        </div>
                                        <div className="bg-white/5 rounded-lg px-3 py-2 text-center">
                                            <div className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Chip</div>
                                            {(() => {
                                                const activeNow = picksData?.active_chip ?? null;
                                                if (!wolfPlan.chip && activeNow === 'wildcard') return <div className="text-[#00ff87] font-black text-xs">🃏 Wildcard Active</div>;
                                                if (!wolfPlan.chip && activeNow === 'freehit') return <div className="text-[#00ff87] font-black text-xs">🎯 Free Hit Active</div>;
                                                return <div className="text-yellow-400 font-black text-sm capitalize">{wolfPlan.chip ?? 'None'}</div>;
                                            })()}
                                        </div>
                                        <div className="bg-white/5 rounded-lg px-3 py-2 text-center">
                                            <div className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Bank After</div>
                                            <div className="text-white font-black text-sm">£{wolfPlan.bank_after?.toFixed(1)}m</div>
                                        </div>
                                    </div>

                                    {/* Execute section */}
                                    {(user?.membership_tier ?? 1) < 2 ? (
                                        /* Tier 1 — upgrade prompt */
                                        <div className="w-full px-4 py-4 bg-slate-800/60 border border-slate-600/50 rounded-xl text-center space-y-2">
                                            <p className="text-gray-300 text-xs font-black uppercase tracking-wider">🔒 Execution requires Co-Pilot or Autopilot</p>
                                            <p className="text-gray-500 text-xs">Scout members can analyse but not execute transfers.</p>
                                            <a href="/pricing" className="inline-block text-fpl-green text-xs font-bold hover:underline mt-1">Upgrade your plan →</a>
                                        </div>
                                    ) : isOwnTeam ? (
                                        /* Connected + matching team — full execute path */
                                        wolfPlan.chip && ['wildcard', 'freehit'].includes(wolfPlan.chip) && wolfPlan.transfers.length === 0 ? (
                                            <a
                                                href="https://fantasy.premierleague.com/"
                                                target="_blank"
                                                rel="noreferrer"
                                                className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black text-sm rounded-xl uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20"
                                            >
                                                🌐 Rebuild Squad on FPL Website
                                            </a>
                                        ) : executeResult?.success ? (
                                            <div className="space-y-2">
                                                <div className="w-full py-3 bg-[#00ff87]/10 border border-[#00ff87]/40 text-[#00ff87] font-black text-sm rounded-xl uppercase tracking-widest flex items-center justify-center gap-2">
                                                    ✓ Execution Successful!
                                                </div>
                                                {executeResult.skipped && executeResult.skipped.length > 0 && (
                                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 space-y-1">
                                                        <p className="text-yellow-400 text-xs font-black uppercase tracking-wider">⚠️ {executeResult.skipped.length} transfer{executeResult.skipped.length > 1 ? 's' : ''} skipped (invalid):</p>
                                                        {executeResult.skipped.map((r, i) => (
                                                            <p key={i} className="text-yellow-300/80 text-xs">{r}</p>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : executeResult?.invalidPlan ? (
                                            <div className="space-y-3">
                                                <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 space-y-2">
                                                    <p className="text-red-400 font-black text-sm uppercase tracking-wider">⛔ Invalid Plan — Execution Blocked</p>
                                                    <p className="text-red-300/80 text-xs">The Wolf made an error in this plan. Re-run the analysis to get a corrected plan.</p>
                                                    <div className="space-y-1 pt-1">
                                                        {executeResult.invalidPlan.map((r, i) => (
                                                            <p key={i} className="text-red-300/70 text-xs font-mono">• {r}</p>
                                                        ))}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => { setExecuteResult(null); setWolfPlan(null); setAiAnalysisText(null); handleAnalyze(); }}
                                                    className="w-full py-3 bg-[#00ff87] hover:bg-[#00e87a] text-[#0d1f0f] font-black text-sm rounded-xl uppercase tracking-widest transition-all shadow-lg shadow-[#00ff87]/20"
                                                >
                                                    Re-run Analysis
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {executeResult?.error && (
                                                    <p className="text-red-400 text-xs text-center mb-2">{executeResult.error}</p>
                                                )}
                                                <button
                                                    onClick={handleExecutePlan}
                                                    disabled={isExecuting}
                                                    className="w-full py-3 bg-[#00ff87] hover:bg-[#00e87a] text-[#0d1f0f] font-black text-sm rounded-xl uppercase tracking-widest transition-all shadow-lg shadow-[#00ff87]/20 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
                                                >
                                                    {isExecuting ? <><Loader2 size={15} className="animate-spin" /> Applying...</> : '⚡ Execute Plan'}
                                                </button>
                                            </>
                                        )
                                    ) : (
                                        /* Not own team — ghosted execute with connect affordance */
                                        <div className="space-y-2">
                                            <button
                                                disabled
                                                className="w-full py-3 bg-[#00ff87]/10 text-[#00ff87]/30 font-black text-sm rounded-xl uppercase tracking-widest border border-[#00ff87]/10 flex items-center justify-center gap-2 cursor-not-allowed"
                                            >
                                                ⚡ Execute Plan
                                            </button>
                                            <div className="flex items-center justify-between gap-3 px-1">
                                                <p className="text-gray-500 text-xs">
                                                    {fplEntryId && fplEntryId !== entryId
                                                        ? 'Execute is only available for your connected team.'
                                                        : 'Connect this team via the FPL extension to execute.'}
                                                </p>
                                                {/* Show connect button only when this entry matches their linked FPL ID but session has lapsed */}
                                                {fplEntryId === entryId && !fplConnected && (
                                                    <button
                                                        onClick={() => window.dispatchEvent(new CustomEvent('fpw-reconnect', { detail: { fpwToken: localStorage.getItem('token') } }))}
                                                        title="Reconnect FPL session"
                                                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-xs font-black uppercase tracking-widest rounded-lg border border-yellow-500/30 transition-all"
                                                    >
                                                        <LogIn size={12} /> Connect
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
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

                        {/* Fallback Execute button when wolfPlan wasn't parsed */}
                        {aiAnalysisText && !isAiLoading && !wolfPlan && (
                            <div className="space-y-2">
                                {executeResult?.success ? (
                                    <div className="space-y-2">
                                        <div className="w-full py-3 bg-[#00ff87]/10 border border-[#00ff87]/40 text-[#00ff87] font-black text-sm rounded-xl uppercase tracking-widest flex items-center justify-center gap-2">
                                            ✓ Execution Successful!
                                        </div>
                                        {executeResult.skipped && executeResult.skipped.length > 0 && (
                                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 space-y-1">
                                                <p className="text-yellow-400 text-xs font-black uppercase tracking-wider">⚠️ {executeResult.skipped.length} transfer{executeResult.skipped.length > 1 ? 's' : ''} skipped (invalid):</p>
                                                {executeResult.skipped.map((r, i) => <p key={i} className="text-yellow-300/80 text-xs">{r}</p>)}
                                            </div>
                                        )}
                                    </div>
                                ) : (user?.membership_tier ?? 1) < 2 ? (
                                    <div className="w-full px-4 py-4 bg-slate-800/60 border border-slate-600/50 rounded-xl text-center space-y-2">
                                        <p className="text-gray-300 text-xs font-black uppercase tracking-wider">🔒 Execution requires Co-Pilot or Autopilot</p>
                                        <p className="text-gray-500 text-xs">Tier 1 (Scout) can analyse but not execute transfers.</p>
                                        <a href="/pricing" className="inline-block text-fpl-green text-xs font-bold hover:underline mt-1">Upgrade your plan →</a>
                                    </div>
                                ) : !fplConnected ? (
                                    <button
                                        onClick={() => {
                                            if (fplEntryId) {
                                                window.dispatchEvent(new CustomEvent('fpw-reconnect', { detail: { fpwToken: localStorage.getItem('token') } }));
                                            } else {
                                                setShowFplLoginModal(true);
                                            }
                                        }}
                                        className="w-full py-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 font-black text-sm rounded-xl uppercase tracking-widest transition-all border border-yellow-500/30 flex items-center justify-center gap-2"
                                    >
                                        🔗 Connect FPL to Execute
                                    </button>
                                ) : (
                                    <>
                                        {executeResult?.error && (
                                            <p className="text-red-400 text-xs text-center">{executeResult.error}</p>
                                        )}
                                        <button
                                            onClick={handleExecutePlan}
                                            disabled={isExecuting}
                                            className="w-full py-3 bg-[#00ff87] hover:bg-[#00e87a] text-[#0d1f0f] font-black text-sm rounded-xl uppercase tracking-widest transition-all shadow-lg shadow-[#00ff87]/20 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
                                        >
                                            {isExecuting ? <><Loader2 size={15} className="animate-spin" /> Applying...</> : '⚡ Execute Plan'}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        );
    };



    const calculateWolfRating = (entry: Entry): number => {
        let score = 0;
        const rank = entry.summary_overall_rank ?? 10000000;
        const value = entry.last_deadline_value ?? 1000;
        const gwRank = entry.summary_event_rank ?? 8000000;

        // 1. Rank Score (Max 80)
        if (rank <= 100) score = 80;
        else if (rank <= 1000) score = 75;
        else if (rank <= 10000) score = 70;
        else if (rank <= 50000) score = 65;
        else if (rank <= 100000) score = 60;
        else if (rank <= 500000) score = 50;
        else if (rank <= 1000000) score = 40;
        else if (rank <= 2000000) score = 30;
        else score = 10;

        // 2. Value Bonus (Max 15)
        if (value >= 1060) score += 15;      // > 106.0
        else if (value >= 1050) score += 12;
        else if (value >= 1040) score += 9;
        else if (value >= 1030) score += 6;
        else if (value >= 1020) score += 3;

        // 3. Form Bonus (Max 5)
        if (gwRank < 100000) score += 5;
        else if (gwRank < 1000000) score += 2;

        // 4. ELITE OVERRIDES (The "Wolf Respect" Clause)
        // If you are top tier, you cannot have a bad rating, period.
        if (rank <= 10) return Math.max(score, 99);    // World #1-10 is basically perfect
        if (rank <= 100) return Math.max(score, 95);   // Top 100 is god tier
        if (rank <= 1000) return Math.max(score, 90);  // Top 1k is legendary
        if (rank <= 10000) return Math.max(score, 85); // Top 10k is elite

        return Math.min(100, score);
    };

    return (
        <div className="relative space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 pt-4 select-none">

            {/* Mobile Captain/VC modal */}
            {captainModalPick && (() => {
                const modalPlayer = getPlayer(captainModalPick.element);
                return (
                    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4" onClick={() => setCaptainModalPick(null)}>
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                        <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
                            <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">Set Role</p>
                            <p className="text-white font-black text-lg mb-5">{modalPlayer?.web_name}</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { handleSetCaptain(captainModalPick, 'captain'); setCaptainModalPick(null); }}
                                    className={`flex-1 py-4 rounded-xl font-black text-sm flex flex-col items-center gap-1 border-2 transition-colors
                                        ${captainModalPick.is_captain ? 'bg-[#00ff87] text-black border-[#00ff87]' : 'bg-slate-800 text-white border-white/20 hover:border-[#00ff87] hover:text-[#00ff87]'}`}
                                >
                                    <span className="text-2xl font-black">C</span>
                                    <span className="text-[10px] font-bold tracking-wider">CAPTAIN</span>
                                </button>
                                <button
                                    onClick={() => { handleSetCaptain(captainModalPick, 'vice_captain'); setCaptainModalPick(null); }}
                                    className={`flex-1 py-4 rounded-xl font-black text-sm flex flex-col items-center gap-1 border-2 transition-colors
                                        ${captainModalPick.is_vice_captain ? 'bg-[#02efff] text-black border-[#02efff]' : 'bg-slate-800 text-white border-white/20 hover:border-[#02efff] hover:text-[#02efff]'}`}
                                >
                                    <span className="text-2xl font-black">V</span>
                                    <span className="text-[10px] font-bold tracking-wider">VICE CAPTAIN</span>
                                </button>
                            </div>
                            <button onClick={() => setCaptainModalPick(null)} className="mt-4 w-full py-2 text-white/40 text-sm hover:text-white transition-colors">Cancel</button>
                        </div>
                    </div>
                );
            })()}

            {/* Top Row: Team Name & Rating */}
            <div className="max-w-4xl mx-auto px-4 md:px-0 mb-2 flex flex-col md:flex-row items-center md:items-end gap-3 justify-center md:justify-start">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl md:text-3xl font-black text-white tracking-tight text-center md:text-left">{entryData?.name || 'My Team'}</h2>
                    {isOwnTeam && (
                        <div className="flex items-center gap-1 bg-[#00ff87]/10 border border-[#00ff87]/40 rounded-full px-2.5 py-1 shadow-[0_0_10px_rgba(0,255,135,0.15)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff87] animate-pulse" />
                            <span className="text-[#00ff87] text-[10px] font-black uppercase tracking-widest">Live</span>
                        </div>
                    )}
                    {entryData && (
                        <div className="bg-slate-800 border border-white/10 rounded-lg px-3 py-1 flex items-center gap-2 transform -skew-x-6 shadow-lg">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest not-italic skew-x-6">Wolf's Rating</span>
                            <span className={`text-lg font-black not-italic skew-x-6 ${calculateWolfRating(entryData) >= 80 ? 'text-[#00ff87]' : calculateWolfRating(entryData) >= 60 ? 'text-[#02efff]' : 'text-yellow-400'}`}>
                                {calculateWolfRating(entryData)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Success Toast */}
                {showSaveSuccess && (
                    <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                        <div className="bg-[#00ff87] text-[#37003c] px-3 py-1 rounded-full font-bold text-xs shadow-[0_0_15px_rgba(0,255,135,0.4)] flex items-center gap-1.5 border border-white/50">
                            <Save size={12} />
                            Team Saved!
                        </div>
                    </div>
                )}
            </div>

            {/* Gameweek Nav Row */}
            <div className="max-w-4xl mx-auto flex items-center justify-center gap-6 relative">
                {/* Search Different Team Button (Right Side) */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white text-xs font-bold transition-all border border-slate-700"
                    >
                        <RefreshCw size={14} />
                        <span className="hidden md:inline">Search Different Team</span>
                    </button>
                </div>
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
                    {isCachedLineup && (
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="bg-[#00ff87] text-[#37003c] text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-tighter">Saved Lineup{cachedLineupGw ? ` · GW${cachedLineupGw}` : ''}</span>
                            <div className="group relative">
                                <HelpCircle size={10} className="text-white/40 cursor-help hover:text-white transition-colors" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-slate-900 border border-white/20 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-50 text-[9px] leading-tight text-white/90 font-medium text-center">
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-white/20 rotate-45"></div>
                                    Last saved lineup from when this team was connected{cachedLineupDate ? ` · ${new Date(cachedLineupDate).toLocaleDateString()}` : ''}.
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
                {(() => {
                    const officialPoints = picksData?.entry_history?.points ?? 0;
                    // During a live GW the official tally is 0 until FPL finalises it.
                    // Calculate live total from liveStats so the number updates in real time.
                    const liveTotal = Object.keys(liveStats).length > 0 && picksData?.picks
                        ? picksData.picks
                            .filter(p => p.position <= 11)
                            .reduce((sum, p) => sum + (liveStats[p.element]?.total_points ?? 0) * p.multiplier, 0)
                        : null;
                    const displayPoints = isReconstructed ? 0 : (liveTotal !== null && liveTotal >= officialPoints ? liveTotal : officialPoints);
                    const isLive = liveTotal !== null && liveTotal > officialPoints;
                    return (
                        <div className="flex flex-col items-center justify-center p-6 bg-[#00ff87] rounded-xl border-4 border-[#00ff87] shadow-[0_0_30px_rgba(0,255,135,0.2)] transform hover:scale-105 transition-all cursor-default">
                            <div className="text-[#37003c] font-black text-5xl md:text-6xl tracking-tighter leading-none mb-1">
                                {displayPoints}
                            </div>
                            <div className="text-[#37003c]/60 text-[10px] uppercase font-black tracking-widest">{isLive ? 'Live Points' : 'Total Points'}</div>
                        </div>
                    );
                })()}
                <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-xl border border-white/10 group hover:border-[#02efff]/30 transition-all hover:bg-[#02efff]/5">
                    <div className="text-white font-black text-2xl italic tracking-tighter group-hover:scale-110 transition-transform">
                        {isReconstructed ? '-' : (picksData?.entry_history?.rank?.toLocaleString() || '-')}
                    </div>
                    <div className="text-white/40 text-[10px] uppercase font-black tracking-widest mt-1 group-hover:text-[#02efff]/60 transition-colors">GW Rank</div>
                </div>
                {(() => {
                    const activeChip = picksData?.active_chip
                        || (picksData as any)?._transfers?.active_chip
                        || chips.find((c: any) => c.status_for_entry === 'active')?.name
                        || null;
                    const chipActive = activeChip && ['wildcard', 'freehit'].includes(activeChip);
                    let transfersUsed = 0;
                    if (isEditingTeam && editedPicks && picksData) {
                        picksData.picks.forEach((originalPick, index) => {
                            const currentPick = editedPicks.picks[index];
                            const isGhost = ghostPlayerIds.includes(currentPick.element);
                            const isReplaced = currentPick.element !== originalPick.element;
                            if (isGhost || isReplaced) transfersUsed++;
                        });
                    }
                    const transfersLeft = Math.max(0, availableTransfers - transfersUsed);
                    return (
                        <div className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${chipActive ? 'bg-white/3 border-white/5 opacity-30' : 'bg-white/5 border-white/10 group hover:border-[#02efff]/30 hover:bg-[#02efff]/5'}`}>
                            <div className={`font-black text-2xl italic tracking-tighter ${chipActive ? 'text-white/40' : 'text-white group-hover:scale-110 transition-transform'}`}>
                                {transfersLeft}
                            </div>
                            <div className={`text-[10px] uppercase font-black tracking-widest mt-1 ${chipActive ? 'text-white/20' : 'text-white/40 group-hover:text-[#02efff]/60 transition-colors'}`}>
                                Transfers →
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Chips — shown when entry history is available (works for all teams) */}
            {entryHistory && (() => {
                // Prefer live FPL chips data; fall back to deriving from entryHistory.chips
                const rawChips: any[] = chips.length > 0 ? chips : (() => {
                    const usedMap: Record<string, number[]> = {};
                    (entryHistory.chips || []).forEach((c: any) => {
                        if (!usedMap[c.name]) usedMap[c.name] = [];
                        usedMap[c.name].push(c.event);
                    });
                    const result: any[] = [];
                    const ALL = [
                        { name: 'wildcard', id: 1 },
                        { name: 'freehit', id: 4 },
                        { name: 'bboost', id: 2 },
                        { name: '3xc', id: 5 },
                    ];
                    ALL.forEach(({ name, id }) => {
                        const gwList = usedMap[name] || [];
                        if (name === 'wildcard') {
                            if (gwList.length === 0) {
                                result.push({ id, name, status_for_entry: 'available', played_by_entry: [] });
                            } else {
                                result.push({ id, name, status_for_entry: 'played', played_by_entry: [gwList[0]] });
                                const second = gwList[1];
                                result.push({ id: id + 10, name, status_for_entry: second ? 'played' : 'available', played_by_entry: second ? [second] : [] });
                            }
                        } else {
                            if (gwList.length === 0) {
                                result.push({ id, name, status_for_entry: 'available', played_by_entry: [] });
                            } else {
                                result.push({ id, name, status_for_entry: 'played', played_by_entry: [gwList[0]] });
                            }
                        }
                    });
                    return result;
                })();

                const CHIP_META: Record<string, { label: string; abbr: string; color: string }> = {
                    wildcard: { label: 'Wildcard', abbr: 'WC', color: '#00ff87' },
                    freehit: { label: 'Free Hit', abbr: 'FH', color: '#02efff' },
                    bboost: { label: 'Bench Boost', abbr: 'BB', color: '#ff9f43' },
                    '3xc': { label: 'Triple Captain', abbr: 'TC', color: '#ffd700' },
                };
                // Deduplicate wildcards: keep first always; keep second only if available/active
                const seen = new Set<string>();
                const displayChips = rawChips.filter(c => {
                    const key = c.name;
                    if (seen.has(key)) return c.status_for_entry === 'available' || picksData?.active_chip === c.name;
                    seen.add(key);
                    return true;
                });
                return (
                    <div className="max-w-4xl mx-auto px-2 md:px-0">
                        <div className="text-white/40 text-[10px] uppercase font-black tracking-widest mb-2">Chips</div>
                        <div className="grid grid-cols-4 gap-2 md:gap-3">
                            {displayChips.map((chip: any) => {
                                const meta = CHIP_META[chip.name];
                                if (!meta) return null;
                                const activeChipNow = picksData?.active_chip
                                    || (picksData as any)?._transfers?.active_chip
                                    || chips.find((c: any) => c.status_for_entry === 'active')?.name
                                    || null;
                                const isActive = activeChipNow === chip.name;
                                const isAvailable = chip.status_for_entry === 'available';
                                const usedGw = chip.played_by_entry?.[0] ?? null;
                                return (
                                    <div
                                        key={chip.id ?? chip.name}
                                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center
                                            ${isActive
                                                ? 'border-[#00ff87] bg-[#00ff87]/15 shadow-[0_0_25px_rgba(0,255,135,0.4)] scale-105'
                                                : isAvailable
                                                    ? 'border-white/20 bg-white/5 hover:border-white/40'
                                                    : 'border-white/10 bg-white/3 opacity-50'
                                            }`}
                                    >
                                        <span
                                            className="text-lg font-black tracking-tight leading-none mb-1"
                                            style={{ color: isAvailable || isActive ? meta.color : '#ffffff40' }}
                                        >
                                            {meta.abbr}
                                        </span>
                                        <span className={`text-[9px] font-bold uppercase tracking-wide ${isAvailable || isActive ? 'text-white/80' : 'text-white/30'}`}>
                                            {meta.label}
                                        </span>
                                        <span className={`mt-1.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-sm tracking-tighter
                                            ${isActive
                                                ? 'bg-[#00ff87] text-[#37003c]'
                                                : isAvailable
                                                    ? 'bg-white/10 text-white/60'
                                                    : 'bg-white/5 text-white/30'
                                            }`}
                                        >
                                            {isActive ? 'Active' : isAvailable ? 'Available' : usedGw ? `Used GW${usedGw}` : 'Used'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* TOTW Link */}
            <div className="max-w-4xl mx-auto text-center -mt-2">
                <span className="text-[10px] font-bold text-[#00ff87] uppercase tracking-widest cursor-pointer hover:underline flex items-center justify-center gap-2">
                    <Sparkles size={10} /> Team of the Week →
                </span>
            </div>

            {/* AI Diagnosis CTA - Floating below stats */}
            {(user?.credits ?? 0) < 1 && (
                <div className="max-w-4xl mx-auto px-4 md:px-0">
                    <div className="w-full rounded-2xl border border-red-500/30 bg-red-500/5 p-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                                <AlertCircle className="text-red-400 w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-white font-black text-sm">No Analysis Credits</p>
                                <p className="text-gray-400 text-xs mt-0.5">You have no credits remaining. Buy more to run a Wolf analysis.</p>
                            </div>
                        </div>
                        <button onClick={() => navigate('/pricing?tab=credits')} className="shrink-0 px-5 py-2.5 bg-fpl-green/10 border border-fpl-green/30 text-fpl-green font-black text-xs uppercase tracking-wide rounded-xl hover:bg-fpl-green/20 transition-all">
                            Buy Credits
                        </button>
                    </div>
                </div>
            )}
            <div className={`max-w-4xl mx-auto px-4 md:px-0 transition-all duration-500 ${isEditingTeam ? 'sticky bottom-6 z-50' : ''} ${(user?.credits ?? 0) < 1 ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className={`
                        w-full relative overflow-hidden rounded-2xl border transition-all shadow-2xl p-4 md:p-6
                        ${isEditingTeam ? 'bg-[#220025] border-[#00ff87]/50' : 'bg-gradient-to-r from-[#37003c] to-[#4d0c54] border-white/10'}
                    `}>
                    <div className={`absolute inset-0 ${isEditingTeam ? 'bg-[#00ff87]/5' : ''}`}></div>

                    <div className="relative flex items-center justify-between gap-3 md:gap-6">
                        {/* Left: icon + title */}
                        <div className="flex items-center gap-3 md:gap-6 flex-1 min-w-0">
                            <div className={`
                                w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center border shadow-xl shrink-0 transition-colors
                                ${isEditingTeam ? 'bg-[#220025] border-[#00ff87] shadow-[0_0_15px_rgba(0,255,135,0.2)]' : 'bg-[#37003c] border-white/20'}
                            `}>
                                <Activity className={`w-6 h-6 md:w-8 md:h-8 ${isEditingTeam ? 'text-[#00ff87] animate-pulse' : 'text-[#00ff87]'}`} />
                            </div>
                            <div className="text-left flex-1 min-w-0">
                                {isEditingTeam ? (
                                    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                                        <h3 className="text-base md:text-2xl font-black text-[#00ff87] italic tracking-tighter uppercase leading-none mb-1">Edit Mode Active</h3>
                                        <p className="text-xs md:text-sm text-white/70 font-bold tracking-wide leading-tight">Make changes to your squad, then unleash the Wolf.</p>
                                    </div>
                                ) : (
                                    <>
                                        <h3 className="text-lg md:text-3xl font-black text-white italic tracking-tighter uppercase leading-none mb-1">The Wolf's Diagnosis</h3>
                                        <p className="text-[10px] md:text-xs text-white/60 font-bold uppercase tracking-[0.1em] md:tracking-[0.2em]">Alpha Strategy Analysis mode</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Right: two buttons always visible */}
                        <div className="shrink-0 flex items-center gap-2 md:gap-3">
                            {/* Button 1: Edit Team toggle */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isEditingTeam) {
                                        setIsEditingTeam(false);
                                        setGhostPlayerIds([]);
                                        setEditedPicks(null);
                                        setShowPlayerPicker(false);
                                    } else {
                                        if (!picksData || !entryData) return;
                                        setEditedPicks(JSON.parse(JSON.stringify(picksData)));
                                        setIsEditingTeam(true);
                                    }
                                }}
                                className={`px-3 py-2.5 md:px-5 md:py-3 rounded-xl font-black text-xs uppercase tracking-wide border transition-all flex items-center gap-1.5
                                    ${isEditingTeam
                                        ? 'bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20'
                                        : 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                                    }`}
                            >
                                {isEditingTeam ? <><X size={13} /> Exit</> : <>Edit Team</>}
                            </button>

                            {/* Button 2: Unleash the Wolf */}
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowWolfConfirm(true); }}
                                className="px-3 py-2.5 md:px-6 md:py-3 bg-[#00ff87] text-[#37003c] font-black rounded-xl text-xs md:text-sm uppercase tracking-wide flex items-center gap-2 hover:bg-[#02efff] hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,135,0.3)]"
                            >
                                <span>🐺</span>
                                <span className="hidden sm:inline">Unleash Wolf</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* View Switching */}
            {view === 'list' ? (
                <div className="flex items-start justify-center relative w-full">
                    {renderPlayerPicker()}
                    <div className="flex-1 pt-4">{renderListView()}</div>
                </div>
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

                                {/* Captain save toast */}
                                {(captainSaving || captainSuccess || captainError) && (
                                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[200] pointer-events-none">
                                        {captainSaving && (
                                            <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-sm text-white text-xs font-semibold px-3 py-2 rounded-full border border-white/20 shadow-xl">
                                                <Loader2 size={12} className="animate-spin" />
                                                Saving…
                                            </div>
                                        )}
                                        {captainSuccess && !captainSaving && (
                                            <div className="flex items-center gap-2 bg-[#052e16]/90 backdrop-blur-sm text-[#00ff87] text-xs font-semibold px-3 py-2 rounded-full border border-[#00ff87]/40 shadow-xl">
                                                ✓ {captainSuccess}
                                            </div>
                                        )}
                                        {captainError && !captainSaving && (
                                            <div className="flex items-center gap-2 bg-red-950/90 backdrop-blur-sm text-red-400 text-xs font-semibold px-3 py-2 rounded-full border border-red-500/40 shadow-xl">
                                                ✕ {captainError}
                                            </div>
                                        )}
                                    </div>
                                )}

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

                        {/* GW Fixtures */}
                        {gwFixtures.length > 0 && (() => {
                            // UK/Ireland: Sat 3pm is a blackout (not televised) — used as fallback when tvData is empty
                            const isBlackout = (kickoffTime: string | null): boolean => {
                                if (!kickoffTime) return true;
                                if (userCountry !== 'GB' && userCountry !== 'IE') return false;
                                const ko = new Date(kickoffTime);
                                const utcDay = ko.getUTCDay();
                                const utcHour = ko.getUTCHours();
                                const utcMin = ko.getUTCMinutes();
                                return utcDay === 6 && utcMin === 0 && (utcHour === 14 || utcHour === 15);
                            };

                            return (
                                <div className="relative mt-8 max-w-4xl mx-auto px-2 md:px-4 pb-4">
                                    <div className="flex items-center justify-center gap-2 mb-4">
                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/20" />
                                        <button
                                            onClick={() => setFixturesGw((prev) => Math.max(1, (prev || nextGwId) - 1))}
                                            className="text-[#00ff87]/60 hover:text-[#00ff87] px-2 py-1 flex items-center transition-colors"
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <span className="text-[#00ff87] text-[14px] md:text-base uppercase font-black tracking-widest px-2">GW{fixturesGw || nextGwId} Fixtures</span>
                                        <button
                                            onClick={() => setFixturesGw((prev) => Math.min(38, (prev || nextGwId) + 1))}
                                            className="text-[#00ff87]/60 hover:text-[#00ff87] px-2 py-1 flex items-center transition-colors"
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/20" />
                                    </div>
                                    <div className="rounded-[20px] border border-white/10 overflow-hidden shadow-2xl divide-y divide-white/5">
                                        {gwFixtures.map((fix: any, idx: number) => {
                                            const homeTeam = data.teams.find(t => t.id === fix.team_h);
                                            const awayTeam = data.teams.find(t => t.id === fix.team_a);
                                            const started = fix.started;
                                            const finished = fix.finished;
                                            const isLive = started && !finished;
                                            const ko = fix.kickoff_time ? new Date(fix.kickoff_time) : null;
                                            const day = ko ? ko.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'TBC';
                                            const time = ko ? ko.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
                                            const hScore = fix.team_h_score ?? null;
                                            const aScore = fix.team_a_score ?? null;
                                            const fixChannels = tvData[fix.id] ?? null;
                                            // If TV data hasn't loaded yet, fall back to blackout heuristic
                                            const onTv = fixChannels !== null ? fixChannels.length > 0 : !isBlackout(fix.kickoff_time);
                                            return (
                                                <div
                                                    key={fix.id}
                                                    className={`flex items-center gap-2 px-3 py-3 transition-colors
                                                    ${isLive ? 'bg-[#00ff87]/5' : idx % 2 === 0 ? 'bg-white/[0.03]' : 'bg-transparent'}
                                                    hover:bg-white/[0.06]`}
                                                >
                                                    {/* TV channel badge — left rail */}
                                                    {(() => {
                                                        const BADGE: Record<string, { abbr: string; color: string }> = {
                                                            'sky sports': { abbr: 'SKY', color: '#0063cc' },
                                                            'tnt sports': { abbr: 'TNT', color: '#ff6b00' },
                                                            'amazon prime': { abbr: 'PRIME', color: '#00a8e0' },
                                                            'peacock': { abbr: 'PCK', color: '#9b59b6' },
                                                            'dazn': { abbr: 'DAZN', color: '#ff0050' },
                                                            'optus': { abbr: 'OPTUS', color: '#ff6600' },
                                                            'bein': { abbr: 'beIN', color: '#8b0000' },
                                                            'viaplay': { abbr: 'VIA', color: '#3d00e0' },
                                                            'canal': { abbr: 'C+', color: '#111' },
                                                            'espn': { abbr: 'ESPN', color: '#cc0000' },
                                                            'supersport': { abbr: 'SS', color: '#004b8d' },
                                                        };
                                                        const getBadge = (name: string) => {
                                                            const lower = name.toLowerCase();
                                                            for (const [key, val] of Object.entries(BADGE)) {
                                                                if (lower.includes(key)) return val;
                                                            }
                                                            return { abbr: name.slice(0, 4).toUpperCase(), color: '#555' };
                                                        };
                                                        if (!onTv) return <div className="w-20 shrink-0" />;
                                                        if (!fixChannels || fixChannels.length === 0) {
                                                            return <div className="w-20 shrink-0 flex items-center justify-center"><Tv size={16} className="text-white/30" /></div>;
                                                        }
                                                        return (
                                                            <div className="w-20 shrink-0 flex flex-col items-center justify-center gap-2">
                                                                {fixChannels.slice(0, 2).map((ch: any, i: number) => {
                                                                    const b = getBadge(ch.name);
                                                                    return ch.logo ? (
                                                                        <div key={i} className="bg-white rounded overflow-hidden p-1 flex items-center justify-center shadow-md">
                                                                            <img
                                                                                src={ch.logo}
                                                                                alt={ch.name}
                                                                                title={ch.name}
                                                                                className="w-14 h-5 object-contain"
                                                                                onError={(e) => {
                                                                                    (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <span
                                                                            key={i}
                                                                            title={ch.name}
                                                                            className="text-[8px] font-black tracking-tight px-1.5 py-0.5 rounded"
                                                                            style={{ background: b.color + '33', color: b.color, border: `1px solid ${b.color}55` }}
                                                                        >
                                                                            {b.abbr}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Home */}
                                                    <div className="flex-1 flex items-center justify-end gap-3 min-w-0 pr-2">
                                                        <span className="text-base md:text-lg font-bold text-white truncate">{homeTeam?.name ?? '?'}</span>
                                                        {homeTeam?.code && <img src={`https://resources.premierleague.com/premierleague/badges/70/t${homeTeam.code}.png`} alt="" className="w-8 h-8 md:w-10 md:h-10 object-contain shrink-0" />}
                                                    </div>

                                                    {/* Score / Time */}
                                                    <div className="flex flex-col items-center shrink-0 min-w-[100px] md:min-w-[120px]">
                                                        {started ? (
                                                            <>
                                                                <span className={`text-xl md:text-2xl font-black tabular-nums tracking-tight ${isLive ? 'text-[#00ff87]' : 'text-white/60'}`}>
                                                                    {hScore} – {aScore}
                                                                </span>
                                                                {isLive && (
                                                                    <span className="flex items-center gap-1 text-[10px] font-black text-[#00ff87] uppercase tracking-widest mt-1">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-[#00ff87] animate-pulse inline-block" />
                                                                        Live
                                                                    </span>
                                                                )}
                                                                {finished && (
                                                                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider mt-1">FT</span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="text-sm md:text-base font-black text-white/80">{time}</span>
                                                                <span className="text-xs font-bold text-white/40 mt-1">{day}</span>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Away */}
                                                    <div className="flex-1 flex items-center justify-start gap-3 min-w-0 pl-2">
                                                        {awayTeam?.code && <img src={`https://resources.premierleague.com/premierleague/badges/70/t${awayTeam.code}.png`} alt="" className="w-8 h-8 md:w-10 md:h-10 object-contain shrink-0" />}
                                                        <span className="text-base md:text-lg font-bold text-white truncate">{awayTeam?.name ?? '?'}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}
                    </div> {/* End of Pitch/Bench Container Column */}
                </div>
            )}
            {renderAnalysisModal()}

            {/* Not Connected Warning (tier 2/3) */}
            {/* Wolf Confirm Modal */}
            {showWolfConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
                        <button onClick={() => setShowWolfConfirm(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                            <X size={16} />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-3xl">🐺</span>
                            <div>
                                <h3 className="text-white font-black text-lg leading-tight">Unleash the Wolf?</h3>
                                <p className="text-gray-500 text-xs">This will use 1 analysis credit</p>
                            </div>
                        </div>

                        <div className="bg-slate-800/50 border border-white/5 rounded-xl p-3 mb-4 flex items-center justify-between">
                            <span className="text-gray-400 text-sm">Credits remaining</span>
                            <span className={`font-black text-sm ${(user?.credits ?? 0) > 0 ? 'text-[#00ff87]' : 'text-red-400'}`}>
                                {user?.credits ?? 0} → {Math.max(0, (user?.credits ?? 0) - 1)} after analysis
                            </span>
                        </div>

                        {/* Warning for Scout tier or not FPL-connected */}
                        {(!fplConnected || (user?.membership_tier ?? 1) === 1) && (
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4 flex items-start gap-2">
                                <AlertTriangle size={15} className="text-yellow-400 shrink-0 mt-0.5" />
                                <p className="text-yellow-200/80 text-xs leading-relaxed">
                                    {!fplConnected
                                        ? 'Your FPL account is not connected. Make sure the team shown on screen is identical to your FPL squad — the Wolf analyses what it can see, not what\'s on the FPL website.'
                                        : 'On Scout tier the Wolf analyses the squad shown on screen. Ensure it matches your FPL team exactly before running.'
                                    }
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowWolfConfirm(false)}
                                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => { setShowWolfConfirm(false); runAnalysis(); }}
                                disabled={(user?.credits ?? 0) < 1}
                                className="flex-1 py-2.5 rounded-xl bg-[#00ff87] text-slate-900 font-black text-sm uppercase tracking-wide hover:bg-[#02efff] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <span>🐺</span> Unleash
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showNotConnectedWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
                    <div className="bg-slate-900 border border-yellow-500/30 rounded-2xl p-8 max-w-sm w-full space-y-5 text-center shadow-2xl">
                        <div className="w-12 h-12 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center justify-center mx-auto">
                            <AlertTriangle className="text-yellow-400 w-6 h-6" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-white font-black text-lg">FPL Account Not Connected</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Your {user?.membership_tier === 3 ? 'Autopilot' : 'Co-Pilot'} tier includes automatic transfer execution — but your FPL account isn't connected. Connect first to get the full experience.
                            </p>
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    if (fplEntryId) {
                                        // Try reconnect via extension; if no token, fall back to FPL site
                                        const onResult = (e: Event) => {
                                            window.removeEventListener('fpw-reconnect-result', onResult);
                                            const detail = (e as CustomEvent).detail;
                                            if (!detail?.ok) {
                                                window.open('https://fantasy.premierleague.com/', '_blank');
                                            }
                                        };
                                        window.addEventListener('fpw-reconnect-result', onResult);
                                        // Clean up listener if extension doesn't respond
                                        setTimeout(() => window.removeEventListener('fpw-reconnect-result', onResult), 10000);
                                        window.dispatchEvent(new CustomEvent('fpw-reconnect', { detail: { fpwToken: localStorage.getItem('token') } }));
                                        setShowNotConnectedWarning(false);
                                    } else {
                                        window.open('https://fantasy.premierleague.com/', '_blank');
                                        setShowNotConnectedWarning(false);
                                    }
                                }}
                                className="w-full py-3 bg-fpl-green text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl hover:bg-fpl-green/90 transition-all"
                            >
                                {fplEntryId ? 'Reconnect FPL Account' : 'Log in to FPL'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowNotConnectedWarning(false);
                                    setEditedPicks(JSON.parse(JSON.stringify(picksData)));
                                    setIsEditingTeam(true);
                                }}
                                className="w-full py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                            >
                                Continue anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FPL Login Modal */}
            {showFplLoginModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full space-y-5 text-center shadow-2xl">
                        <div className="w-12 h-12 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center justify-center mx-auto">
                            <span className="text-2xl">🔗</span>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-white font-black text-lg">Connect Your FPL Account</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Log in to your <span className="text-white font-semibold">{entryData?.name ?? 'FPL team'}</span> on{' '}
                                <span className="text-fpl-green">fantasy.premierleague.com</span>, then return here to execute the plan.
                            </p>
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={() => { window.open('https://fantasy.premierleague.com/', '_blank'); setShowFplLoginModal(false); }}
                                className="w-full py-3 bg-fpl-green text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl hover:bg-fpl-green/90 transition-all"
                            >
                                Open fantasy.premierleague.com
                            </button>
                            <button
                                onClick={() => setShowFplLoginModal(false)}
                                className="w-full py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PitchView;
