export default async function handler(req, res) {
    // Explicit Proxy Function
    const { path } = req.query;

    // 1. Health Check Endpoint
    if (path === 'health' || (Array.isArray(path) && path[0] === 'health')) {
        return res.status(200).json({ status: 'ok', message: 'FPL Proxy is Online', timestamp: new Date().toISOString() });
    }

    if (!path) {
        return res.status(400).json({ error: 'No path provided' });
    }

    // 2. Path Normalization
    console.log(`[Proxy] Incoming Path Index: ${JSON.stringify(path)}`);
    // Handle both string (from rewrite) and array (from native routing if applicable)
    const pathString = Array.isArray(path) ? path.join('/') : path;

    // Remove existing trailing slash to avoid double-slash, then enforce it
    const cleanPath = pathString.replace(/\/$/, '');

    // 3. Construct Target URL
    // FPL API requires trailing slash!
    const targetUrl = `https://fantasy.premierleague.com/api/${cleanPath}/`;
    console.log(`[Proxy] Fetching: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            // Forward the upstream error details
            return res.status(response.status).json({
                error: `FPL API Error: ${response.status}`,
                details: response.statusText,
                target: targetUrl
            });
        }

        const data = await response.json();

        // 4. Cache Control
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

        return res.status(200).json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(500).json({
            error: 'Proxy Internal Error',
            message: error.message
        });
    }
}
