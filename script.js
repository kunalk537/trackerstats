// Spotify API Configuration
const CLIENT_ID = 'bd92c64d5ad64293b406301bee0ba0d3';
// Use current domain for redirect URI (works for both local and production)
const REDIRECT_URI = window.location.origin;
const SCOPES = [
    'user-read-recently-played',
    'user-top-read',
    'user-read-private',
    'user-read-email',
    'user-follow-read'
].join(' ');

// Spotify API endpoints
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Global state
let accessToken = null;
let refreshToken = null;

// DOM elements
const loginSection = document.getElementById('login-section');
const statsSection = document.getElementById('stats-section');
const loadingSection = document.getElementById('loading-section');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're returning from Spotify authorization
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
        alert('Authorization failed: ' + error);
        showLoginSection();
    } else if (code) {
        // Exchange code for access token
        exchangeCodeForToken(code);
    } else {
        // Check for existing token
        const storedToken = localStorage.getItem('spotify_access_token');
        const storedRefreshToken = localStorage.getItem('spotify_refresh_token');
        
        if (storedToken && storedRefreshToken) {
            accessToken = storedToken;
            refreshToken = storedRefreshToken;
            showLoadingSection();
            loadUserData();
        } else {
            showLoginSection();
        }
    }

    // Event listeners
    loginBtn.addEventListener('click', initiateSpotifyLogin);
    logoutBtn.addEventListener('click', logout);
    refreshBtn.addEventListener('click', refreshData);
});

// Show different sections
function showLoginSection() {
    loginSection.classList.remove('hidden');
    statsSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
}

function showStatsSection() {
    loginSection.classList.add('hidden');
    statsSection.classList.remove('hidden');
    loadingSection.classList.add('hidden');
}

function showLoadingSection() {
    loginSection.classList.add('hidden');
    statsSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');
}

