import type { FPLResponse, EntryPicksResponse, Entry } from '../types/fpl';

export const generateGeminiPrompt = (
    data: FPLResponse,
    picks: EntryPicksResponse,
    entry: Entry
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
            position: ['?', 'GKP', 'DEF', 'MID', 'FWD'][player.element_type], // element_type is 1-based
            cost: player.now_cost / 10,
            form: player.form,
            xG: player.expected_goals,
            xA: player.expected_assists,
            fixtures: 'Check fixture difficulty', // Simplified for prompt size
            ownership: player.selected_by_percent
        } : null;
    }).filter(Boolean);

    const bank = entry.last_deadline_bank / 10;

    // Note: FPL API 'chips' requires fetching entry history separately.
    // For now, we'll ask the AI to suggest generic chip strategy.
    const currentGw = picks.entry_history.event;

    return `
    You are the **Fantasy Premier Wolf**. 
    You are an elite, aggressive FPL strategist who doesn't suffer fools gladly. 
    Analyze this team for GW${currentGw}. Be direct, confident, and bantery.

    **TEAM DATA:**
    ${JSON.stringify(myPlayers, null, 2)}
    Bank: £${bank}m

    **CONTEXT:**
    - The user MAY have 2 Free Transfers (FT). If so, suggest aggressive moves.
    - The user MAY have Chips (Wildcard, Free Hit) available.
    - **CRITICAL RULE:** Maximum of 3 players from any single Premier League team. Do not suggest transfers that violate this.

    **OUTPUT FORMAT (Verified Markdown):**
    
    ## 🚨 TL;DR: Immediate Action
    (Specific Advice: "Transfer OUT [Player] for [Player] immediately.")
    
    **Top Targets to BUY (Form/Stats Best):**
    1.  [Player Name] (Team) - £Price - Reason
    2.  [Player Name] (Team) - £Price - Reason

    ## 1. Chip Strategy
    - **Usage Advice:** Should I use a chip this week? (Yes/No/Maybe).
    - **Contingency:** IF I have a Wildcard/Free Hit, here is a recommended "Ideal Team" draft for this week:
      (List GKP, DEF, MID, FWD core if applicable).

    ## 2. Issues & Fixes
    (Use a table. COLUMNS: Player, Issue, Recommended Fix, Priority).
    | Player | Issue | Fix | Priority |
    |---|---|---|---|
    | ... | ... | ... | ... |

    ## 3. Captaincy
    (Top pick + Risk level).

    Keep it concise. No fluff. Use tables for data. Make it slightly sarcastic, and mildy insulting like in the style of banter between good friends
    `;
};

export const fetchGeminiAnalysis = async (prompt: string, retries = 3, delay = 1000): Promise<string> => {
    // 1. Check for Local Development Key
    const localKey = import.meta.env.VITE_GEMINI_API_KEY;

    // If we have a local key, call Google directly (useful for npm run dev)
    // Otherwise, use the secure production proxy
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
            // Retry on 503 (Service Unavailable) or 429 (Too Many Requests - if strictly temporary)
            if ((status === 503 || status === 429) && retries > 0) {
                console.warn(`Gemini Proxy overloaded (${status}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchGeminiAnalysis(prompt, retries - 1, delay * 2);
            }

            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            console.error("Gemini Proxy Error Details:", errorData);

            // Extracts message from Google API format { error: { message: "..." } } 
            // or Proxy format { error: "...", details: "..." }
            const message = errorData.error?.message || errorData.details || errorData.error || response.statusText;
            throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
        }

        const data = await response.json();

        // Handle both direct Google response (local) and Proxy response (prod)
        if (isLocal) {
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated.";
        }
        return data.text || "No analysis generated.";
    } catch (error: any) {
        console.error("Fetch Error:", error);
        throw new Error(error.message || "Network Error");
    }
};
