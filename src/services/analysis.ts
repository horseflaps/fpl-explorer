import type { FPLResponse, EntryPicksResponse, Entry, Player, Team } from '../types/fpl';

export interface AnalysisResult {
    eoTrap: {
        riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
        players: Player[];
        description: string;
    };
    sustainability: {
        overperforming: Player[];
        underperforming: Player[];
        description: string;
    };
    fixtureNuance: {
        favorable: { player: Player, opponent: Team }[];
        difficult: { player: Player, opponent: Team }[];
        description: string;
    };
    verdict: {
        buy: { player: Player, reason: string } | null;
        sell: { player: Player, reason: string } | null;
        captain: { player: Player, safety: 'Safe' | 'Risky' } | null;
        strategy: 'Protect Rank' | 'Attack Rank' | 'Consolidate';
    };
}

export const analyzeTeam = (
    data: FPLResponse,
    picks: EntryPicksResponse,
    _entry: Entry
): AnalysisResult => {
    // Helper to get player by ID
    const getPlayer = (id: number) => data.elements.find(e => e.id === id);
    const getTeam = (id: number) => data.teams.find(t => t.id === id);

    const myPlayerIds = new Set(picks.picks.map(p => p.element));


    // 1. EO Trap Analysis
    // Identify high ownership players NOT in my team
    const eoThreshold = 30.0;
    const dangerousPlayers = data.elements
        .filter(p => !myPlayerIds.has(p.id) && parseFloat(p.selected_by_percent) > eoThreshold)
        .sort((a, b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))
        .slice(0, 3);

    const eoRiskLevel = dangerousPlayers.length > 2 ? 'HIGH' : dangerousPlayers.length > 0 ? 'MEDIUM' : 'LOW';
    const eoDescription = dangerousPlayers.length > 0
        ? `You are missing high-ownership assets like ${dangerousPlayers[0].web_name}. If they haul, your rank will suffer.`
        : "You have excellent coverage of the 'template' players. Your rank is relatively safe from massive swings.";

    // 2. Sustainability Check (xGI vs Actual)
    // Heuristic: Check Form vs ICT Index or xG/xA if available
    const myPlayers = picks.picks.map(p => getPlayer(p.element)).filter((p): p is Player => !!p);

    // Simple heuristic: If goals > xG significantly -> Overperforming
    const overperforming = myPlayers.filter(p => {
        const xG = parseFloat(p.expected_goals);
        return p.goals_scored > (xG + 2); // lenient threshold
    });

    const underperforming = myPlayers.filter(p => {
        const xG = parseFloat(p.expected_goals);
        return p.goals_scored < (xG - 1) && xG > 2; // have good stats but low output
    });

    const sustDescription = underperforming.length > 0
        ? `${underperforming[0].web_name} is underperforming their underlying stats. Hold them, returns are likely due.`
        : "Your team is performing roughly as expected given the underlying data.";

    // 3. Fixture Nuance
    // Use ep_next (Expected Points) as a proxy for fixture + form favorability
    // Filter for my players with high ep_next
    const favorableFixtures = myPlayers
        .sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next))
        .slice(0, 3)
        .map(p => ({ player: p, opponent: getTeam(data.events.find(e => e.is_next)?.id || 1)! })); // Simplified opponent fetch for now

    // 4. The Verdict
    // Buy Recommendation: Highest form/xGI player not in team that we can afford (rough heuristic)
    // We don't have exact sell price, so assume we have 'currentBank' + minimal sell price.
    // Let's just suggest the best player not in team.
    const potentialBuys = data.elements
        .filter(p => !myPlayerIds.has(p.id))
        .sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next));

    const buyRec = potentialBuys.length > 0 ? {
        player: potentialBuys[0],
        reason: `High expected points (${potentialBuys[0].ep_next}) for next GW.`
    } : null;

    // Sell Rec: Lowest projected points in starting XI
    const potentialSells = myPlayers
        .sort((a, b) => parseFloat(a.ep_next) - parseFloat(b.ep_next));

    const sellRec = potentialSells.length > 0 ? {
        player: potentialSells[0],
        reason: `Low expected points (${potentialSells[0].ep_next}) and tough fixtures.`
    } : null;

    // Captain Rec
    const captainChoice = myPlayers.sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next))[0];
    const captainSafety = parseFloat(captainChoice.selected_by_percent) > 30 ? 'Safe' : 'Risky';

    return {
        eoTrap: {
            riskLevel: eoRiskLevel,
            players: dangerousPlayers,
            description: eoDescription
        },
        sustainability: {
            overperforming,
            underperforming,
            description: sustDescription
        },
        fixtureNuance: {
            favorable: favorableFixtures,
            difficult: [],
            description: "Focus on attackers against high-line defenses."
        },
        verdict: {
            buy: buyRec,
            sell: sellRec,
            captain: captainChoice ? { player: captainChoice, safety: captainSafety } : null,
            strategy: eoRiskLevel === 'HIGH' ? 'Protect Rank' : 'Attack Rank'
        }
    };
};
