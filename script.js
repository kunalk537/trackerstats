// Spotify API Configuration
const CLIENT_ID = 'bd92c64d5ad64293b406301bee0ba0d3';
// Use current domain for redirect URI (works for both local and production)
const REDIRECT_URI = window.location.origin;
const SCOPES = [
    'user-read-recently-played',
    'user-top-read',
    'user-read-private',
    'user-read-email',
    'user-follow-read',
    'playlist-modify-public',
    'playlist-modify-private'
].join(' ');

// Spotify API endpoints
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Global state
let accessToken = null;
let refreshToken = null;
let currentTimeRange = 'short_term'; // short_term, medium_term, long_term

// DOM elements
const loginSection = document.getElementById('login-section');
const statsSection = document.getElementById('stats-section');
const loadingSection = document.getElementById('loading-section');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');
const createPlaylistBtn = document.getElementById('create-playlist-btn');

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
    createPlaylistBtn.addEventListener('click', createTopTracksPlaylist);
    
    // Time period selector
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active button
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update current time range
            currentTimeRange = btn.dataset.period;
            
            // Reload data with new time range
            loadUserData();
        });
    });
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
    const authUrl = `https://accounts.spotify.com/authorize?` +
        `client_id=${CLIENT_ID}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(SCOPES)}&` +
        `show_dialog=true`;
    
    window.location.href = authUrl;
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code) {
    showLoadingSection();
    
    try {
        const response = await fetch('/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: code,
                redirect_uri: REDIRECT_URI,
                client_id: CLIENT_ID
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || 'Failed to exchange code for token');
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
        showLoadingSection();
        
        // Update period indicators
        updatePeriodIndicators();
        
        // Load user profile and stats in parallel
        const [userProfile, topArtists, topTracks, recentTracks, audioFeatures] = await Promise.all([
            fetchSpotifyData('/me'),
            fetchSpotifyData(`/me/top/artists?time_range=${currentTimeRange}&limit=10`),
            fetchSpotifyData(`/me/top/tracks?time_range=${currentTimeRange}&limit=10`),
            fetchSpotifyData('/me/player/recently-played?limit=50'),
            fetchSpotifyData(`/me/top/tracks?time_range=${currentTimeRange}&limit=50`)
        ]);

        // Display user profile
        displayUserProfile(userProfile);
        
        // Display stats
        displayTopArtists(topArtists.items);
        displayTopTracks(topTracks.items);
        displayRecentTracks(recentTracks.items);
        displayTopGenres(topArtists.items);
        displayListeningTime(recentTracks.items, currentTimeRange);
        displayAudioFeatures(audioFeatures.items);
        
        showStatsSection();
    } catch (error) {
        console.error('Failed to load user data:', error);
        alert('Failed to load your Spotify data. Please try again.');
        showLoginSection();
    }
}

// Update period indicators in UI
function updatePeriodIndicators() {
    const periodLabels = {
        'short_term': 'Last 4 Weeks',
        'medium_term': 'Last 6 Months',
        'long_term': 'All Time'
    };
    
    document.getElementById('artists-period').textContent = periodLabels[currentTimeRange];
    document.getElementById('tracks-period').textContent = periodLabels[currentTimeRange];
    document.getElementById('time-period').textContent = periodLabels[currentTimeRange];
    document.getElementById('genres-period').textContent = periodLabels[currentTimeRange];
    document.getElementById('audio-period').textContent = periodLabels[currentTimeRange];
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

    if (artists.length === 0) {
        container.innerHTML = '<div class="loading">No data available for this period</div>';
        return;
    }

    artists.forEach((artist, index) => {
        const artistElement = document.createElement('div');
        artistElement.className = 'stat-item';
        artistElement.innerHTML = `
            <span class="stat-rank">#${index + 1}</span>
            <img src="${artist.images[2]?.url || 'https://via.placeholder.com/50'}" alt="${artist.name}">
            <div class="stat-info">
                <h4>${artist.name}</h4>
                <p>${artist.genres.slice(0, 2).join(', ') || 'Various genres'}</p>
            </div>
        `;
        container.appendChild(artistElement);
    });
}

