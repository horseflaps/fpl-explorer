import type { FPLResponse, EntryPicksResponse, Entry } from '../types/fpl';

const ARCHETYPE_DIRECTIVES: Record<string, { strategy: string; logic: string; tone: string; captain: string; hitRule: string }> = {
    maverick: {
        strategy: 'High-Risk / High-Reward. Prioritise players with <10% ownership. Chase upside over safety.',
        logic: 'Ignore Effective Ownership (EO). Actively look for differential captains to swing mini-leagues. Embrace variance.',
        tone: 'The Hype-Man. Energetic, bold, and slightly rebellious. Use phrases like "Fortune favors the bold." Celebrate the differential pick.',
        captain: 'Captain MUST be a differential — ownership below 15% strongly preferred. Only recommend a high-ownership captain if there is literally no viable differential with a good fixture. Explain the differential upside explicitly.',
        hitRule: 'This manager embraces hits. A -4 or even -8 is on the table if the EV case is strong. Do not shy away from recommending one.',
    },
    spreadsheet: {
        strategy: 'Data-Driven / EV Focused. Prioritise xG, xA, and 5-week fixture difficulty (FDR).',
        logic: 'Ignore form if underlying stats are good. Use Expected Value (EV) to justify hits. Trust the model above all else.',
        tone: 'The Analyst. Cold, calculated, and precise. Use terminology like "statistically significant" and "regression to the mean."',
        captain: 'Captain must be justified purely by xG, xA, and fixture difficulty — not narrative or form. State the underlying stats that support the pick. Never recommend a captain on "vibes" alone.',
        hitRule: 'Recommend a hit only if the EV calculation clearly supports it. Show the maths: expected points gain minus 4. If EV is positive, recommend it. If not, hold.',
    },
    template: {
        strategy: 'Low-Risk / Rank Protection. Prioritise players with >40% ownership. Never let a rank-killer hurt us.',
        logic: 'Follow the pack. Avoid points hits unless 2+ players are red-flagged. Safety and consistency are the goals.',
        tone: 'The Guardian. Protective, cautious, and steady. Use phrases like "Hold the line" and "Safety first."',
        captain: 'Captain MUST have ownership above 30%. Never recommend a differential captain to this manager — the risk of a rank-damaging blank outweighs any potential gain. Safety is the priority.',
        hitRule: 'Strongly avoid hits. Only recommend one if 2 or more players are injured/suspended with no bench cover. A hit is a last resort, not a strategy.',
    },
    kneejerk: {
        strategy: 'Form-Chasing / Reactive. Prioritise top scorers from the last two weeks. Follow the momentum.',
        logic: 'Focus on price rises and immediate momentum. If a player blanks twice they are dead weight. Move fast.',
        tone: 'The Scout. Urgent, fast-paced, and opportunistic. Use phrases like "Strike while the iron is hot" and "Don\'t miss the train."',
        captain: 'Captain must be the hottest player in the squad right now — scored or assisted in the last 2 GWs. Momentum is everything. Back the in-form player regardless of ownership.',
        hitRule: 'Hits are acceptable to chase in-form players. If a top scorer from last week is not in the squad and fixtures are good, a -4 to bring them in is justified. Act fast before the price rises.',
    },
    eyetest: {
        strategy: 'Intuition / Tactical. Prioritise heatmaps and role on the pitch (e.g. is a defender playing as a winger?).',
        logic: 'Ignore luck-based stats. Focus on Out of Position (OOP) assets. Trust the vibe of the game over the numbers.',
        tone: 'The Tactician. Observant, insightful, and old-school. Use phrases like "He looked sharp" and "Passed the eye test."',
        captain: 'Captain should be whoever looked most dangerous on the pitch recently — not whoever has the best xG. Describe WHY they passed the eye test: movement, positioning, involvement. Stats are secondary.',
        hitRule: 'Consider hits only for players who have clearly fallen out of favour or look off the pace visually. Do not recommend a hit based on stats alone — there must be a tactical or visual justification.',
    },
};

