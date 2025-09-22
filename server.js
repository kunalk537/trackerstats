const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Spotify OAuth endpoints
app.post('/api/token', async (req, res) => {
    try {
        const { code, redirect_uri, client_id } = req.body;
        
        if (!code || !client_id) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Exchange code for access token
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${client_id}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
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
});

app.post('/api/refresh', async (req, res) => {
    try {
        const { refresh_token } = req.body;
        
        if (!refresh_token) {
            return res.status(400).json({ error: 'Missing refresh token' });
        }

        // Refresh access token
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refresh_token
            })
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.text();
            console.error('Spotify refresh error:', error);
            return res.status(400).json({ error: 'Failed to refresh token' });
        }

        const tokenData = await tokenResponse.json();
        res.json(tokenData);
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Create self-signed certificates for HTTPS
function createSelfSignedCert() {
    try {
        if (!fs.existsSync('key.pem') || !fs.existsSync('cert.pem')) {
            console.log('🔐 Creating self-signed certificates for HTTPS...');
            execSync('openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"', { stdio: 'inherit' });
            console.log('✅ Certificates created successfully!');
        }
        return true;
    } catch (error) {
        console.log('❌ Failed to create certificates. Falling back to HTTP.');
        return false;
    }
}

// Try to start HTTPS server, fallback to HTTP
const hasCert = createSelfSignedCert();

if (hasCert) {
    try {
        const options = {
            key: fs.readFileSync('key.pem'),
            cert: fs.readFileSync('cert.pem')
        };
        
        https.createServer(options, app).listen(HTTPS_PORT, () => {
            console.log(`🚀 Spotify Stats Dashboard running on https://localhost:${HTTPS_PORT}`);
            console.log(`📝 Make sure to set up your .env file with Spotify credentials`);
            console.log(`🔒 Using HTTPS - update your Spotify app redirect URI to: https://localhost:${HTTPS_PORT}`);
            console.log(`⚠️  You may need to accept the self-signed certificate in your browser`);
        });
    } catch (error) {
        console.log('❌ HTTPS server failed, starting HTTP server...');
        startHttpServer();
    }
} else {
    startHttpServer();
}

function startHttpServer() {
    app.listen(PORT, () => {
        console.log(`🚀 Spotify Stats Dashboard running on http://localhost:${PORT}`);
        console.log(`📝 Make sure to set up your .env file with Spotify credentials`);
        console.log(`🔒 Note: Spotify may require HTTPS. Try using ngrok for HTTPS tunneling.`);
    });
}