// Spotify OAuth flow
function initiateSpotifyLogin() {
    console.log('Redirect URI being used:', REDIRECT_URI);
    const authUrl = `https://accounts.spotify.com/authorize?` +
        `client_id=${CLIENT_ID}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(SCOPES)}&` +
        `show_dialog=true`;
    
    console.log('Full auth URL:', authUrl);
    window.location.href = authUrl;
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code) {
    showLoadingSection();
    
    try {
        // Use a public CORS proxy for demo purposes
        // In production, you should use your own backend
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const tokenUrl = 'https://accounts.spotify.com/api/token';
        
        const response = await fetch(proxyUrl + tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${btoa(CLIENT_ID + ':' + 'your_client_secret_here')}`,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            })
        });

        if (!response.ok) {
            throw new Error('Failed to exchange code for token');
        }

        const data = await response.json();
        accessToken = data.access_token;
        refreshToken = data.refresh_token;
        
        // Store tokens
        localStorage.setItem('spotify_access_token', accessToken);
        localStorage.setItem('spotify_refresh_token', refreshToken);
        
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        
        loadUserData();
    } catch (error) {
        console.error('Token exchange failed:', error);
        alert('Failed to authenticate with Spotify. Please try again.');
        showLoginSection();
    }
}

// Load user data and stats
async function loadUserData() {
    try {
        // Load user profile and stats in parallel
        const [userProfile, topArtists, recentTracks, topGenres] = await Promise.all([
            fetchSpotifyData('/me'),
            fetchSpotifyData('/me/top/artists?time_range=short_term&limit=10'),
            fetchSpotifyData('/me/player/recently-played?limit=20'),
            fetchSpotifyData('/me/top/artists?time_range=short_term&limit=50')
        ]);

        // Display user profile
        displayUserProfile(userProfile);
        
        // Display stats
        displayTopArtists(topArtists.items);
        displayRecentTracks(recentTracks.items);
        displayTopGenres(topGenres.items);
        displayListeningTime(recentTracks.items);
        
        showStatsSection();
    } catch (error) {
        console.error('Failed to load user data:', error);
        alert('Failed to load your Spotify data. Please try again.');
        showLoginSection();
    }
}

// Generic function to fetch data from Spotify API
async function fetchSpotifyData(endpoint) {
    const response = await fetch(SPOTIFY_API_BASE + endpoint, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            // Token expired, try to refresh
            await refreshAccessToken();
            // Retry the request
            return fetchSpotifyData(endpoint);
        }
        throw new Error(`Spotify API error: ${response.status}`);
    }

    return response.json();
}

// Refresh access token
async function refreshAccessToken() {
    try {
        const response = await fetch('/api/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                refresh_token: refreshToken
            })
        });

        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }

        const data = await response.json();
        accessToken = data.access_token;
        localStorage.setItem('spotify_access_token', accessToken);
    } catch (error) {
        console.error('Token refresh failed:', error);
        logout();
        throw error;
    }
}

// Display functions
function displayUserProfile(profile) {
    document.getElementById('user-name').textContent = profile.display_name;
    document.getElementById('user-followers').textContent = 
        `${profile.followers.total.toLocaleString()} followers`;
    document.getElementById('user-avatar').src = 
        profile.images[0]?.url || 'https://via.placeholder.com/80';
}

function displayTopArtists(artists) {
    const container = document.getElementById('top-artists');
    container.innerHTML = '';

    artists.forEach((artist, index) => {
        const artistElement = document.createElement('div');
        artistElement.className = 'stat-item';
        artistElement.innerHTML = `
            <span class="stat-rank">#${index + 1}</span>
            <img src="${artist.images[2]?.url || 'https://via.placeholder.com/50'}" alt="${artist.name}">
            <div class="stat-info">
                <h4>${artist.name}</h4>
                <p>${artist.genres.slice(0, 2).join(', ')}</p>
            </div>
        `;
        container.appendChild(artistElement);
    });
}

function displayRecentTracks(tracks) {
    const container = document.getElementById('recent-tracks');
    container.innerHTML = '';

    tracks.slice(0, 10).forEach((item, index) => {
        const track = item.track;
        const trackElement = document.createElement('div');
        trackElement.className = 'stat-item';
        trackElement.innerHTML = `
            <span class="stat-rank">#${index + 1}</span>
            <img src="${track.album.images[2]?.url || 'https://via.placeholder.com/50'}" alt="${track.name}">
            <div class="stat-info">
                <h4>${track.name}</h4>
                <p>${track.artists.map(artist => artist.name).join(', ')}</p>
            </div>
        `;
        container.appendChild(trackElement);
    });
}

function displayTopGenres(artists) {
    const container = document.getElementById('top-genres');
    container.innerHTML = '';

    // Count genre frequency
    const genreCount = {};
    artists.forEach(artist => {
        artist.genres.forEach(genre => {
            genreCount[genre] = (genreCount[genre] || 0) + 1;
        });
    });

    // Sort genres by frequency and take top 10
    const topGenres = Object.entries(genreCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

    topGenres.forEach(([genre, count]) => {
        const genreElement = document.createElement('span');
        genreElement.className = 'genre-tag';
        genreElement.textContent = `${genre} (${count})`;
        container.appendChild(genreElement);
    });
}

function displayListeningTime(tracks) {
    const container = document.getElementById('listening-time');
    container.innerHTML = '';

    // Calculate total listening time from recent tracks
    const totalMs = tracks.reduce((total, item) => {
        return total + item.track.duration_ms;
    }, 0);

    const totalMinutes = Math.floor(totalMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const timeElement = document.createElement('div');
    timeElement.className = 'time-stat';
    timeElement.innerHTML = `
        <div class="time-value">${hours}h ${minutes}m</div>
        <div class="time-label">Last 20 tracks</div>
    `;
    container.appendChild(timeElement);
}

// Utility functions
function refreshData() {
    showLoadingSection();
    loadUserData();
}

function logout() {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    accessToken = null;
    refreshToken = null;
    showLoginSection();
}
