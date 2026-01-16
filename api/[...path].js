export default async function handler(req, res) {
    // Vercel Native Dynamic Route: api/[...path].js
    // Catches all requests to /api/*
    const { path } = req.query;

    if (!path) {
        return res.status(400).json({ error: 'No path provided' });
    }

    // path is an array of segments, e.g. ['bootstrap-static'] or ['element-summary', '123']
    const pathString = Array.isArray(path) ? path.join('/') : path;

    // Clean up and ENFORCE trailing slash for FPL (Django)
    const cleanPath = pathString.replace(/\/$/, '');
    const targetUrl = `https://fantasy.premierleague.com/api/${cleanPath}/`;

    try {
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `FPL API Error: ${response.status}`,
                details: response.statusText,
                target: targetUrl // Client can see what URL failed
            });
        }

        const data = await response.json();

        // Cache for performance
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

        return res.status(200).json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(500).json({
            error: 'Proxy Failed',
            message: error.message
        });
    }
}
