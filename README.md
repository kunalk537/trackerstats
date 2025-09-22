# Spotify Stats Dashboard

A beautiful, functional web application that connects to your Spotify account and displays your listening statistics including recent artists, genres, tracks, and listening time.

## Features

- 🎵 **Spotify OAuth Integration** - Secure login with your Spotify account
- 🎤 **Top Artists** - Your most played artists from the last 30 days
- 🎭 **Genre Analysis** - Discover your music taste through genre statistics
- 🎵 **Recent Tracks** - Your recently played songs
- ⏱️ **Listening Time** - Track your listening habits
- 📱 **Responsive Design** - Works perfectly on desktop and mobile
- 🎨 **Modern UI** - Beautiful gradient design with Spotify's brand colors

## Quick Setup

### 1. Create a Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create App"
4. Fill in the details:
   - **App name**: `My Spotify Stats`
   - **App description**: `Personal Spotify listening statistics`
   - **Website**: `http://localhost:3000` (for local development)
   - **Redirect URIs**: Add `http://localhost:3000` and your production URL
5. Click "Save"
6. Copy your **Client ID** from the app settings

### 2. Configure the Application

#### Option A: Using the Backend Server (Recommended)

1. Copy `env.example` to `.env`:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` and add your Spotify credentials:
   ```
   SPOTIFY_CLIENT_ID=your_actual_client_id_here
   SPOTIFY_CLIENT_SECRET=your_actual_client_secret_here
   ```

3. Install dependencies and run the server:
   ```bash
   npm install
   npm start
   ```

4. Open http://localhost:3000 in your browser

#### Option B: Frontend Only (Limited functionality)

1. Open `script.js` in your code editor
2. Replace `your_spotify_client_id_here` on line 3 with your actual Spotify Client ID:
   ```javascript
   const CLIENT_ID = 'your_actual_client_id_here';
   ```

### 3. Run the Application

#### Option A: Simple Local Server (Recommended)

1. **Using Python** (if you have Python installed):
   ```bash
   cd "spotify stats"
   python -m http.server 8000
   ```
   Then open: http://localhost:8000

2. **Using Node.js** (if you have Node.js installed):
   ```bash
   cd "spotify stats"
   npx serve .
   ```
   Then open the URL shown in the terminal

3. **Using VS Code Live Server**:
   - Install the "Live Server" extension
   - Right-click on `index.html` and select "Open with Live Server"

#### Option B: Production Deployment

For production use, you'll need to set up a backend server to handle the OAuth token exchange securely. The current implementation uses a demo endpoint that may not work reliably.

### 4. Connect Your Spotify Account

1. Open the application in your browser
2. Click "Connect with Spotify"
3. Authorize the application in the Spotify popup
4. You'll be redirected back to see your stats!

## How It Works

1. **Authentication**: Uses Spotify's OAuth 2.0 flow for secure login
2. **Data Fetching**: Retrieves your listening data from Spotify's Web API
3. **Statistics**: Calculates and displays various listening metrics
4. **Real-time**: Shows your current listening patterns and preferences

## API Endpoints Used

- `/me` - User profile information
- `/me/top/artists` - Top artists from different time periods
- `/me/player/recently-played` - Recently played tracks
- `/me/top/tracks` - Top tracks (if needed)

## Security Notes

- The current implementation uses a demo token exchange endpoint
- For production use, implement your own backend server
- Never expose your Spotify Client Secret in frontend code
- Consider implementing token refresh logic for better user experience

## Customization

You can easily customize the application by:

- **Colors**: Modify the CSS variables in `style.css`
- **Stats**: Add new API calls in `script.js`
- **Layout**: Adjust the grid layout in `style.css`
- **Time Ranges**: Change the time periods for statistics

## Troubleshooting

### Common Issues

1. **"Invalid client" error**: Make sure your Client ID is correct and the redirect URI matches exactly
2. **CORS errors**: Use a proper web server instead of opening the HTML file directly
3. **Token exchange fails**: The demo endpoint may be down; consider implementing your own backend

### Getting Help

- Check the browser console for error messages
- Verify your Spotify app settings in the developer dashboard
- Ensure your redirect URI exactly matches what you configured

## Next Steps

- Set up your own backend server for production use
- Add more statistics (playlist analysis, audio features, etc.)
- Implement data visualization with charts
- Add export functionality for your stats
- Create user accounts to save historical data

Enjoy exploring your Spotify listening habits! 🎵
