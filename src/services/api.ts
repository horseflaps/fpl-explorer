import type { FPLResponse } from '../types/fpl';

export const fetchFPLData = async (): Promise<FPLResponse> => {
    try {
        const response = await fetch('/api/bootstrap-static/');
        if (!response.ok) {
            throw new Error(`Error fetching FPL data: ${response.statusText}`);
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
