// FantasyPremierWolf Connector — Content Script
// Runs on fantasy.premierleague.com, extracts FPL auth token and entry ID

const OIDC_KEY = 'oidc.user:https://account.premierleague.com/as:bfcbaf69-aade-4c1b-8f00-c1cb8a193030';

function extractTokenData() {
    try {
        const raw = localStorage.getItem(OIDC_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return {
            access_token: parsed.access_token || null,
            refresh_token: parsed.refresh_token || null,
            expires_at: parsed.expires_at || null,
        };
    } catch {
        return null;
    }
}

function extractToken() {
    return extractTokenData()?.access_token || null;
}

function extractEntryId() {
    // URL pattern: /entry/XXXXXX/event/
    const match = window.location.pathname.match(/\/entry\/(\d+)\//);
    if (match) return parseInt(match[1], 10);

    // Try to get from page data — FPL sometimes embeds it
    try {
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
            const m = s.textContent.match(/"entry":\s*(\d+)/);
            if (m) return parseInt(m[1], 10);
        }
    } catch {}

    return null;
}

function sendTokenToBackground(isPageLoad = false) {
    const tokenData = extractTokenData();
    const entryId = extractEntryId();

    if (tokenData?.access_token) {
        chrome.runtime.sendMessage({
            type: 'FPL_TOKEN_FOUND',
            token: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: tokenData.expires_at,
            entryId,
            isPageLoad,
            url: window.location.href
        });
    } else {
        // Token gone — user logged out of FPL, trigger disconnect
        chrome.runtime.sendMessage({ type: 'FPL_LOGGED_OUT' });
    }
}

// Run on page load — tagged as page load so refresh clears manual disconnect
sendTokenToBackground(true);

// Also re-run when URL changes (FPL is a SPA) — NOT a page load
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        sendTokenToBackground(false);
    }
});
observer.observe(document.body, { childList: true, subtree: true });

// Watch localStorage directly for token removal (catches logout without navigation)
window.addEventListener('storage', (e) => {
    if (e.key === OIDC_KEY && !e.newValue) {
        chrome.runtime.sendMessage({ type: 'FPL_LOGGED_OUT' });
    }
});

// Listen for requests from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'GET_FPL_TOKEN') {
        const tokenData = extractTokenData();
        sendResponse({
            token: tokenData?.access_token || null,
            refreshToken: tokenData?.refresh_token || null,
            expiresAt: tokenData?.expires_at || null,
            entryId: extractEntryId()
        });
    }
});
