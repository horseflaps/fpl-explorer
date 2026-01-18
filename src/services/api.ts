import type { FPLResponse, EntryPicksResponse, LeagueStandingsResponse, Entry } from '../types/fpl';

export const fetchFPLData = async (): Promise<FPLResponse> => {
    try {
        console.log(`[API] Fetching: /api/bootstrap-static/`);
        const response = await fetch('/api/bootstrap-static/');
        if (!response.ok) {
            let errorMessage = `Error fetching FPL data: ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.error) errorMessage = errorData.error;
                if (errorData.details) errorMessage += ` (${errorData.details})`;
            } catch (e) {
                // Ignore JSON parse error on non-JSON error response
            }
            throw new Error(errorMessage);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch FPL data:", error);
        throw error;
    }
};

export const getPlayerImageUrl = (code: number) => {
    // Images are typically hosted at https://resources.premierleague.com/premierleague/photos/players/110x140/p{code}.png
    // Note: 'photo' field in API usually has structure "1234.jpg", need to strip extension or just use the code
    return `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`;
};

export const getTeamKitUrl = (code: number) => {
    return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-66.png`;
};

export const fallbackPlayerImage = "https://resources.premierleague.com/premierleague/photos/players/110x140/Photo-Missing.png";

export const fetchPlayerSummary = async (id: number): Promise<any> => {
    try {
        const response = await fetch(`/api/element-summary/${id}/`);
        if (!response.ok) {
            throw new Error(`Error fetching player summary: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch player summary:", error);
        throw error;
    }
};

export const fetchFixtures = async (): Promise<any[]> => {
    try {
        const response = await fetch('/api/fixtures/');
        if (!response.ok) {
            throw new Error(`Error fetching fixtures: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch fixtures:", error);
        throw error;
    }
};

export const fetchLiveEvent = async (eventId: number): Promise<any> => {
    try {
        const response = await fetch(`/api/event/${eventId}/live/`);
        if (!response.ok) {
            throw new Error(`Error fetching live event data: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch live event data:", error);
        throw error;
    }
};

export const fetchEntryPicks = async (entryId: number, eventId: number): Promise<EntryPicksResponse> => {
    try {
        const response = await fetch(`/api/entry/${entryId}/event/${eventId}/picks/`);
        if (!response.ok) {
            throw new Error(`Error fetching entry picks: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch entry picks:", error);
        throw error;
    }
};

export const fetchLeagueStandings = async (leagueId: number): Promise<LeagueStandingsResponse> => {
    try {
        const response = await fetch(`/api/leagues-classic/${leagueId}/standings/`);
        if (!response.ok) {
            throw new Error(`Error fetching league standings: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch league standings:", error);
        throw error;
    }
};



export const fetchEntry = async (entryId: number): Promise<Entry> => {
    try {
        const response = await fetch(`/api/entry/${entryId}/`);
        if (!response.ok) {
            throw new Error(`Error fetching entry: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch entry:", error);
        throw error;
    }
};

export const fetchEntryHistory = async (entryId: number): Promise<any> => {
    try {
        const response = await fetch(`/api/entry/${entryId}/history/`);
        if (!response.ok) {
            throw new Error(`Error fetching entry history: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch entry history:", error);
        throw error;
    }
};

export const fetchEntryTransfers = async (entryId: number): Promise<any[]> => {
    try {
        const response = await fetch(`/api/entry/${entryId}/transfers/`);
        if (!response.ok) {
            throw new Error(`Error fetching entry transfers: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch entry transfers:", error);
        throw error;
    }
};

export const searchTeamsByName = async (query: string): Promise<any[]> => {
    try {
        const response = await fetch(`/api/team-search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error(`Error searching teams: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to search teams:", error);
        throw error;
    }
};
