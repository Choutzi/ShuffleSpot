import { handleLogin, handleRedirect, makeApiCall, getValidToken } from './spotify-auth.js';

const loginButton = document.getElementById('login-button');
const playlistContainer = document.getElementById('playlist-container');

loginButton.addEventListener('click', handleLogin);

async function fetchPlaylists() {
    try {
        const response = await makeApiCall('https://api.spotify.com/v1/me/playlists');
        if (!response) return;

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
        const tracksResponse = await makeApiCall(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`);
        if (!tracksResponse?.ok) {
            throw new Error(`HTTP error! status: ${tracksResponse?.status}`);
        }

        const tracksData = await tracksResponse.json();
        let tracks = tracksData.items.map(item => ({ uri: item.track.uri }));

        // Shuffle the tracks
        for (let i = tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }

        const updateResponse = await makeApiCall(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, 'PUT', { uris: tracks.map(track => track.uri) });

        if (!updateResponse?.ok) {
            throw new Error(`HTTP error! status: ${updateResponse?.status}`);
        }

        alert('Playlist shuffled successfully!');
    } catch (error) {
        console.error('Error shuffling playlist:', error);
        alert('Error shuffling playlist. Please try again.');
    }
}

window.onload = async function () {
    const token = await getValidToken();
    if (token) {
        fetchPlaylists();
    } else if (window.location.search.length > 0) {
        const newToken = await handleRedirect();
        if (newToken) {
            fetchPlaylists();
        }
    } else {
        loginButton.style.display = 'block';
    }
};
