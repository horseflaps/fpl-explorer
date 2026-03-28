// FantasyPremierWolf Connector — FPW Site Content Script
// Runs on the FPW app, reads the JWT and sends it to the background script

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

// Listen for popup requesting the FPW token
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'GET_FPW_TOKEN') {
        sendResponse({ fpwToken: extractFpwToken() });
    }
});
