// FantasyPremierWolf Connector — Popup Script

const $ = (id) => document.getElementById(id);

function timeAgo(ms) {
    const secs = Math.floor((Date.now() - ms) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
}

function showMessage(el, type, text) {
    el.className = `message ${type}`;
    el.textContent = text;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

async function getCurrentTabToken() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab || !tab.url || !tab.url.includes('fantasy.premierleague.com')) {
                resolve(null);
                return;
            }
            chrome.tabs.sendMessage(tab.id, { type: 'GET_FPL_TOKEN' }, (response) => {
                if (chrome.runtime.lastError) { resolve(null); return; }
                resolve(response);
            });
        });
    });
}

// Find an open FPW tab and get the JWT from it
async function getFpwTokenFromTab() {
    return new Promise((resolve) => {
        chrome.tabs.query({}, (tabs) => {
            const fpwTab = tabs.find(t => t.url && (
                t.url.includes('localhost:5173') ||
                t.url.includes('localhost:3001')
            ));
            if (!fpwTab) { resolve(null); return; }

            // Try content script first
            chrome.tabs.sendMessage(fpwTab.id, { type: 'GET_FPW_TOKEN' }, (response) => {
                if (!chrome.runtime.lastError && response?.fpwToken) {
                    resolve(response.fpwToken);
                    return;
                }
                // Fallback: read localStorage directly (works even if content script isn't injected yet)
                chrome.scripting.executeScript({
                    target: { tabId: fpwTab.id },
                    func: () => localStorage.getItem('token')
                }, (results) => {
                    if (chrome.runtime.lastError || !results?.[0]?.result) {
                        resolve(null);
                        return;
                    }
                    resolve(results[0].result);
                });
            });
        });
    });
}

async function init() {
    const stored = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_STORED_TOKEN' }, resolve);
    });

    // Try to get fresh FPL token from active FPL tab
    const liveToken = await getCurrentTabToken();
    const onFplSite = liveToken !== null;

    // Try to get FPW token from open FPW tab (auto, no paste needed)
    const liveFpwToken = await getFpwTokenFromTab();
    const fpwToken = liveFpwToken || stored?.fpwToken || null;

    // Save auto-captured FPW token
    if (liveFpwToken && liveFpwToken !== stored?.fpwToken) {
        chrome.storage.local.set({ fpwToken: liveFpwToken });
    }

    // If we got a fresh FPL token, update storage
    if (liveToken?.token && liveToken.token !== stored?.fplToken) {
        chrome.runtime.sendMessage({
            type: 'FPL_TOKEN_FOUND',
            token: liveToken.token,
            refreshToken: liveToken.refreshToken,
            expiresAt: liveToken.expiresAt,
            entryId: liveToken.entryId
        });
    }

    const fplToken = liveToken?.token || stored?.fplToken;
    const entryId = liveToken?.entryId || stored?.fplEntryId;

    // Update FPL status display
    const dot = $('fpl-dot');
    const label = $('fpl-status-label');
    const detail = $('fpl-status-detail');
    const ageNote = $('fpl-token-age');

    if (fplToken) {
        dot.className = 'status-dot green';
        label.textContent = 'Token Found';
        detail.innerHTML = entryId
            ? `Entry ID: <span class="entry-id">${entryId}</span>`
            : '';
        if (stored?.fplTokenSavedAt) {
            ageNote.textContent = `Last captured: ${timeAgo(stored.fplTokenSavedAt)}`;
        }
    } else {
        dot.className = 'status-dot red';
        label.textContent = 'Not Logged In';
        detail.textContent = 'No FPL token detected';
    }

    $('loading').style.display = 'none';
    $('main').style.display = 'block';

    if (!onFplSite) {
        $('not-on-fpl').style.display = 'block';
    }

    // Auto-connect if both tokens are available, not already connected, and not manually disconnected
    if (fplToken && fpwToken && !stored?.fpwConnected && !stored?.manuallyDisconnected) {
        const origin = stored?.fpwOrigin || 'http://localhost:3001';
        await autoConnect(fplToken, fpwToken, origin);
        return;
    }

    if (fplToken) {
        $('connect-section').style.display = 'block';
    }

    if (stored?.fpwConnected) {
        $('connected-section').style.display = 'block';
        $('connect-section').style.display = 'none';
    }
}

async function autoConnect(fplToken, fpwToken, origin) {
    origin = origin.replace(/\/$/, '');
    // Infer correct API port
    if (origin.includes('5173')) origin = origin.replace('5173', '3001');

    chrome.storage.local.set({ fpwOrigin: origin, fpwToken });

    const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'SEND_TOKEN_TO_FPW', fpwToken, origin }, resolve);
    });

    $('loading').style.display = 'none';
    $('main').style.display = 'block';

    if (result?.ok) {
        chrome.storage.local.set({ fpwConnected: true });
        $('connected-section').style.display = 'block';
        $('connect-section').style.display = 'none';
        showMessage($('reconnect-msg'), 'success', 'Connected!');
    } else {
        $('connect-section').style.display = 'block';
        showMessage($('connect-msg'), 'error', result?.error || 'Auto-connect failed. Make sure FPW is open.');
    }
}

async function sendTokenToFPW(msgElId) {
    const stored = await new Promise(r => chrome.storage.local.get(['fpwToken', 'fpwOrigin'], r));
    const liveToken = await getFpwTokenFromTab();
    const fpwToken = liveToken || stored?.fpwToken || null;
    const origin = (stored?.fpwOrigin || 'http://localhost:3001').replace(/\/$/, '').replace('5173', '3001');

    if (!fpwToken) {
        showMessage($(msgElId), 'error', 'FPW token not found — make sure FPW is open in a tab');
        return;
    }

    const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'SEND_TOKEN_TO_FPW', fpwToken, origin }, resolve);
    });

    if (result?.ok) {
        showMessage($(msgElId), 'success', 'Connected!');
        chrome.storage.local.set({ fpwConnected: true });
        $('connected-section').style.display = 'block';
        $('connect-section').style.display = 'none';
    } else {
        showMessage($(msgElId), 'error', result?.error || result?.data?.error || 'Failed to connect');
    }
}

document.addEventListener('DOMContentLoaded', init);

document.addEventListener('click', async (e) => {
    if (e.target.id === 'btn-connect') {
        await sendTokenToFPW('connect-msg');
    }

    if (e.target.id === 'btn-disconnect') {
        const stored = await new Promise(r => chrome.storage.local.get(['fpwToken'], r));
        await new Promise(r => chrome.runtime.sendMessage({ type: 'CLEAR_TOKEN', fpwToken: stored?.fpwToken || '' }, r));
        chrome.storage.local.remove('fpwConnected');
        $('connected-section').style.display = 'none';
        $('fpl-dot').className = 'status-dot red';
        $('fpl-status-label').textContent = 'Disconnected';
        $('fpl-status-detail').textContent = 'Token removed from FPW';
        $('connect-section').style.display = 'none';
    }
});
