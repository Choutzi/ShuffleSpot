const clientId = 'YOUR_CLIENT_ID';
const scopes = 'playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public';

function generateRandomString(length) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

async function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(digest);
}

function base64URLEncode(buffer) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function getCode() {
    let code = null;
    const urlParams = new URLSearchParams(window.location.search);
    code = urlParams.get('code');
    return code;
}

function storeTokens(accessToken, refreshToken, expiresIn) {
    const now = new Date();
    const expiryTime = now.getTime() + expiresIn * 1000;
    localStorage.setItem('spotifyAccessToken', accessToken);
    localStorage.setItem('spotifyRefreshToken', refreshToken);
    localStorage.setItem('spotifyTokenExpiry', expiryTime);
}

function checkStoredToken() {
    const accessToken = localStorage.getItem('spotifyAccessToken');
    const expiryTime = localStorage.getItem('spotifyTokenExpiry');

    if (accessToken && expiryTime) {
        if (new Date().getTime() < parseInt(expiryTime)) {
            return accessToken;
        }
    }
    return null;
}

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('spotifyRefreshToken');
    if (!refreshToken) {
        return null;
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId
        })
    });

    if (response.ok) {
        const data = await response.json();
        storeTokens(data.access_token, data.refresh_token || refreshToken, data.expires_in);
        return data.access_token;
    } else {
        localStorage.clear();
        return null;
    }
}

async function handleLogin() {
    let codeVerifier = generateRandomString(64);
    let state = generateRandomString(16);
    let codeChallenge = await generateCodeChallenge(codeVerifier);

    localStorage.setItem('code_verifier', codeVerifier);

    let args = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: scopes,
        redirect_uri: redirectUri,
        state: state,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge
    });

    window.location = 'https://accounts.spotify.com/authorize?' + args;
}

async function handleRedirect() {
    let code = getCode();
    let codeVerifier = localStorage.getItem('code_verifier');

    let body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: window.location.origin + window.location.pathname,
        client_id: clientId,
        code_verifier: codeVerifier
    });

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
    });

    if (response.ok) {
        const data = await response.json();
        storeTokens(data.access_token, data.refresh_token, data.expires_in);
        return data.access_token;
    } else {
        console.error('Error:', await response.text());
        return null;
    }
}

async function getValidToken() {
    let accessToken = checkStoredToken();
    if (!accessToken) {
        accessToken = await refreshAccessToken();
        if (!accessToken) {
            handleLogin();
            return null;
        }
    }
    return accessToken;
}

async function makeApiCall(url, method = 'GET', body = null) {
    let accessToken = await getValidToken();
    if (!accessToken) return null;

    const response = await fetch(url, {
        method: method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : null
    });

    if (response.status === 401) {
        accessToken = await refreshAccessToken();
        if (accessToken) {
            return makeApiCall(url, method, body);
        } else {
            handleLogin();
            return null;
        }
    }

    return response;
}

export { handleLogin, handleRedirect, makeApiCall, getValidToken };
