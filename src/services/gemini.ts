import type { FPLResponse, EntryPicksResponse, Entry } from '../types/fpl';

export const generateGeminiPrompt = (
    data: FPLResponse,
    picks: EntryPicksResponse,
    entry: Entry,
    history?: any
): string => {
    // Helpers
    const getPlayer = (id: number) => data.elements.find(e => e.id === id);
    const getTeam = (id: number) => data.teams.find(t => t.id === id);

    const myPlayers = picks.picks.map(p => {
        const player = getPlayer(p.element);
        const team = player ? getTeam(player.team) : null;
        return player && team ? {
            name: player.web_name,
            team: team.short_name,
            position: ['?', 'GKP', 'DEF', 'MID', 'FWD'][player.element_type],
            cost: player.now_cost / 10,
            form: player.form,
            xG: player.expected_goals,
            xA: player.expected_assists,
            ownership: player.selected_by_percent,
            sentiment: `In: ${player.transfers_in_event.toLocaleString()} | Out: ${player.transfers_out_event.toLocaleString()}`
        } : null;
    }).filter(Boolean);

    const bank = entry.last_deadline_bank / 10;
    const currentGw = picks.entry_history.event;

    // Get Top Market Targets (to help AI know prices and trends)
    const topMarketTargets = data.elements
        .filter(p => {
            const isMyPlayer = picks.picks.some(pick => pick.element === p.id);
            return !isMyPlayer && p.status !== 'u' && p.status !== 'i';
        })
        .sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next))
        .slice(0, 15)
        .map(p => ({
            name: p.web_name,
            team: getTeam(p.team)?.short_name || '?',
            pos: ['?', 'GKP', 'DEF', 'MID', 'FWD'][p.element_type],
            cost: p.now_cost / 10,
            ep_next: p.ep_next,
            sentiment: `+${p.transfers_in_event.toLocaleString()} this GW`
        }));

    // Estimate Free Transfers (FT)
    let estimatedFT = 1;
    if (history && history.current) {
        const prevGwIndex = history.current.findIndex((h: any) => h.event === currentGw) - 1;
        if (prevGwIndex >= 0) {
            const prevGw = history.current[prevGwIndex];
            if (prevGw.event_transfers === 0) {
                estimatedFT = 2;
                // Since FPL 2024/25 allows rolling up to 5 FTs, we'll keep it simple for now
            }
        }
    }

    const transfersMadeThisWeek = picks.entry_history.event_transfers || 0;
    const netFT = Math.max(0, estimatedFT - transfersMadeThisWeek);
    const chipsUsed = history?.chips?.map((c: any) => c.name).join(', ') || 'None';

    return `
    You are the **Fantasy Premier Wolf**, an elite, aggressive FPL strategist. 
    Analyze this team for GW${currentGw}. Be direct, confident, and slightly sarcastic/bantery.

    **TEAM DATA:**
    ${JSON.stringify(myPlayers, null, 2)}
    
    **FINANCES:**
    - Current Bank: £${bank}m
    - Available Free Transfers: ${netFT}
    - Chips Played: ${chipsUsed}

    **MARKET DATA (Top Buy Targets & Trends):**
    ${JSON.stringify(topMarketTargets, null, 2)}

    **CRITICAL RULES:**
    1. **Strict Budget**: Any suggested transfer MUST be affordable. [New Player Cost] <= [Sold Player Cost] + [Current Bank].
    2. **Market Sentiment & Template Awareness**:
       - If a player is "Template Essential" (Ownership > 30% AND positive sentiment), do NOT suggest selling them unless they have a severe red injury flag or are suspended. 
       - If you MUST suggest selling a highly-owned player, you must provide a "Meta-Defying" justification.
    3. **Zero Hallucination**: If you suggest a player NOT in the MARKET DATA, assume they are premium (£8.0m+) unless certain.

    **OUTPUT FORMAT (Verified Markdown):**
    
    ## 🚨 TL;DR: Immediate Action
    (Be specific: "Sell [Out] for [In]. Reasons: [Summary].")
    
    **Top Targets to BUY (Affordable Options):**
    1. [Player] (Team) - £Price - Sentiment: [Trending Up/Down] - Why he fits.
    2. [Player] (Team) - £Price - Sentiment: [Trending Up/Down] - Why he fits.

    ## 1. Issues & Fixes
    | Player | Issue | Fix | Priority | Cost Check | Sentiment Check |
    |---|---|---|---|---|---|
    | ... | ... | ... | ... | Affordable? | Essential? |

    ## 2. Captaincy & Strategy
    - Captain: [Name] ([Reason])
    - Strategy: [Attack/Defend Rank] (Acknowledge if you're going against the FPL meta).

    Keep it concise. Use tables. Be a friend who knows that keeping Gabriel is a no-brainer right now.
    `;
};

export const fetchGeminiAnalysis = async (prompt: string, retries = 3, delay = 1000): Promise<string> => {
    const localKey = import.meta.env.VITE_GEMINI_API_KEY;
    const isLocal = !!localKey;
    const url = isLocal
        ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${localKey}`
        : `/api/wolf-analysis`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(isLocal ? {
                contents: [{ parts: [{ text: prompt }] }]
            } : { prompt })
        });

        if (!response.ok) {
            const status = response.status;
            if ((status === 503 || status === 429) && retries > 0) {
                console.warn(`Gemini Proxy overloaded (${status}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchGeminiAnalysis(prompt, retries - 1, delay * 2);
            }

            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            const message = errorData.error?.message || errorData.details || errorData.error || response.statusText;
            throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
        }

        const data = await response.json();
        if (isLocal) {
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated.";
        }
        return data.text || "No analysis generated.";
    } catch (error: any) {
        console.error("Fetch Error:", error);
        throw new Error(error.message || "Network Error");
    }
};
