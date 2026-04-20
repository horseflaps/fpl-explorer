import type { FPLResponse, EntryPicksResponse, Entry } from '../types/fpl';

export interface WolfAnalysisData {
    bootstrapData: FPLResponse;
    picksData: EntryPicksResponse;
    entryData: Entry;
    historyData: any;
    transfersAvailable: number;
    fixtures: any[];
    availableChips: string[];
    managerDna: string | null;
    recentlyExecuted: { transfers: { out_name: string; in_name: string }[]; chip: string | null } | null;
    transferHistory: { element_in: number; element_out: number; event: number }[];
    lastRecommendedPlan: { transfers: { out_name: string; in_name: string }[]; chip: string | null; captain?: string } | null;
}

export const fetchGeminiAnalysis = async (analysisData: WolfAnalysisData, token: string, retries = 3, delay = 1000): Promise<{ text: string; provider: string }> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);

    try {
        const response = await fetch('/api/wolf-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            signal: controller.signal,
            body: JSON.stringify(analysisData),
        });
        clearTimeout(timeout);

        if (!response.ok) {
            const status = response.status;
            if ((status === 503 || status === 429) && retries > 0) {
                console.warn(`Wolf analysis overloaded (${status}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return await fetchGeminiAnalysis(analysisData, token, retries - 1, delay * 2);
            }
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            const message = errorData.error?.message || errorData.details || errorData.error || response.statusText;
            throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
        }

        const data = await response.json();
        return { text: data.result || 'No analysis generated.', provider: data.provider || 'gemini' };
    } catch (error: any) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') throw new Error('Analysis timed out after 3 minutes. Please try again.');
        throw new Error(error.message || 'Network Error');
    }
};