export const generateGeminiPrompt = (
    data: FPLResponse,
    picks: EntryPicksResponse,
    entry: Entry,
    history: any,
    transfersAvailable: number,
    news: any[] = [],
    fixtures: any[] = [],
    availableChips: string[] = [],
    managerDna: string | null = null
): string => {
    const getPlayer = (id: number) => data.elements.find(e => e.id === id);
    const getTeam = (id: number) => data.teams.find(t => t.id === id);

    const teamName = entry.name;
    const managerName = `${entry.player_first_name} ${entry.player_last_name}`;
    const overallRank = picks.entry_history.overall_rank;
    const totalPoints = picks.entry_history.total_points;
    const gwPoints = picks.entry_history.points;

    const bank = entry.last_deadline_bank / 10;

    // Build fixture lookup: teamId -> "vs OPP (H/A) FDR:X"
    const fixtureByTeam: Record<number, string[]> = {};
    for (const fix of fixtures) {
        const homeTeam = getTeam(fix.team_h);
        const awayTeam = getTeam(fix.team_a);
        if (!fixtureByTeam[fix.team_h]) fixtureByTeam[fix.team_h] = [];
        if (!fixtureByTeam[fix.team_a]) fixtureByTeam[fix.team_a] = [];
        fixtureByTeam[fix.team_h].push(`vs ${awayTeam?.short_name ?? '?'} (H) FDR:${fix.team_h_difficulty}`);
        fixtureByTeam[fix.team_a].push(`vs ${homeTeam?.short_name ?? '?'} (A) FDR:${fix.team_a_difficulty}`);
    }

    const myPlayers = picks.picks.map(p => {
        const player = getPlayer(p.element);
        const team = player ? getTeam(player.team) : null;
        if (!player || !team) return null;
        const fix = fixtureByTeam[player.team]?.join(' & ') || 'No fixture (blank GW)';
        return {
            name: player.web_name,
            team: team.short_name,
            position: ['?', 'GKP', 'DEF', 'MID', 'FWD'][player.element_type],
            squad_pos: p.position <= 11 ? `XI #${p.position}` : `Bench #${p.position - 11}`,
            is_captain: p.is_captain,
            is_vice_captain: p.is_vice_captain,
            cost: player.now_cost / 10,
            form: player.form,
            ep_next: player.ep_next,
            ownership: player.selected_by_percent,
            next_fixture: fix,
            status: player.status === 'a' ? 'Available' : player.status === 'd' ? 'Doubtful' : player.status === 'i' ? 'Injured' : player.status,
        };
    }).filter(Boolean);

    const topMarketTargets = data.elements
        .filter(p => {
            const isMyPlayer = picks.picks.some(pick => pick.element === p.id);
            return !isMyPlayer && p.status !== 'u' && p.status !== 'i';
        })
        .sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next))
        .slice(0, 20)
        .map(p => {
            const fix = fixtureByTeam[p.team]?.join(' & ') || 'Blank GW';
            return {
                name: p.web_name,
                team: getTeam(p.team)?.short_name || '?',
                pos: ['?', 'GKP', 'DEF', 'MID', 'FWD'][p.element_type],
                cost: p.now_cost / 10,
                ep_next: p.ep_next,
                form: p.form,
                next_fixture: fix,
                sentiment: `+${p.transfers_in_event.toLocaleString()} in / -${p.transfers_out_event.toLocaleString()} out this GW`,
            };
        });

    const chipNameMap: Record<string, string> = {
        wildcard: 'Wildcard',
        freehit: 'Free Hit',
        bboost: 'Bench Boost',
        '3xc': 'Triple Captain',
    };
    const chipsUsedNames = history?.chips?.map((c: any) => chipNameMap[c.name] || c.name).join(', ') || 'None';
    const availableChipNames = availableChips.map(c => chipNameMap[c] || c).join(', ') || 'None remaining';

    const gwsPlayed = history?.current?.length ?? 0;
    const totalHitCost = history?.current?.reduce((sum: number, gw: any) => sum + (gw.event_transfers_cost ?? 0), 0) ?? 0;
    const totalHitsTaken = totalHitCost / 4;
    const hitFrequency = gwsPlayed > 0 ? (totalHitsTaken / gwsPlayed).toFixed(2) : '0.00';
    const historyContext = gwsPlayed > 0
        ? `This manager has taken ${totalHitsTaken} hit(s) across ${gwsPlayed} GWs this season (${hitFrequency} hits/GW on average).`
        : 'No seasonal history available yet.';

    let toneInstruction = '';
    if (overallRank < 10000) {
        toneInstruction = 'TONE: ELITE RESPECT. Top 10k. Treat as a peer. Focus on marginal gains only. Professional and concise.';
    } else if (overallRank < 100000) {
        toneInstruction = 'TONE: ENCOURAGING BUT FIRM. Top 100k. Acknowledge the good season, push them further. Minimal banter.';
    } else if (overallRank < 1000000) {
        toneInstruction = 'TONE: STANDARD WOLF BANTER. Top 1M. Sarcastic and aggressive. Roast the mistakes but help them climb.';
    } else {
        toneInstruction = 'TONE: ROAST MODE. Rank >1M. Be ruthless. Mock bad picks. But still give 1-2 genuinely useful tips.';
    }

    const newsContext = news.length > 0
        ? `**REAL-WORLD NEWS & GOSSIP:**\n${news.map(n => `- [${n.source}] ${n.title}: ${n.summary}`).join('\n')}`
        : 'No specific news available.';

    return `
You are the **Fantasy Premier Wolf** — an elite, aggressive FPL strategist with zero tolerance for bad decisions.
Analyse this team and produce a CONCRETE, EXECUTABLE plan for GW${picks.entry_history.event + 1}.
${toneInstruction}

**MANAGER:**
- Team: ${teamName} | Manager: ${managerName}
- Overall Rank: ${overallRank.toLocaleString()} | Total Points: ${totalPoints} | GW Points: ${gwPoints}

**CURRENT SQUAD (positions 1-11 are starting XI, 12-15 are bench):**
${JSON.stringify(myPlayers, null, 2)}

**FINANCES:**
- Bank: £${bank}m
- Free Transfers Available Next GW: ${transfersAvailable}
- Taking a hit costs 4 points per additional transfer
- Chips Used: ${chipsUsedNames}
- **Chips Still Available: ${availableChipNames}**

**TOP BUY TARGETS (not in squad, sorted by ep_next):**
${JSON.stringify(topMarketTargets, null, 2)}

${newsContext}

${managerDna && ARCHETYPE_DIRECTIVES[managerDna] ? `**MANAGER DNA: ${managerDna.toUpperCase()}**
This manager has been profiled. Every recommendation — transfers, captain, hits, tone — MUST reflect their archetype:
- **Strategic Directive**: ${ARCHETYPE_DIRECTIVES[managerDna].strategy}
- **Wolf Logic**: ${ARCHETYPE_DIRECTIVES[managerDna].logic}
- **Tone of Voice**: ${ARCHETYPE_DIRECTIVES[managerDna].tone}
- **Captain Rule**: ${ARCHETYPE_DIRECTIVES[managerDna].captain}
- **Hit Rule**: ${ARCHETYPE_DIRECTIVES[managerDna].hitRule}
- **Seasonal Hit Pattern**: ${historyContext} Use this to calibrate your hit recommendation — does it fit their established behaviour or are you pushing them out of their comfort zone?` : `**SEASONAL HIT PATTERN**: ${historyContext}`}

**LANGUAGE: Do not use profanity, slurs, or offensive language under any circumstances.**

**MANDATORY RULES — VIOLATIONS MAKE THE PLAN INVALID:**
1. **Budget**: For each transfer, [buy_price] ≤ [sell_price of outgoing player] + [bank]. The bank updates after each transfer. DO THE MATHS.
2. **Squad Legality**: After all transfers, squad must still be valid (max 3 from same club, correct position counts: 2 GKP, 5 DEF, 5 MID, 3 FWD).
3. **Blank GWs**: Do NOT recommend buying a player who has "No fixture (blank GW)" unless using Free Hit chip.
4. **Hits**: Only recommend extra transfers (hits, -4pts each) if the expected gain clearly outweighs the cost. Justify explicitly.
5. **Chip Logic**: Only recommend a chip if conditions genuinely warrant it (e.g. Bench Boost only if bench is strong, Triple Captain only if standout double-GW captain, Free Hit only for a severe blank/double GW). Do not force chips.
6. **Feasibility**: Every player you recommend buying MUST appear in the TOP BUY TARGETS list above (since that is the only price data you have). Do not invent players.

**OUTPUT FORMAT:**

## 🐺 THE WOLF'S VERDICT
(Brief roast/praise of the team situation in 2-3 sentences)

## 📋 THE PLAN
State the exact plan clearly:
- **Transfers**: list each one as "[OUT] (£X.Xm) → [IN] (£X.Xm)"
- **Hits taken**: X (-Xpts)
- **Bank after**: £X.Xm
- **Chip**: [chip name] OR None
- **Captain**: [Name] | **Vice-Captain**: [Name]
- **Why this captain**: (one line)
- **DNA Reasoning**: (one line — how does this captain pick reflect the manager's archetype?)

## 🔍 PLAYER-BY-PLAYER BREAKDOWN
For each transfer OUT: why they're being dropped (fixture, form, injury, price)
For each transfer IN: why they're being brought in (fixture, ep_next, form, value)

## ⚠️ RISKS & ALTERNATIVES
What could go wrong, and backup options if budget is tighter.

---WOLF_PLAN_JSON---
Output a single JSON object on ONE line (no line breaks inside) with this exact structure:
{"transfers":[{"out_name":"EXACT_WEB_NAME","in_name":"EXACT_WEB_NAME","sell_price":0.0,"buy_price":0.0}],"chip":null,"captain":"EXACT_WEB_NAME","vice_captain":"EXACT_WEB_NAME","hits_taken":0,"bank_after":0.0}

Rules for the JSON:
- Use EXACT web_name values from the squad/targets data above (copy-paste, do not paraphrase)
- chip must be one of: null, "wildcard", "freehit", "bboost", "3xc"
- If no transfers, use empty array []
- Output ONLY the JSON on that line, nothing else after the JSON
---END_WOLF_PLAN---
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
            headers: { 'Content-Type': 'application/json' },
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
            return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis generated.';
        }
        return data.text || 'No analysis generated.';
    } catch (error: any) {
        console.error('Fetch Error:', error);
        throw new Error(error.message || 'Network Error');
    }
};
