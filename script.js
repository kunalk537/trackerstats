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
const createArtistsPlaylistBtn = document.getElementById('create-artists-playlist-btn');
const exportDataBtn = document.getElementById('export-data-btn');

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
    createArtistsPlaylistBtn.addEventListener('click', createTopArtistsPlaylist);
    exportDataBtn.addEventListener('click', exportUserData);
    
    // Navigation event listeners
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            navigateToSection(section);
            
            // Update active nav item
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });
    
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

// Navigation function
function navigateToSection(section) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    const targetPage = document.getElementById(`${section}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
        
        // Load content for specific pages if needed
        if (section === 'artists') {
            loadArtistsPage();
        } else if (section === 'tracks') {
            loadTracksPage();
        }
    }
}

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
        displayAudioFeatures(audioFeatures.items);
        
        // Load album recommendations based on top artists
        loadAlbumRecommendations(topArtists.items);
        
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

function displayTopArtists(artists, containerId = null) {
    const container = containerId || document.getElementById('top-artists');
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

function displayTopTracks(tracks, containerId = null) {
    const container = containerId || document.getElementById('top-tracks');
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

// Simplified album recommendations - show recent albums from top artists
async function loadAlbumRecommendations(topArtists) {
    const container = document.getElementById('album-recommendations');
    container.innerHTML = '<div class="loading">Finding albums you might like...</div>';

    try {
        // Get recent albums from top artists (simplified approach)
        const albums = [];
        
        for (const artist of topArtists.slice(0, 3)) { // Limit to 3 artists for better performance
            try {
                const artistAlbums = await fetchSpotifyData(`/artists/${artist.id}/albums?limit=5&album_type=album`);
                if (artistAlbums.items && artistAlbums.items.length > 0) {
                    albums.push(...artistAlbums.items);
                }
            } catch (error) {
                console.error(`Failed to get albums for artist ${artist.name}:`, error);
            }
        }

        displayAlbumRecommendations(albums);
    } catch (error) {
        console.error('Failed to load album recommendations:', error);
        container.innerHTML = '<div class="loading">Unable to load recommendations</div>';
    }
}

function displayAlbumRecommendations(albums) {
    const container = document.getElementById('album-recommendations');
    container.innerHTML = '';

    if (albums.length === 0) {
        container.innerHTML = '<div class="loading">No recommendations available</div>';
        return;
    }

    // Sort albums by release date (newest first) and take top 6
    const sortedAlbums = albums
        .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))
        .slice(0, 6);

    sortedAlbums.forEach(album => {
        const albumElement = document.createElement('div');
        albumElement.className = 'album-item';
        albumElement.innerHTML = `
            <img src="${album.images[1]?.url || album.images[0]?.url || 'https://via.placeholder.com/60'}" alt="${album.name}" class="album-artwork">
            <div class="album-info">
                <h4>${album.name}</h4>
                <p>${album.artists[0].name}</p>
            </div>
            <div class="album-year">${new Date(album.release_date).getFullYear()}</div>
        `;
        
        // Add click handler to open in Spotify
        albumElement.addEventListener('click', () => {
            window.open(`https://open.spotify.com/album/${album.id}`, '_blank');
        });
        
        container.appendChild(albumElement);
    });
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

// Simplified playlist creation function
async function createTopTracksPlaylist() {
    try {
        showNotification('⏳', 'Creating playlist...');
        
        // Get current user's top tracks
        const topTracks = await fetchSpotifyData(`/me/top/tracks?time_range=${currentTimeRange}&limit=20`);
        
        if (!topTracks.items || topTracks.items.length === 0) {
            showNotification('❌', 'No tracks available to create playlist');
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
            const errorData = await playlist.json();
            throw new Error(errorData.error?.message || 'Failed to create playlist');
        }
        
        const playlistData = await playlist.json();

        // Add tracks to playlist (limit to 20 for better performance)
        const trackUris = topTracks.items.slice(0, 20).map(track => track.uri);
        
        const addTracksResponse = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistData.id}/tracks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                uris: trackUris
            })
        });

        if (!addTracksResponse.ok) {
            throw new Error('Failed to add tracks to playlist');
        }

        showNotification('✅', `Playlist "${playlistName}" created successfully!`);
        
    } catch (error) {
        console.error('Failed to create playlist:', error);
        showNotification('❌', 'Failed to create playlist. Please try again.');
    }
}

