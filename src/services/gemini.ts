import type { FPLResponse, EntryPicksResponse, Entry, Player, Team } from '../types/fpl';

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
            position: ['GKP', 'DEF', 'MID', 'FWD'][player.element_type],
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
    You are an elite FPL manager. Analyze this team for GW${currentGw}.

    **TEAM DATA:**
    ${JSON.stringify(myPlayers, null, 2)}
    Bank: £${bank}m

    **OUTPUT FORMAT (Verified Markdown):**
    
    ## 🚨 TL;DR: Immediate Action
    (One sentence: What is the SINGLE most important move?)

    ## 1. Chip Strategy
    (Assume standard chips available: Wildcard, Free Hit, Bench Boost, Triple Captain. Recommend IF indispensable this week).

    ## 2. Issues & Fixes
    (Use a table. COLUMNS: Player, Issue, Recommended Fix, Priority).
    | Player | Issue | Fix | Priority |
    |---|---|---|---|
    | ... | ... | ... | ... |

    ## 3. Captaincy
    (Top pick + Risk level).

    Keep it concise. No fluff. Use tables for data.
    `;
};

export const fetchGeminiAnalysis = async (apiKey: string, prompt: string): Promise<string> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
            console.error("Gemini API Error Details:", errorData);
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated.";
    } catch (error: any) {
        console.error("Fetch Error:", error);
        throw new Error(error.message || "Network Error");
    }
};
