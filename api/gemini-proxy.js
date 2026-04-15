export default async function handler(req, res) {
    // 1. Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt in request body' });
    }

    // AI_PROVIDER: "claude" (default) or "gemini" — change env var to switch providers
    const AI_PROVIDER = (process.env.AI_PROVIDER || 'claude').toLowerCase();

    try {
        let response;
        if (AI_PROVIDER === 'gemini') {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) return res.status(500).json({ error: 'Server Misconfigured', details: 'GEMINI_API_KEY missing.' });

            response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.7 },
                    }),
                }
            );
        } else {
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) return res.status(500).json({ error: 'Server Misconfigured', details: 'ANTHROPIC_API_KEY missing.' });

            response = await fetch(
                'https://api.anthropic.com/v1/messages',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                        model: 'claude-sonnet-4-6',
                        max_tokens: 16000,
                        temperature: 0.7,
                        messages: [{ role: 'user', content: prompt }],
                    }),
                }
            );
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json({
                error: 'AI API Error',
                details: errorData.error?.message || response.statusText,
            });
        }

        const data = await response.json();
        const text = AI_PROVIDER === 'gemini'
            ? (data.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis generated.')
            : (data.content?.[0]?.text || 'No analysis generated.');

        return res.status(200).json({ text });

    } catch (error) {
        console.error('Wolf Proxy Error:', error);
        return res.status(500).json({ error: 'Proxy Internal Error', message: error.message });
    }
}
