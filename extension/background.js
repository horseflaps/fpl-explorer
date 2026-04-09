// FantasyPremierWolf Connector — Service Worker

const FPW_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3001'
];

// Store token in extension storage
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

    if (msg.type === 'FPL_LOGGED_OUT') {
        // User logged out of FPL — clear token, disconnect FPW, and clear manual disconnect flag
        // so that logging back in will auto-connect again
        chrome.storage.local.get(['fpwOrigin', 'fpwToken'], async (data) => {
            if (data.fpwOrigin && data.fpwToken) {
                try {
                    await fetch(`${data.fpwOrigin}/api/fpl/disconnect`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${data.fpwToken}` }
                    });
                } catch {}
            }
            chrome.storage.local.remove(['fplToken', 'fplEntryId', 'fplTokenSavedAt', 'fpwConnected', 'manuallyDisconnected']);
            chrome.action.setBadgeText({ text: '' });
        });
        return;
    }

    if (msg.type === 'FPW_TOKEN_FOUND' && msg.fpwToken) {
        const origin = (msg.origin || 'http://localhost:3001').replace('5173', '3001');
        chrome.storage.local.get(['fplToken', 'fplRefreshToken', 'fplExpiresAt', 'fplEntryId', 'fpwToken', 'fpwConnected', 'manuallyDisconnected'], (data) => {
            const isNewLogin = msg.fpwToken !== data.fpwToken;
            // If this is a fresh FPW login (new token), reset connected state so auto-connect can proceed
            const updates = { fpwToken: msg.fpwToken, fpwOrigin: origin };
            if (isNewLogin) updates.fpwConnected = false;

            chrome.storage.local.set(updates, () => {
                const alreadyConnected = data.fpwConnected && !isNewLogin;
                if (data.fplToken && !alreadyConnected && !data.manuallyDisconnected) {
                    fetch(`${origin}/api/fpl/token`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${msg.fpwToken}` },
                        body: JSON.stringify({
                            fpl_token: data.fplToken,
                            fpl_refresh_token: data.fplRefreshToken || null,
                            fpl_expires_at: data.fplExpiresAt || null,
                            entry_id: data.fplEntryId || null
                        })
                    }).then(r => {
                        if (r.ok) chrome.storage.local.set({ fpwConnected: true });
                    }).catch(() => {});
                }
            });
        });
        sendResponse({ ok: true });
    }

    if (msg.type === 'FPL_TOKEN_FOUND' && msg.token) {
        // If this is a fresh page load (not SPA nav), clear the manual disconnect flag
        // so refresh / fresh login auto-connects
        const updates = {
            fplToken: msg.token,
            fplRefreshToken: msg.refreshToken || null,
            fplExpiresAt: msg.expiresAt || null,
            fplEntryId: msg.entryId || null,
            fplTokenSavedAt: Date.now()
        };
        if (msg.isPageLoad) updates.manuallyDisconnected = false;

        chrome.storage.local.set(updates, () => {
            chrome.action.setBadgeText({ text: '✓' });
            chrome.action.setBadgeBackgroundColor({ color: '#00ff87' });

            chrome.storage.local.get(['fpwToken', 'fpwOrigin', 'fpwConnected', 'manuallyDisconnected'], (data) => {
                if (data.fpwToken && !data.fpwConnected && !data.manuallyDisconnected) {
                    const origin = (data.fpwOrigin || 'http://localhost:3001').replace('5173', '3001');
                    fetch(`${origin}/api/fpl/token`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.fpwToken}` },
                        body: JSON.stringify({
                            fpl_token: msg.token,
                            fpl_refresh_token: msg.refreshToken || null,
                            fpl_expires_at: msg.expiresAt || null,
                            entry_id: msg.entryId || null
                        })
                    }).then(r => {
                        if (r.ok) chrome.storage.local.set({ fpwConnected: true });
                    }).catch(() => {});
                }
            });
        });
        sendResponse({ ok: true });
    }

    if (msg.type === 'GET_STORED_TOKEN') {
        chrome.storage.local.get(['fplToken', 'fplEntryId', 'fplTokenSavedAt', 'fpwToken', 'fpwOrigin', 'fpwConnected', 'manuallyDisconnected'], (data) => {
            sendResponse(data);
        });
        return true; // async response
    }

    if (msg.type === 'CLEAR_TOKEN') {
        chrome.storage.local.get(['fpwOrigin', 'fpwToken'], async (data) => {
            const fpwToken = data.fpwToken || msg.fpwToken;
            if (data.fpwOrigin && fpwToken) {
                try {
                    await fetch(`${data.fpwOrigin}/api/fpl/disconnect`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${fpwToken}`
                        }
                    });
                } catch {}
            }
            chrome.storage.local.remove(['fplToken', 'fplEntryId', 'fplTokenSavedAt', 'fpwConnected'], () => {
                chrome.storage.local.set({ manuallyDisconnected: true });
                chrome.action.setBadgeText({ text: '' });
                sendResponse({ ok: true });
            });
        });
        return true;
    }

    if (msg.type === 'RESET_CONNECTED_STATE') {
        chrome.storage.local.set({ fpwConnected: false }, () => sendResponse({ ok: true }));
        return true;
    }

    if (msg.type === 'SEND_TOKEN_TO_FPW') {
        // Send token to the FPW app via its API endpoint
        chrome.storage.local.get(['fplToken', 'fplRefreshToken', 'fplExpiresAt', 'fplEntryId'], async (data) => {
            if (!data.fplToken) {
                sendResponse({ ok: false, error: 'No token stored' });
                return;
            }

            const fpwToken = msg.fpwToken;
            const origin = msg.origin || FPW_ORIGINS[0];

            try {
                const resp = await fetch(`${origin}/api/fpl/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${fpwToken}`
                    },
                    body: JSON.stringify({
                        fpl_token: data.fplToken,
                        fpl_refresh_token: data.fplRefreshToken || null,
                        fpl_expires_at: data.fplExpiresAt || null,
                        entry_id: data.fplEntryId
                    })
                });
                const json = await resp.json();
                if (resp.ok) chrome.storage.local.set({ manuallyDisconnected: false });
                sendResponse({ ok: resp.ok, data: json });
            } catch (err) {
                sendResponse({ ok: false, error: err.message });
            }
        });
        return true; // async response
    }
});

// Clear badge if token is stale (> 1 hour)
chrome.storage.local.get(['fplTokenSavedAt'], (data) => {
    if (data.fplTokenSavedAt && Date.now() - data.fplTokenSavedAt > 3600000) {
        chrome.action.setBadgeText({ text: '' });
    } else if (data.fplTokenSavedAt) {
        chrome.action.setBadgeText({ text: '✓' });
        chrome.action.setBadgeBackgroundColor({ color: '#00ff87' });
    }
});
