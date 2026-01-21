async function measure() {
    const start = performance.now();
    try {
        const res = await fetch('http://localhost:5173/api/team-search?q=Manchester');
        const data = await res.json();
        const msg = `Status: ${res.status}, Count: ${data.length}`;
        console.log(msg);
        if (data.length > 0) {
            console.log('First result:', JSON.stringify(data[0]));
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
    const end = performance.now();
    console.log(`Time: ${(end - start).toFixed(2)}ms`); // Total round trip
}

measure();
