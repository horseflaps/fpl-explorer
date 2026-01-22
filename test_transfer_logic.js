
const calculateFreeTransfers = (history, entry) => {
    if (!history || !history.current || history.current.length === 0) return 1;

    let available = 1;
    const chipsUsed = {};
    if (history.chips) {
        history.chips.forEach((c) => {
            chipsUsed[c.event] = c.name;
        });
    }

    console.log(`Starting Calculation. Started Event: ${entry?.started_event}`);

    history.current.forEach((gw) => {
        const eventId = gw.event;
        const transfersUsed = gw.event_transfers;
        const chip = chipsUsed[eventId];

        console.log(`GW${eventId}: Available ${available}, Used ${transfersUsed}, Chip: ${chip || 'None'}`);

        // Logic check
        if (eventId === 1 || (entry && eventId === entry.started_event)) {
            console.log(` -> Unlimited Transfers (Start/GW1). Resetting next to 1.`);
            available = 1;
        } else if (chip === 'wildcard' || chip === 'freehit') {
            console.log(` -> Chip played. Resetting next to 1.`);
            available = 1;
        } else {
            const remaining = Math.max(0, available - transfersUsed);
            available = Math.min(5, remaining + 1); // Cap at 5
            console.log(` -> Normal. Remaining ${remaining}. Next: ${available}`);
        }
    });

    return available;
};

// Test Case 1: The "2 vs 3" scenario (Assuming rolling)
// Expectation: 3.
const history1 = {
    current: [
        { event: 19, event_transfers: 1 }, // Had 1, used 1. Next: 1.
        { event: 20, event_transfers: 0 }, // Had 1, used 0. Next: 2.
        { event: 21, event_transfers: 0 }, // Had 2, used 0. Next: 3.
    ],
    chips: []
};
console.log("\nTest Case 1 (Expected 3):", calculateFreeTransfers(history1, { started_event: 1 }));


// Test Case 2: The "0 vs 5" scenario
// Maybe they played Free Hit last week?
const history2 = {
    current: [
        { event: 19, event_transfers: 0 },
        { event: 20, event_transfers: 0 },
        { event: 21, event_transfers: 0 }, // If logic was dumb, it would say 4 or 5
    ],
    chips: [{ event: 21, name: 'freehit' }]
};
// If FH in 21, they should have 1 in GW22.
console.log("\nTest Case 2 (FH played GW21 - Expected 1):", calculateFreeTransfers(history2, { started_event: 1 }));

// Test Case 3: Joined late, hasn't played.
const history3 = {
    current: [
        { event: 19, event_transfers: 0 }, // Joined here. Unlimited.
        { event: 20, event_transfers: 0 }, // Had 1 (reset), Used 0. Next 2.
        { event: 21, event_transfers: 0 }, // Had 2, Used 0. Next 3.
    ],
    chips: []
};
// If started event is 19.
console.log("\nTest Case 3 (Joined GW19 - Expected 3):", calculateFreeTransfers(history3, { started_event: 19 }));

