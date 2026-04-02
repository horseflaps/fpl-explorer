// Test: Change captaincy using stored FPL token
// Usage: node scripts/test_captain.cjs <entry_id> <new_captain_name>
// Example: node scripts/test_captain.cjs 8160392 "Enzo"

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = 'T:\\My Drive\\FPL\\db\\users.db';
const FPL_BASE = 'https://fantasy.premierleague.com/api';

async function run() {
    const entryId = process.argv[2];
    const newCaptainName = process.argv[3] || 'Enzo';

    if (!entryId) {
        console.error('Usage: node test_captain.cjs <entry_id> <captain_name>');
        process.exit(1);
    }

    // Get token from DB
    const token = await new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH);
        db.get('SELECT fpl_session FROM users WHERE fpl_entry_id = ? AND fpl_session IS NOT NULL', [entryId], (err, row) => {
            db.close();
            if (err) reject(err);
            else resolve(row?.fpl_session);
        });
    });

    if (!token) {
        console.error('No FPL token found for entry', entryId, '— connect via browser extension first');
        process.exit(1);
    }

    console.log('✓ Token found');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Origin': 'https://fantasy.premierleague.com',
        'Referer': 'https://fantasy.premierleague.com/',
    };

    // 1. Fetch current team
    console.log(`Fetching current team for entry ${entryId}...`);
    const teamRes = await fetch(`${FPL_BASE}/my-team/${entryId}/`, { headers });

    if (!teamRes.ok) {
        const txt = await teamRes.text();
        console.error(`Failed to fetch team: ${teamRes.status}`, txt);
        process.exit(1);
    }

    const teamData = await teamRes.json();
    console.log('✓ Current team fetched');

    // 2. Fetch bootstrap to get player names
    const bootRes = await fetch(`${FPL_BASE}/bootstrap-static/`);
    const boot = await bootRes.json();
    const playerMap = Object.fromEntries(boot.elements.map(p => [p.id, p]));

    // Show current picks
    console.log('\nCurrent picks:');
    teamData.picks.forEach(p => {
        const player = playerMap[p.element];
        const flags = [p.is_captain ? '©' : '', p.is_vice_captain ? '(vc)' : ''].filter(Boolean).join('');
        console.log(`  ${p.position}. ${player?.web_name} ${flags}`);
    });

    // 3. Find current captain and new captain
    const currentCaptain = teamData.picks.find(p => p.is_captain);
    const newCaptainPick = teamData.picks.find(p => {
        const player = playerMap[p.element];
        return player?.web_name?.toLowerCase().includes(newCaptainName.toLowerCase()) ||
               player?.first_name?.toLowerCase().includes(newCaptainName.toLowerCase()) ||
               player?.second_name?.toLowerCase().includes(newCaptainName.toLowerCase());
    });

    if (!newCaptainPick) {
        console.error(`\nCould not find player matching "${newCaptainName}" in your squad`);
        console.log('Players in squad:', teamData.picks.map(p => playerMap[p.element]?.web_name).join(', '));
        process.exit(1);
    }

    const currentCaptainName = playerMap[currentCaptain?.element]?.web_name;
    const newCaptainFull = playerMap[newCaptainPick.element]?.web_name;
    console.log(`\nChanging captain: ${currentCaptainName} → ${newCaptainFull}`);

    // 4. Build updated picks array
    const updatedPicks = teamData.picks.map(p => ({
        element: p.element,
        position: p.position,
        is_captain: p.element === newCaptainPick.element,
        is_vice_captain: p.is_vice_captain && p.element !== newCaptainPick.element
            ? true
            : p.element === currentCaptain?.element && !p.is_vice_captain
                ? false
                : p.is_vice_captain,
    }));

    // 5. POST the change
    const updateRes = await fetch(`${FPL_BASE}/my-team/${entryId}/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ picks: updatedPicks, chips: null }),
    });

    const updateBody = await updateRes.text();
    console.log(`\nResponse: ${updateRes.status}`);
    console.log(updateBody);

    if (updateRes.ok) {
        console.log(`\n✓ Captain successfully changed to ${newCaptainFull}!`);
    } else {
        console.error('\n✗ Failed to update captain');
    }
}

run().catch(console.error);
