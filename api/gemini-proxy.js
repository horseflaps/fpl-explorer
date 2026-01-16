export default async function handler(req, res) {
    // 1. Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. Get the Secret Key (No VITE_ prefix)
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'Server Misconfigured',
            details: 'GEMINI_API_KEY environment variable is missing on Vercel.'
        });
    }

    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt in request body' });
    }

    // 3. Call Google Gemini API
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
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json({
                error: 'Gemini API Error',
                details: errorData.error?.message || response.statusText
            });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated.";

        // 4. Return the result
        return res.status(200).json({ text });

    } catch (error) {
        console.error('Gemini Proxy Error:', error);
        return res.status(500).json({
            error: 'Proxy Internal Error',
            message: error.message
        });
    }
}
