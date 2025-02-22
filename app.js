const clientId = 'YOUR_CLIENT_ID'; // You'll set this as a GitHub secret
const scopes = 'playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public';

let codeVerifier = generateRandomString(128);

const loginButton = document.getElementById('login-button');
const playlistContainer = document.getElementById('playlist-container');

loginButton.addEventListener('click', handleLogin);

function handleLogin() {
    let state = generateRandomString(16);
    let codeChallenge = generateCodeChallenge(codeVerifier);

    localStorage.setItem('code_verifier', codeVerifier);

    let args = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: scopes,
        redirect_uri: window.location.origin + window.location.pathname,
        state: state,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge
    });

    window.location = 'https://accounts.spotify.com/authorize?' + args;
}

function handleRedirect() {
    let code = getCode();
    fetchAccessToken(code);
}

function fetchAccessToken(code) {
    let codeVerifier = localStorage.getItem('code_verifier');

    let body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: window.location.origin + window.location.pathname,
        client_id: clientId,
        code_verifier: codeVerifier
    });

    fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('HTTP status ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            localStorage.setItem('access_token', data.access_token);
            fetchPlaylists();
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

async function fetchPlaylists() {
    try {
        const response = await fetch('https://api.spotify.com/v1/me/playlists', {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        displayPlaylists(data.items);
    } catch (error) {
        console.error('Error fetching playlists:', error);
        playlistContainer.innerHTML = '<p>Error fetching playlists. Please try logging in again.</p>';
    }
}

function displayPlaylists(playlists) {
    playlistContainer.innerHTML = '<h2>Your Playlists</h2>';
    const ul = document.createElement('ul');
    playlists.forEach(playlist => {
        const li = document.createElement('li');
        const shuffleButton = document.createElement('button');
        shuffleButton.textContent = 'Shuffle';
        shuffleButton.onclick = () => shufflePlaylist(playlist.id);
        li.textContent = `${playlist.name} (${playlist.tracks.total} tracks) `;
        li.appendChild(shuffleButton);
        ul.appendChild(li);
    });
    playlistContainer.appendChild(ul);
}

async function shufflePlaylist(playlistId) {
    try {
        const tracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') }
        });

        if (!tracksResponse.ok) {
            throw new Error(`HTTP error! status: ${tracksResponse.status}`);
        }

        const tracksData = await tracksResponse.json();
        let tracks = tracksData.items.map(item => ({ uri: item.track.uri }));

        // Shuffle the tracks
        for (let i = tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }

        // Update the playlist with the shuffled tracks
        const updateResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris: tracks.map(track => track.uri) })
        });

        if (!updateResponse.ok) {
            throw new Error(`HTTP error! status: ${updateResponse.status}`);
        }

        alert('Playlist shuffled successfully!');
    } catch (error) {
        console.error('Error shuffling playlist:', error);
        alert('Error shuffling playlist. Please try again.');
    }
}

function generateRandomString(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function generateCodeChallenge(codeVerifier) {
    return base64URL(CryptoJS.SHA256(codeVerifier));
}

function base64URL(string) {
    return string.toString(CryptoJS.enc.Base64).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function getCode() {
    let code = null;
    const urlParams = new URLSearchParams(window.location.search);
    code = urlParams.get('code');
    return code;
}

window.onload = function () {
    if (window.location.search.length > 0) {
        handleRedirect();
    }
};
