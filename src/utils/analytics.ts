// Analytics utility — pushes events to GTM dataLayer.
// GTM is responsible for forwarding to GA4 or any other tag.
// Usage: track('analysis_run', { entry_id: 123, gw: 36, success: true })

declare global {
    interface Window {
        dataLayer: Record<string, any>[];
    }
}

window.dataLayer = window.dataLayer || [];

const isProd = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

export function track(event: string, properties?: Record<string, any>) {
    if (!isProd) return;
    window.dataLayer.push({ event, ...properties });
}

// Identify the logged-in user so GTM/GA4 can attach events to a user.
// Call this on login and on app load when a session is restored.
export function identifyUser(userId: number, properties?: { tier?: number; email?: string }) {
    if (!isProd) return;
    window.dataLayer.push({
        event: 'User Identified',
        user_id: String(userId),
        membership_tier: properties?.tier ?? null,
        user_email: properties?.email ?? null,
    });
}

// Clear user identity on logout
export function clearUser() {
    if (!isProd) return;
    window.dataLayer.push({ event: 'User Logged Out', user_id: undefined, membership_tier: undefined });
}
