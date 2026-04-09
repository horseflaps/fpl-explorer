// FantasyPremierWolf Connector — FPW Site Content Script
// Runs on the FPW app, reads the JWT and sends it to the background script

document.documentElement.setAttribute('data-fpw-extension', 'installed');

function extractFpwToken() {
    return localStorage.getItem('token') || null;
}

function sendFpwToken() {
    const fpwToken = extractFpwToken();
    if (fpwToken) {
        chrome.runtime.sendMessage({
            type: 'FPW_TOKEN_FOUND',
            fpwToken,
            origin: window.location.origin
        });
    }
}

// Send on load
sendFpwToken();

// Re-send if localStorage changes in another tab
window.addEventListener('storage', (e) => {
    if (e.key === 'token') sendFpwToken();
});

// Re-send when user logs in (same tab — storage event doesn't fire for same-tab changes)
window.addEventListener('fpw-login', () => {
    sendFpwToken();
});

// Listen for reconnect requests from the FPW web app
window.addEventListener('fpw-reconnect', (e) => {
    const fpwToken = e.detail?.fpwToken || extractFpwToken();
    if (!fpwToken) {
        window.dispatchEvent(new CustomEvent('fpw-reconnect-result', { detail: { ok: false, error: 'no_fpw_token' } }));
        return;
    }
    // Reset fpwConnected so auto-connect fires on next FPL visit if token is stale
    chrome.runtime.sendMessage({ type: 'RESET_CONNECTED_STATE' });

    chrome.runtime.sendMessage({
        type: 'SEND_TOKEN_TO_FPW',
        fpwToken,
        origin: window.location.origin.replace('5173', '3001')
    }, (response) => {
        window.dispatchEvent(new CustomEvent('fpw-reconnect-result', {
            detail: response || { ok: false, error: 'no_response' }
        }));
    });
});

// Reset fpwConnected when the server detects the session expired
window.addEventListener('fpw-reset-connection', () => {
    chrome.runtime.sendMessage({ type: 'RESET_CONNECTED_STATE' });
});

// Listen for popup requesting the FPW token
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'GET_FPW_TOKEN') {
        sendResponse({ fpwToken: extractFpwToken() });
    }
});
