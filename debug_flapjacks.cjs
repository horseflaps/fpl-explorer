
const https = require('https');

const fetchJson = (url) => new Promise((resolve, reject) => {
    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                resolve(JSON.parse(data));
            } catch (e) {
                resolve(null);
            }
        });
    }).on('error', reject);
});

// The logic from PitchView.tsx
const calculateFreeTransfers = (history, entryData, targetGw) => {
    console.log(`\n--- Calculating for GW${targetGw} ---`);
    if (!history || !history.current || history.current.length === 0) return 1;

    let available = 1;
    const chipsUsed = {};
    if (history.chips) {
        history.chips.forEach((c) => {
            chipsUsed[c.event] = c.name;
        });
    }

    const startedEvent = entryData?.started_event || 1;
    console.log(`Started Event: ${startedEvent}`);

    // Filter history to exclude target GW ( simulate state AT START of target GW )
    const relevantHistory = history.current.filter(gw => gw.event < targetGw);

    relevantHistory.forEach((gw) => {
        const eventId = gw.event;
        const transfersUsed = gw.event_transfers;
        const chip = chipsUsed[eventId];

        console.log(`GW${eventId}: Available ${available} - Used ${transfersUsed} (${chip || 'No Chip'})`);

        if (eventId === 1 || eventId === startedEvent) {
            console.log(` -> Reset to 1 (Start/Join)`);
            available = 1;
        } else if (chip === 'wildcard' || chip === 'freehit') {
            console.log(` -> Reset to 1 (Chip Played)`);
            available = 1;
        } else {
            const remaining = Math.max(0, available - transfersUsed);
            available = Math.min(5, remaining + 1);
            console.log(` -> New Balance: ${available}`);
        }
    });

    return available;
};

const runDebug = async (teamId, teamName) => {
    console.log(`\nFetching data for ${teamName} (${teamId})...`);

    // 1. Fetch Bootstrap for Current GW
    const bootstrap = await fetchJson('https://fantasy.premierleague.com/api/bootstrap-static/');
    const currentEvent = bootstrap.events.find(e => e.is_current);
    const nextEvent = bootstrap.events.find(e => e.is_next);

    // If we are mid-week, current is active. If we are pre-deadline, next is the one we plan for?
    // "Transfers available" usually refers to the UPCOMING deadline.
    // Use nextEvent ID if available, otherwise current + 1.
    const targetGw = nextEvent ? nextEvent.id : (currentEvent ? currentEvent.id + 1 : 38);

    console.log(`Current GW: ${currentEvent?.id}, Next GW: ${nextEvent?.id}. Targeting GW${targetGw} calculation.`);

    // 2. Fetch Entry & History
    const entry = await fetchJson(`https://fantasy.premierleague.com/api/entry/${teamId}/`);
    const history = await fetchJson(`https://fantasy.premierleague.com/api/entry/${teamId}/history/`);

    if (!entry || !history) {
        console.error("Failed to fetch entry/history");
        return;
    }

    require('fs').writeFileSync('flapjacks_history.json', JSON.stringify(history, null, 2));
    require('fs').writeFileSync('flapjacks_entry.json', JSON.stringify(entry, null, 2));
    console.log("Dumped history and entry.");

    // 2b. Fetch Transfer Status
    const status = await fetchJson(`https://fantasy.premierleague.com/api/entry/${teamId}/transfers-status/`); // Note: private endpoint usually?
    if (status) {
        console.log(`\n[API CHECK] Transfer Status:`, JSON.stringify(status, null, 2));
    } else {
        console.log(`\n[API CHECK] Transfer Status: NULL (Likely Private or Auth Required)`);
    }

    // 3. Run Calculation
    const calculated = calculateFreeTransfers(history, entry, targetGw);
    console.log(`\n>>> FINAL RESULT for ${teamName}: ${calculated} Transfers Available <<<\n`);
};

// exact match "Flapjacks"
runDebug(1505448, "Flapjacks");

const fs = require('fs');
// Monkey patch runDebug to dump file
const originalRunDebug = runDebug;
// Actually I'll just add the dump inside runDebug in the file.