function displayTopTracks(tracks) {
    const container = document.getElementById('top-tracks');
    container.innerHTML = '';

    if (tracks.length === 0) {
        container.innerHTML = '<div class="loading">No data available for this period</div>';
        return;
    }

    tracks.forEach((track, index) => {
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

function displayListeningTime(tracks, timeRange) {
    const container = document.getElementById('listening-time');
    container.innerHTML = '';

    // Filter tracks based on time range
    const now = new Date();
    let filteredTracks = tracks;
    
    switch (timeRange) {
        case 'short_term':
            // Last 4 weeks
            const fourWeeksAgo = new Date(now.getTime() - (4 * 7 * 24 * 60 * 60 * 1000));
            filteredTracks = tracks.filter(item => new Date(item.played_at) >= fourWeeksAgo);
            break;
        case 'medium_term':
            // Last 6 months
            const sixMonthsAgo = new Date(now.getTime() - (6 * 30 * 24 * 60 * 60 * 1000));
            filteredTracks = tracks.filter(item => new Date(item.played_at) >= sixMonthsAgo);
            break;
        case 'long_term':
            // All time - use all tracks
            filteredTracks = tracks;
            break;
    }

    // Calculate total listening time from filtered tracks
    const totalMs = filteredTracks.reduce((total, item) => {
        return total + item.track.duration_ms;
    }, 0);

    const totalMinutes = Math.floor(totalMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    // Calculate additional stats
    const uniqueArtists = new Set(filteredTracks.map(item => item.track.artists[0].name)).size;
    const uniqueTracks = new Set(filteredTracks.map(item => item.track.name)).size;
    const avgTrackLength = totalMs / filteredTracks.length / 60000; // in minutes

    const timeElement = document.createElement('div');
    timeElement.className = 'time-stat';
    
    let timeDisplay;
    if (days > 0) {
        timeDisplay = `${days}d ${remainingHours}h ${minutes}m`;
    } else if (hours > 0) {
        timeDisplay = `${hours}h ${minutes}m`;
    } else {
        timeDisplay = `${minutes}m`;
    }

    timeElement.innerHTML = `
        <div class="time-value">${timeDisplay}</div>
        <div class="time-label">${filteredTracks.length} tracks played</div>
        <div class="time-breakdown">
            <div class="time-breakdown-item">
                <span class="value">${uniqueArtists}</span>
                <span class="label">Artists</span>
            </div>
            <div class="time-breakdown-item">
                <span class="value">${uniqueTracks}</span>
                <span class="label">Unique Tracks</span>
            </div>
            <div class="time-breakdown-item">
                <span class="value">${Math.round(avgTrackLength)}m</span>
                <span class="label">Avg Length</span>
            </div>
        </div>
    `;
    container.appendChild(timeElement);
}

function displayAudioFeatures(tracks) {
    const container = document.getElementById('audio-features');
    container.innerHTML = '';

    if (tracks.length === 0) {
        container.innerHTML = '<div class="loading">No data available for this period</div>';
        return;
    }

    // Get audio features for tracks
    const trackIds = tracks.map(track => track.id).join(',');
    
    fetchSpotifyData(`/audio-features?ids=${trackIds}`)
        .then(features => {
            if (features.audio_features && features.audio_features.length > 0) {
                // Calculate averages
                const validFeatures = features.audio_features.filter(f => f !== null);
                const averages = {
                    danceability: validFeatures.reduce((sum, f) => sum + f.danceability, 0) / validFeatures.length,
                    energy: validFeatures.reduce((sum, f) => sum + f.energy, 0) / validFeatures.length,
                    valence: validFeatures.reduce((sum, f) => sum + f.valence, 0) / validFeatures.length,
                    acousticness: validFeatures.reduce((sum, f) => sum + f.acousticness, 0) / validFeatures.length,
                    instrumentalness: validFeatures.reduce((sum, f) => sum + f.instrumentalness, 0) / validFeatures.length,
                    tempo: validFeatures.reduce((sum, f) => sum + f.tempo, 0) / validFeatures.length
                };

                // Create feature elements
                const featuresList = [
                    { name: 'Danceability', value: averages.danceability, color: '#1db954' },
                    { name: 'Energy', value: averages.energy, color: '#1ed760' },
                    { name: 'Valence', value: averages.valence, color: '#1db954' },
                    { name: 'Acousticness', value: averages.acousticness, color: '#1ed760' },
                    { name: 'Instrumentalness', value: averages.instrumentalness, color: '#1db954' }
                ];

                featuresList.forEach(feature => {
                    const featureElement = document.createElement('div');
                    featureElement.className = 'audio-feature';
                    featureElement.innerHTML = `
                        <span class="feature-name">${feature.name}</span>
                        <div class="feature-bar">
                            <div class="feature-fill" style="width: ${Math.round(feature.value * 100)}%"></div>
                        </div>
                        <span class="feature-value">${Math.round(feature.value * 100)}%</span>
                    `;
                    container.appendChild(featureElement);
                });

                // Add tempo as a special case
                const tempoElement = document.createElement('div');
                tempoElement.className = 'audio-feature';
                tempoElement.innerHTML = `
                    <span class="feature-name">Tempo</span>
                    <div class="feature-bar">
                        <div class="feature-fill" style="width: ${Math.min((averages.tempo / 200) * 100, 100)}%"></div>
                    </div>
                    <span class="feature-value">${Math.round(averages.tempo)} BPM</span>
                `;
                container.appendChild(tempoElement);
            } else {
                container.innerHTML = '<div class="loading">Audio features not available</div>';
            }
        })
        .catch(error => {
            console.error('Failed to load audio features:', error);
            container.innerHTML = '<div class="loading">Audio features not available</div>';
        });
}

// Playlist creation function
async function createTopTracksPlaylist() {
    try {
        // Get current user's top tracks
        const topTracks = await fetchSpotifyData(`/me/top/tracks?time_range=${currentTimeRange}&limit=50`);
        
        if (!topTracks.items || topTracks.items.length === 0) {
            alert('No tracks available to create playlist');
            return;
        }

        // Get user profile for playlist creation
        const userProfile = await fetchSpotifyData('/me');
        
        // Create playlist
        const playlistName = `My Top Tracks (${getPeriodLabel(currentTimeRange)})`;
        const playlistDescription = `Auto-generated playlist of my top tracks from ${getPeriodLabel(currentTimeRange).toLowerCase()}`;
        
        const playlist = await fetch(`${SPOTIFY_API_BASE}/users/${userProfile.id}/playlists`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                name: playlistName,
                description: playlistDescription,
                public: false
            })
        });

        if (!playlist.ok) {
            throw new Error('Failed to create playlist');
        }
        
        const playlistData = await playlist.json();

        // Add tracks to playlist
        const trackUris = topTracks.items.map(track => track.uri);
        
        await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistData.id}/tracks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                uris: trackUris
            })
        });

        alert(`✅ Playlist "${playlistName}" created successfully! Check your Spotify app.`);
        
    } catch (error) {
        console.error('Failed to create playlist:', error);
        alert('Failed to create playlist. Please try again.');
    }
}

function getPeriodLabel(period) {
    const labels = {
        'short_term': 'Last 4 Weeks',
        'medium_term': 'Last 6 Months',
        'long_term': 'All Time'
    };
    return labels[period] || 'Unknown Period';
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
