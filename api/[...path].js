export default async function handler(req, res) {
    // Get the path parameter from the query string (passed by vercel.json rewrite)
    const { path } = req.query;

    if (!path) {
        return res.status(400).json({ error: 'No path provided' });
    }

    // Reconstruct the target URL
    // path can be a string or an array of strings depending on the rewrite match
    const pathString = Array.isArray(path) ? path.join('/') : path;

    // Clean up any double slashes, but keep the API structure
    // Important: FPL API (Django) requires a trailing slash
    const cleanPath = pathString.replace(/\/$/, '');
    const targetUrl = `https://fantasy.premierleague.com/api/${cleanPath}/`;

    try {
        const response = await fetch(targetUrl, {
            method: req.method, // Forward the method (GET, etc.)
            headers: {
                // Mimic a real browser to avoid 403 Forbidden
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                'Accept': 'application/json',
                // Important: Do NOT forward Referer or Origin to avoid CORS/Referer blocking by FPL
            },
        });

        if (!response.ok) {
            // If FPL returns 4xx/5xx, forward that status
            return res.status(response.status).json({ error: `FPL API Error: ${response.statusText}` });
        }

        const data = await response.json();

        // Set caching headers for performance (optional but good for static data)
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

        return res.status(200).json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(500).json({ error: 'Failed to fetch data via proxy' });
    }
}
