import type { FPLResponse, EntryPicksResponse, Entry } from '../types/fpl';

const ARCHETYPE_DIRECTIVES: Record<string, { strategy: string; logic: string; tone: string; captain: string; hitRule: string }> = {
    maverick: {
        strategy: 'High-Risk / High-Reward. Prioritise players with <10% ownership. Chase upside over safety.',
        logic: 'Ignore Effective Ownership (EO). Actively look for differential captains to swing mini-leagues. Embrace variance.',
        tone: 'The Hype-Man. Energetic, bold, and slightly rebellious. Use phrases like "Fortune favors the bold." Celebrate the differential pick.',
        captain: 'Prefer a differential captain (ownership <15%) where there is a credible case. However, if there is a standout player dominating in goals and assists, back them — just frame it as "even a Maverick knows when to take the obvious pick." Always explain the differential angle even if you go with the safe choice.',
        hitRule: 'This manager embraces hits. A -4 or even -8 is on the table if the EV case is strong. Do not shy away from recommending one.',
    },
    spreadsheet: {
        strategy: 'Data-Driven / EV Focused. Prioritise xG, xA, and 5-week fixture difficulty (FDR).',
        logic: 'Ignore form if underlying stats are good. Use Expected Value (EV) to justify hits. Trust the model above all else.',
        tone: 'The Analyst. Cold, calculated, and precise. Use terminology like "statistically significant" and "regression to the mean."',
        captain: 'Justify the captain pick with xG, xA, and fixture difficulty data. If a player is the standout choice, back them — but always show the numbers behind the decision. Avoid narrative-driven picks; let the stats speak.',
        hitRule: 'Recommend a hit only if the EV calculation clearly supports it. Show the maths: expected points gain minus 4. If EV is positive, recommend it. If not, hold.',
    },
    template: {
        strategy: 'Low-Risk / Rank Protection. Prioritise players with >40% ownership. Never let a rank-killer hurt us.',
        logic: 'Follow the pack. Avoid points hits unless 2+ players are red-flagged. Safety and consistency are the goals.',
        tone: 'The Guardian. Protective, cautious, and steady. Use phrases like "Hold the line" and "Safety first."',
        captain: 'Lean toward the high-ownership, in-form captain to protect rank. If a player is the clear standout week after week, that is the pick — frame it as "the pack is right for a reason." Only consider a differential if the form case for the obvious pick has genuinely collapsed.',
        hitRule: 'Strongly avoid hits. Only recommend one if 2 or more players are injured/suspended with no bench cover. A hit is a last resort, not a strategy.',
    },
    kneejerk: {
        strategy: 'Form-Chasing / Reactive. Prioritise top scorers from the last two weeks. Follow the momentum.',
        logic: 'Focus on price rises and immediate momentum. If a player blanks twice they are dead weight. Move fast.',
        tone: 'The Scout. Urgent, fast-paced, and opportunistic. Use phrases like "Strike while the iron is hot" and "Don\'t miss the train."',
        captain: 'Back whoever is in the best form right now. If someone has been scoring week in week out, they are the captain — full stop. Momentum matters more than ownership or fixtures to this manager.',
        hitRule: 'Hits are acceptable to chase in-form players. If a top scorer from last week is not in the squad and fixtures are good, a -4 to bring them in is justified. Act fast before the price rises.',
    },
    eyetest: {
        strategy: 'Intuition / Tactical. Prioritise heatmaps and role on the pitch (e.g. is a defender playing as a winger?).',
        logic: 'Ignore luck-based stats. Focus on Out of Position (OOP) assets. Trust the vibe of the game over the numbers.',
        tone: 'The Tactician. Observant, insightful, and old-school. Use phrases like "He looked sharp" and "Passed the eye test."',
        captain: 'Back whoever looked most dangerous on the pitch recently. If a player is clearly dominating games visually — movement, involvement, chances created — that is enough. Stats can support the case but should not override what the eye is telling you.',
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
    managerDna: string | null = null,
    recentlyExecuted: { transfers: { out_name: string; in_name: string }[]; chip: string | null } | null = null,
    transferHistory: { element_in: number; element_out: number; event: number }[] = [],
    lastRecommendedPlan: { transfers: { out_name: string; in_name: string }[]; chip: string | null; captain?: string } | null = null,
    activeChip: string | null = null
): string => {
    const getPlayer = (id: number) => data.elements.find(e => e.id === id);
    const getTeam = (id: number) => data.teams.find(t => t.id === id);

    const teamName = entry.name;
    const managerName = `${entry.player_first_name} ${entry.player_last_name}`;
    const overallRank = picks.entry_history?.overall_rank ?? 0;
    const totalPoints = picks.entry_history?.total_points ?? 0;
    const gwPoints = picks.entry_history?.points ?? 0;

    const bank = entry.last_deadline_bank / 10;

    // Build multi-GW fixture lookup: teamId -> { [gw]: ["vs OPP (H/A) FDR:X", ...] }
    const nextGw = (picks.entry_history?.event ?? 0) + 1;
    const fixtureByTeamGw: Record<number, Record<number, string[]>> = {};
    for (const fix of fixtures) {
        const gw = fix.event ?? nextGw;
        const homeTeam = getTeam(fix.team_h);
        const awayTeam = getTeam(fix.team_a);
        if (!fixtureByTeamGw[fix.team_h]) fixtureByTeamGw[fix.team_h] = {};
        if (!fixtureByTeamGw[fix.team_a]) fixtureByTeamGw[fix.team_a] = {};
        if (!fixtureByTeamGw[fix.team_h][gw]) fixtureByTeamGw[fix.team_h][gw] = [];
        if (!fixtureByTeamGw[fix.team_a][gw]) fixtureByTeamGw[fix.team_a][gw] = [];
        fixtureByTeamGw[fix.team_h][gw].push(`vs ${awayTeam?.short_name ?? '?'} (H) FDR:${fix.team_h_difficulty}`);
        fixtureByTeamGw[fix.team_a][gw].push(`vs ${homeTeam?.short_name ?? '?'} (A) FDR:${fix.team_a_difficulty}`);
    }

    // For next-GW player fixture (used in squad display)
    const fixtureByTeam: Record<number, string[]> = {};
    for (const [teamId, gwMap] of Object.entries(fixtureByTeamGw)) {
        fixtureByTeam[Number(teamId)] = gwMap[nextGw] ?? [];
    }

    // Build DGW/BGW schedule summary for the prompt (next 4 GWs)
    const gwRange = [nextGw, nextGw + 1, nextGw + 2, nextGw + 3].filter(gw => gw <= 38);
    const allTeams = data.teams;
    const scheduleLines: string[] = [];
    for (const gw of gwRange) {
        const dgwTeams: string[] = [];
        const bgwTeams: string[] = [];
        for (const team of allTeams) {
            const gwFixtures = fixtureByTeamGw[team.id]?.[gw] ?? [];
            if (gwFixtures.length === 0) bgwTeams.push(team.short_name);
            else if (gwFixtures.length >= 2) dgwTeams.push(`${team.short_name}(${gwFixtures.join(', ')})`);
        }
        const dgwNote = dgwTeams.length > 0 ? ` 🟢 DGW: ${dgwTeams.join(' | ')}` : '';
        const bgwNote = bgwTeams.length > 0 ? ` 🔴 BGW: ${bgwTeams.join(', ')}` : '';
        if (dgwNote || bgwNote) scheduleLines.push(`GW${gw}:${dgwNote}${bgwNote}`);
        else scheduleLines.push(`GW${gw}: All teams play (no blanks/doubles)`);
    }
    const fixtureScheduleContext = `**FIXTURE SCHEDULE — NEXT 4 GWs (DGW = Double Gameweek, BGW = Blank Gameweek):**
${scheduleLines.join('\n')}

⚠️ DGW planning: If a team has a Double Gameweek in GW${nextGw + 1} or beyond, it is often worth bringing in their players NOW (spending a transfer this GW) to own them for double the fixtures. Premium DGW assets with good form are especially valuable. Flag any upcoming DGWs in your recommendation.
⚠️ BGW planning: Players from teams with a blank gameweek will score 0 — consider holding/benching them or using Free Hit chip if 5+ starters are blanking.`;

    const myPlayers = picks.picks.map(p => {
        const player = getPlayer(p.element);
        const team = player ? getTeam(player.team) : null;
        if (!player || !team) return null;
        // Build multi-GW fixture summary for this player (shows DGWs clearly)
        const multiFixture = gwRange.map(gw => {
            const gwFix = fixtureByTeamGw[player.team]?.[gw] ?? [];
            if (gwFix.length === 0) return `GW${gw}:BLANK`;
            if (gwFix.length >= 2) return `GW${gw}:DGW(${gwFix.join(' & ')})`;
            return `GW${gw}:${gwFix[0]}`;
        }).join(' | ');
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
            last_gw_pts: player.event_points,
            ownership: player.selected_by_percent,
            fixtures: multiFixture,
            status: player.status === 'a' ? 'Available' : player.status === 'd' ? 'Doubtful' : player.status === 'i' ? 'Injured' : player.status,
        };
    }).filter(Boolean);

    // Build per-club headcount for current squad (used for 3-per-club rule enforcement)
    const squadClubCount: Record<number, number> = {};
    for (const p of picks.picks) {
        const player = getPlayer(p.element);
        if (player) squadClubCount[player.team] = (squadClubCount[player.team] ?? 0) + 1;
    }

    // Human-readable club distribution for the prompt
    const squadClubSummary = Object.entries(squadClubCount)
        .sort(([, a], [, b]) => b - a)
        .map(([teamId, count]) => {
            const teamName = getTeam(Number(teamId))?.short_name ?? `Team${teamId}`;
            const atLimit = count >= 3 ? ' ← AT LIMIT (max 3)' : '';
            return `${teamName}: ${count}${atLimit}`;
        })
        .join(', ');

    const topMarketTargets = data.elements
        .filter(p => {
            const isMyPlayer = picks.picks.some(pick => pick.element === p.id);
            return !isMyPlayer && p.status !== 'u' && p.status !== 'i';
        })
        .sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next))
        .slice(0, 20)
        .map(p => {
            const ownedFromClub = squadClubCount[p.team] ?? 0;
            const clubBlocked = ownedFromClub >= 3 ? ' ⛔ BLOCKED (3/3 from this club already)' : ownedFromClub === 2 ? ' ⚠️ CAUTION (2/3 from this club)' : '';
            const multiFixture = gwRange.map(gw => {
                const gwFix = fixtureByTeamGw[p.team]?.[gw] ?? [];
                if (gwFix.length === 0) return `GW${gw}:BLANK`;
                if (gwFix.length >= 2) return `GW${gw}:DGW(${gwFix.join(' & ')})`;
                return `GW${gw}:${gwFix[0]}`;
            }).join(' | ');
            return {
                name: p.web_name,
                team: getTeam(p.team)?.short_name || '?',
                pos: ['?', 'GKP', 'DEF', 'MID', 'FWD'][p.element_type],
                cost: p.now_cost / 10,
                ep_next: p.ep_next,
                form: p.form,
                fixtures: multiFixture,
                club_rule: ownedFromClub === 0 ? 'OK' : `${ownedFromClub}/3 owned${clubBlocked}`,
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
    if (overallRank === 0) {
        toneInstruction = 'TONE: WELCOMING. Brand new team with no rank yet. Be encouraging and focus on setting up a strong squad for the season ahead.';
    } else if (overallRank < 10000) {
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

    // Detect if the squad was recently rebuilt (wildcard played this season within last 2 GWs, or 4+ transfers made in last 1 GW)
    const currentEvent = picks.entry_history?.event ?? 0;
    const lastGwTransferCount = transferHistory.filter(t => t.event === currentEvent).length;
    const wildcardPlayedThisGw = history?.chips?.some((c: any) => c.name === 'wildcard' && c.event === currentEvent);
    const wildcardPlayedLastGw = history?.chips?.some((c: any) => c.name === 'wildcard' && c.event === currentEvent - 1);
    const squadWasRecentlyRebuilt = wildcardPlayedThisGw || wildcardPlayedLastGw || lastGwTransferCount >= 4 || (recentlyExecuted && (recentlyExecuted.chip === 'wildcard' || recentlyExecuted.transfers.length >= 4));

    // Rank-based urgency escalation injected into chip/hit rules
    let rankUrgency: string;
    if (squadWasRecentlyRebuilt) {
        rankUrgency = `RANK CONTEXT: This squad was RECENTLY REBUILT (${wildcardPlayedThisGw || wildcardPlayedLastGw ? 'Wildcard played' : `${lastGwTransferCount} transfers made`} in the last 1-2 GWs). Do NOT judge this team by its old rank. Assess the CURRENT squad on its merits — the players in it now were chosen deliberately. The rank will recover as the new squad scores points. HOLD if the squad is strong. Only recommend changes if there is a clear immediate problem (injury, blank GW, glaring weak link). A "no changes needed" verdict is the correct call if the squad looks solid.`;
    } else if (overallRank === 0) {
        rankUrgency = 'RANK CONTEXT: Brand new team (no rank yet). Play it safe — no hits, no chips unless exceptional circumstances.';
    } else if (overallRank < 100000) {
        rankUrgency = `RANK CONTEXT: Elite rank (${overallRank.toLocaleString()}). Protect position — only recommend a Wildcard if 5+ XI players have FDR ≥ 4. Hits require strong EV case.`;
    } else if (overallRank < 1000000) {
        rankUrgency = `RANK CONTEXT: Good rank (${overallRank.toLocaleString()}). Standard thresholds apply. Wildcard if 5+ XI players have FDR ≥ 4 OR 4+ players are injured/out-of-form. Hits if EV is clearly positive.`;
    } else if (overallRank < 5000000) {
        rankUrgency = `RANK CONTEXT: Poor rank (${overallRank.toLocaleString()}). This manager needs to climb — be more aggressive. LOWER THE WILDCARD THRESHOLD: recommend Wildcard if 4+ starting XI players are out-of-form (form < 3), injured/doubtful, or have FDR ≥ 4. Hits of -4 or even -8 are acceptable if multiple high-EV players are unavailable. Do not play it safe — playing safe at this rank is itself the bad decision.`;
    } else {
        rankUrgency = `RANK CONTEXT: DISASTER ZONE — rank ${overallRank.toLocaleString()}. This team needs emergency surgery, not band-aids. WILDCARD IS THE DEFAULT RECOMMENDATION unless it has already been used — the squad is structurally broken and 2 free transfers will not fix it. If Wildcard is unavailable, recommend the maximum hits (-4, -8, even -12) justified by EV, and consider Free Hit if blanks are an issue. Do NOT play conservatively — conservative play at rank ${overallRank.toLocaleString()} is how you finish the season in the gutter.`;
    }

    // Build recent transfer context (last 3 GWs) to prevent oscillation
    const recentTransfers = transferHistory
        .filter(t => t.event >= currentEvent - 2 && t.event <= currentEvent)
        .sort((a, b) => b.event - a.event);

    // Previous recommended plan context (prevents oscillation on consecutive unexecuted analyses)
    const prevPlanContext = lastRecommendedPlan && lastRecommendedPlan.transfers.length > 0
        ? `**YOUR PREVIOUS RECOMMENDATION (not yet executed — the manager is still deciding):**
${lastRecommendedPlan.transfers.map(t => `  • ${t.out_name} OUT → ${t.in_name} IN`).join('\n')}
${lastRecommendedPlan.chip ? `  Chip: ${lastRecommendedPlan.chip}` : ''}
${lastRecommendedPlan.captain ? `  Captain: ${lastRecommendedPlan.captain}` : ''}

**CONSISTENCY PRINCIPLE:** You made those recommendations because you assessed each outgoing player as a weak link — poor fixture, bad form, injury risk, or poor value. Your assessment of a player's quality does not change between analyses unless something material has happened (new injury, surprise result, fixture change, price shift). If you thought a player was worth dropping an hour ago, you should still think so now unless you can point to a specific change. Flip-flopping your opinion on the same players across consecutive analyses means your original reasoning was wrong — own it and stay consistent, or explain precisely what changed and why it matters.

`
        : '';

    const recentTransfers3 = recentTransfers.slice(0, 12); // cap at 12 to avoid prompt bloat
    const recentlyBoughtIn  = recentTransfers3.map(t => getPlayer(t.element_in)?.web_name  ?? String(t.element_in));
    const recentlySoldOut   = recentTransfers3.map(t => getPlayer(t.element_out)?.web_name ?? String(t.element_out));
    const recentTransferContext = recentTransfers3.length > 0
        ? `**RECENT TRANSFER HISTORY (last 3 GWs — your own deliberate decisions):**
${recentTransfers3.map(t => {
    const pIn = getPlayer(t.element_in);
    const pOut = getPlayer(t.element_out);
    return `  GW${t.event}: ${pOut?.web_name ?? t.element_out} OUT → ${pIn?.web_name ?? t.element_in} IN`;
}).join('\n')}

Your consistency as an analyst depends on standing by these calls:
- ${recentlyBoughtIn.join(', ')} were brought in as deliberate upgrades. Do NOT recommend dropping them unless they are injured, suspended, or their form/fixtures have materially deteriorated.
- ${recentlySoldOut.join(', ')} were sold for a reason — poor form, bad fixtures, or poor value. Do NOT recommend buying them back unless something has concretely changed (new role, fixture swing, price drop that changes value). Simply forgetting why you sold them is not a reason.

`
        : '';

    return `
You are the **Fantasy Premier Wolf** — an elite, aggressive FPL strategist with zero tolerance for bad decisions AND zero tolerance for unnecessary tinkering.
Analyse this team and produce a verdict for GW${(picks.entry_history?.event ?? 0) + 1}. The verdict can be: make changes, OR hold the squad as-is. A "no changes needed" recommendation is valid and correct when the squad is well-structured. Do NOT recommend transfers for the sake of it — unnecessary changes cost points and destroy squad value.
${toneInstruction}

**MANAGER:**
- Team: ${teamName} | Manager: ${managerName}
- Overall Rank: ${overallRank.toLocaleString()} | Total Points: ${totalPoints} | GW Points: ${gwPoints}

${recentlyExecuted && recentlyExecuted.transfers.length > 0 ? `⚠️ **PLAN JUST EXECUTED MOMENTS AGO — YOUR OWN DECISIONS:**
${recentlyExecuted.chip ? `Chip activated: ${recentlyExecuted.chip}` : ''}
${recentlyExecuted.transfers.map(t => `  • ${t.out_name} OUT → ${t.in_name} IN`).join('\n')}

You made these calls. Your reasoning for each:
- Players you transferred OUT (${recentlyExecuted.transfers.map(t => t.out_name).join(', ')}): you assessed them as weak links — poor form, bad fixture, or poor value. That assessment does not expire in 5 minutes. Do NOT recommend bringing any of them back in.
- Players you transferred IN (${recentlyExecuted.transfers.map(t => t.in_name).join(', ')}): you chose these as upgrades. Do NOT recommend dropping them already — they haven't even played yet.
Build forward from this squad. Reversing your own decisions immediately is incoherent.

` : ''}**CURRENT SQUAD (positions 1-11 are starting XI, 12-15 are bench):**
(last_gw_pts = actual points scored in the most recently completed gameweek — weigh this heavily before recommending a transfer out. A player who scored 10+ last GW should have a compelling reason to leave.)
${JSON.stringify(myPlayers, null, 2)}

**SQUAD CLUB DISTRIBUTION (3-per-club rule):**
${squadClubSummary}
Any club marked "← AT LIMIT" means you already own 3 players from them and CANNOT bring in another unless you transfer one OUT first. Any target with ⛔ in club_rule is BLOCKED. Recalculate after each transfer in a multi-transfer plan.

**FINANCES:**
- Bank: £${bank}m
- Free Transfers Available Next GW: ${transfersAvailable}
- Taking a hit costs 4 points per additional transfer
- Chips Used: ${chipsUsedNames}
- **Chips Still Available: ${availableChipNames}**
${activeChip === 'wildcard' ? `
🃏 **WILDCARD IS ACTIVE THIS GAMEWEEK — FULL REBUILD MODE:**
The manager's Wildcard chip is already activated and live RIGHT NOW. This means:
- ALL transfers are FREE — zero hit penalties regardless of how many changes you make.
- You have complete freedom to overhaul the entire squad if needed.
- Do NOT hold back. This is the moment to build the best possible 15-man squad within budget.
- Prioritise players with great fixtures over the next 4–6 GWs, high form, and strong DGW potential.
- Replace every weak link — poor fixture runs, out-of-form players, injured/doubtful players.
- You may recommend up to 15 transfers (a complete squad rebuild) if the squad quality demands it.
- chip in the JSON must be "wildcard" since it is already active.
` : activeChip === 'freehit' ? `
🎯 **FREE HIT IS ACTIVE THIS GAMEWEEK — TEMPORARY REBUILD MODE:**
The manager's Free Hit chip is already activated and live RIGHT NOW. This means:
- ALL transfers are FREE this gameweek only — the squad reverts to its previous state next week.
- Target players with the very best fixtures THIS gameweek specifically (DGW players, FDR ≤ 2).
- Do not worry about long-term squad balance — optimise purely for this gameweek's points.
- chip in the JSON must be "freehit" since it is already active.
` : ''}

**TOP BUY TARGETS (not in squad, sorted by ep_next):**
${JSON.stringify(topMarketTargets, null, 2)}

${fixtureScheduleContext}

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

${prevPlanContext}${recentTransferContext}**MANDATORY RULES — VIOLATIONS MAKE THE PLAN INVALID:**
1. **Budget**: For each transfer, [buy_price] ≤ [sell_price of outgoing player] + [bank]. The bank updates after each transfer. DO THE MATHS.
2. **Position Match**: EVERY transfer must be position-for-position. GKP → GKP only. DEF → DEF only. MID → MID only. FWD → FWD only. This applies even during a wildcard. Check the "position" field of BOTH the outgoing player (from CURRENT SQUAD) and the incoming player (from TOP BUY TARGETS) — they MUST match. A transfer that swaps positions (e.g. DEF out → GKP in) is ILLEGAL and will be rejected. Count your position totals before and after: must remain 2 GKP, 5 DEF, 5 MID, 3 FWD.
3. **Squad Legality**: After all transfers, squad must still be valid (max 3 from same club, correct position counts: 2 GKP, 5 DEF, 5 MID, 3 FWD). Use the SQUAD CLUB DISTRIBUTION above. For each proposed transfer IN, check the target's club headcount AFTER accounting for any transfers OUT from the same club earlier in the same plan. Any target marked ⛔ BLOCKED cannot be bought unless a player from that same club is transferred OUT first in the same plan — re-check after each move.
4. **Blank GWs**: Do NOT recommend buying a player who has "No fixture (blank GW)" unless using Free Hit chip.
5. **Hits**: Calibrate to rank (see RANK CONTEXT above). For poor/disaster ranks, hits are a recovery tool, not a last resort — justify the EV but lean toward taking them.
6. **Chip Logic**: Thresholds scale with rank (see RANK CONTEXT above for the specific threshold that applies to THIS manager):
   - **Wildcard**: See RANK CONTEXT. For ranks > 5M, this is the DEFAULT recommendation if available. For ranks 1M–5M, lower threshold (4+ poor players). For ranks < 1M, require 5+ XI players with FDR ≥ 4.
   - **Free Hit**: Only if 5+ starting XI players have "No fixture (blank GW)" next gameweek.
   - **Bench Boost**: Only if at least 3 bench players have good fixtures (FDR ≤ 3) and are likely to start.
   - **Triple Captain**: Only if there is a standout player with a double gameweek or FDR ≤ 2 home fixture.
   - If chip conditions are NOT met for this rank tier, chip = null. Do not force chips outside their criteria.
7. **Feasibility**: Every player you recommend buying MUST appear in the TOP BUY TARGETS list above (since that is the only price data you have). Do not invent players.
8. **Consistent Player Assessment**: Your opinion of a player's quality must be stable between analyses. If you assessed a player as a weak link worth dropping, that assessment stands unless something material changed (injury news, fixture reshuffle, form reversal, price change). Recommending opposite actions on the same player across back-to-back analyses is not strategy — it is noise. If your view has genuinely changed, state the specific reason explicitly in your reasoning.

${rankUrgency}

**DECISION PROCESS — follow this internally before writing output:**
1. Evaluate all relevant factors privately: fixtures, form, injuries, DGWs/BGWs, budget, chip status, rank objectives, recent transfer history.
2. Build an option set: which players to move, which chips to consider, what the captain options are.
3. Assess each option with floor/ceiling/risk framing — not just expected points, but worst-case and best-case outcomes.
4. Choose the plan most aligned to rank trajectory and manager DNA.
5. Identify contingencies: what changes if a key player gets injured before the deadline?
6. THEN write your output. Do NOT reveal raw internal chain-of-thought — output only the structured sections below.

**OUTPUT FORMAT:**

## 🧠 REASONING SUMMARY
Bullet the key factors that drove this recommendation (keep to 4–6 bullets):
- Each bullet = one factor and its implication (e.g. "Salah has FDR ≤ 2 for next 3 GWs → hold")
- Cover: fixture run, form/injury flags, DGW/BGW impact, budget constraints, rank pressure, chip rationale

## 🐺 THE WOLF'S VERDICT
(Brief roast/praise of the team situation in 2-3 sentences, calibrated to manager DNA)

## 📋 THE PLAN
State the exact plan clearly:
- **Transfers**: list ONLY players genuinely being swapped — "[OUT] (£X.Xm) → [IN] (£X.Xm)". Do NOT list players staying in the squad. Do NOT write "PlayerX → PlayerX". If no transfers, write "No transfers".
- **Hits taken**: X (-Xpts)
- **Bank after**: £X.Xm
- **Chip**: [chip name] OR None
- **Captain**: [Name] | **Vice-Captain**: [Name]
- **Why this captain**: (one line)
- **DNA Reasoning**: (one line — how does this captain pick reflect the manager's archetype?)

## 🔍 PLAYER-BY-PLAYER BREAKDOWN
For each transfer OUT: why they're being dropped (fixture, form, injury, price)
For each transfer IN: **Floor** (worst realistic outcome) / **Ceiling** (best realistic outcome) / **Risk** (what could go wrong)

## ⚠️ RISKS & CONTINGENCIES
- What could go wrong with this plan?
- **If/Then branches**: "If [player X] is ruled out before the deadline → pivot to [player Y] instead"
- Alternative options if budget is tighter or a target gets injured

## 📅 WATCHLIST & CHECKPOINTS
List 2–4 specific things the manager should monitor before the deadline:
- Injury/fitness updates to check (and when — e.g. "Check Thursday press conference")
- Price rise risks on transfer targets
- Any decisions that should be deferred until more information is available

## ✅ POSITION VERIFICATION (do this before writing the JSON)
Before outputting the JSON, count your transfers by position:
- GKPs out: X | GKPs in: X  → must be equal
- DEFs out: X | DEFs in: X  → must be equal
- MIDs out: X | MIDs in: X  → must be equal
- FWDs out: X | FWDs in: X  → must be equal

If ANY position count doesn't match, REVISE your transfer list now. Remove or replace players until all four position counts balance. A plan where you transfer out 2 MIDs but only bring in 1 MID is ILLEGAL and will be rejected.

---WOLF_PLAN_JSON---
Output a single JSON object on ONE line (no line breaks inside) with this exact structure:
{"transfers":[{"out_name":"EXACT_WEB_NAME","in_name":"EXACT_WEB_NAME","sell_price":0.0,"buy_price":0.0}],"chip":null,"captain":"EXACT_WEB_NAME","vice_captain":"EXACT_WEB_NAME","hits_taken":0,"bank_after":0.0}

Rules for the JSON:
- Use EXACT web_name values from the squad/targets data above (copy-paste, do not paraphrase)
- chip must be one of: null, "wildcard", "freehit", "bboost", "3xc"
- If no transfers needed, use empty array [] — this is a valid and correct output when the squad is already strong
- **CRITICAL: If chip is "wildcard" or "freehit", the transfers array MUST NOT be empty.** Include your top priority player swaps (as many as the TOP BUY TARGETS list allows you to price accurately). A wildcard with zero transfers is invalid — pick the worst players in the squad and replace them with the best available targets within budget.
- Output ONLY the JSON on that line, nothing else after the JSON
---END_WOLF_PLAN---
`;
};

export const fetchGeminiAnalysis = async (prompt: string, token: string, retries = 3, delay = 1000): Promise<string> => {
    // Always go through the server — the Gemini API key lives server-side only.
    // The server checks credits, deducts atomically, then calls Gemini.
    // VITE_GEMINI_API_KEY is kept only as a local dev escape hatch and is never
    // present in production builds.
    const localKey = import.meta.env.VITE_GEMINI_API_KEY;
    const isLocal = !!localKey;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);

    try {
        let response: Response;
        if (isLocal) {
            // Local dev only — calls Gemini directly (key not in production bundle)
            response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${localKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 65536 } }),
                }
            );
        } else {
            // Production — server handles credit check + deduction + Gemini call
            response = await fetch('/api/wolf-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                signal: controller.signal,
                body: JSON.stringify({ prompt }),
            });
        }
        clearTimeout(timeout);

        if (!response.ok) {
            const status = response.status;
            if ((status === 503 || status === 429) && retries > 0) {
                console.warn(`Wolf analysis overloaded (${status}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchGeminiAnalysis(prompt, token, retries - 1, delay * 2);
            }
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            const message = errorData.error?.message || errorData.details || errorData.error || response.statusText;
            throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
        }

        const data = await response.json();
        if (isLocal) {
            return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis generated.';
        }
        return data.result || 'No analysis generated.';
    } catch (error: any) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') throw new Error('Analysis timed out after 3 minutes. Please try again.');
        throw new Error(error.message || 'Network Error');
    }
};