// Simplified artists playlist creation
async function createTopArtistsPlaylist() {
    try {
        showNotification('⏳', 'Creating artists playlist...');
        
        // Get current user's top artists
        const topArtists = await fetchSpotifyData(`/me/top/artists?time_range=${currentTimeRange}&limit=10`);
        
        if (!topArtists.items || topArtists.items.length === 0) {
            showNotification('❌', 'No artists available to create playlist');
            return;
        }

        const userProfile = await fetchSpotifyData('/me');
        
        const playlistName = `My Top Artists (${getPeriodLabel(currentTimeRange)})`;
        const playlistDescription = `Auto-generated playlist featuring tracks from my top artists (${getPeriodLabel(currentTimeRange).toLowerCase()})`;
        
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
            const errorData = await playlist.json();
            throw new Error(errorData.error?.message || 'Failed to create playlist');
        }
        
        const playlistData = await playlist.json();

        // Get top tracks from each artist (simplified)
        const trackUris = [];
        for (const artist of topArtists.items.slice(0, 5)) { // Limit to 5 artists for better performance
            try {
                const artistTracks = await fetchSpotifyData(`/artists/${artist.id}/top-tracks?market=US`);
                if (artistTracks.tracks && artistTracks.tracks.length > 0) {
                    trackUris.push(artistTracks.tracks[0].uri); // Add top track from each artist
                }
            } catch (error) {
                console.error(`Failed to get tracks for artist ${artist.name}:`, error);
            }
        }
        
        if (trackUris.length > 0) {
            const addTracksResponse = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistData.id}/tracks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    uris: trackUris
                })
            });

            if (!addTracksResponse.ok) {
                throw new Error('Failed to add tracks to playlist');
            }
        }

        showNotification('✅', `Artists playlist "${playlistName}" created successfully!`);
        
    } catch (error) {
        console.error('Failed to create artists playlist:', error);
        showNotification('❌', 'Failed to create playlist. Please try again.');
    }
}

// Export user data as JSON
async function exportUserData() {
    try {
        const [userProfile, topArtists, topTracks, recentTracks, audioFeatures] = await Promise.all([
            fetchSpotifyData('/me'),
            fetchSpotifyData(`/me/top/artists?time_range=${currentTimeRange}&limit=50`),
            fetchSpotifyData(`/me/top/tracks?time_range=${currentTimeRange}&limit=50`),
            fetchSpotifyData('/me/player/recently-played?limit=50'),
            fetchSpotifyData(`/me/top/tracks?time_range=${currentTimeRange}&limit=50`)
        ]);

        const exportData = {
            exportDate: new Date().toISOString(),
            timeRange: currentTimeRange,
            userProfile: {
                display_name: userProfile.display_name,
                followers: userProfile.followers.total,
                country: userProfile.country
            },
            topArtists: topArtists.items,
            topTracks: topTracks.items,
            recentTracks: recentTracks.items,
            audioFeatures: audioFeatures.items
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `spotify-stats-${getPeriodLabel(currentTimeRange).toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showNotification('✅', 'Data exported successfully!');
        
    } catch (error) {
        console.error('Failed to export data:', error);
        showNotification('❌', 'Failed to export data. Please try again.');
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

// Page-specific loading functions
async function loadArtistsPage() {
    const container = document.getElementById('artists-content');
    container.innerHTML = '<div class="loading">Loading artists...</div>';
    
    try {
        const topArtists = await fetchSpotifyData(`/me/top/artists?time_range=${currentTimeRange}&limit=20`);
        displayTopArtists(topArtists.items, container);
    } catch (error) {
        console.error('Failed to load artists:', error);
        container.innerHTML = '<div class="loading">Failed to load artists</div>';
    }
}

async function loadTracksPage() {
    const container = document.getElementById('tracks-content');
    container.innerHTML = '<div class="loading">Loading tracks...</div>';
    
    try {
        const topTracks = await fetchSpotifyData(`/me/top/tracks?time_range=${currentTimeRange}&limit=20`);
        displayTopTracks(topTracks.items, container);
    } catch (error) {
        console.error('Failed to load tracks:', error);
        container.innerHTML = '<div class="loading">Failed to load tracks</div>';
    }
}

function logout() {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    accessToken = null;
    refreshToken = null;
    showLoginSection();
}

// Notification system
function showNotification(icon, message) {
    const notification = document.getElementById('notification');
    const notificationIcon = document.getElementById('notification-icon');
    const notificationMessage = document.getElementById('notification-message');
    
    notificationIcon.textContent = icon;
    notificationMessage.textContent = message;
    
    notification.classList.remove('hidden');
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 300);
    }, 3000);
}
