export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    
    try {
        const { code, redirect_uri, client_id } = req.body;
        
        if (!code || !client_id) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        // Get client secret from environment variables
        const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
        
        if (!client_secret) {
            return res.status(500).json({ error: 'Server configuration error' });
        }
        
        // Exchange code for access token
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirect_uri
            })
        });
        
        if (!tokenResponse.ok) {
            const error = await tokenResponse.text();
            console.error('Spotify token error:', error);
            return res.status(400).json({ error: 'Failed to exchange code for token' });
        }
        
        const tokenData = await tokenResponse.json();
        res.json(tokenData);
        
    } catch (error) {
        console.error('Token exchange error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
