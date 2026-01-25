const http = require('http');

const options = (method, path, body) => ({
    hostname: 'localhost',
    port: 3001,
    path,
    method,
    headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
    }
});

function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const body = data ? JSON.stringify(data) : null;
        const req = http.request(options(method, path, body), (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function runTest() {
    const username = "MixedCaseUser";
    const password = "password";

    console.log(`Creating user: ${username}`);
    const res = await request('POST', '/api/auth/signup', { username, password });
    console.log('Signup Response:', res.status, res.data);
}

runTest();
