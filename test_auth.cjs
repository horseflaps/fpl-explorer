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

function request(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const body = data ? JSON.stringify(data) : null;
        const opts = options(method, path, body);
        if (token) opts.headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function runTests() {
    console.log('--- Starting Auth Tests ---');
    const username = `test_${Date.now()}`;
    const password = 'password123';

    // 1. Signup
    console.log(`\n1. Testing Signup for ${username}...`);
    const signupRes = await request('POST', '/api/auth/signup', { username, password });

    if (signupRes.status === 201 && signupRes.data.token) {
        console.log('✅ Signup Passed');
    } else {
        console.error('❌ Signup Failed:', signupRes);
        process.exit(1);
    }

    // 2. Login
    console.log(`\n2. Testing Login for ${username}...`);
    const loginRes = await request('POST', '/api/auth/login', { username, password });

    if (loginRes.status === 200 && loginRes.data.token) {
        console.log('✅ Login Passed');
    } else {
        console.error('❌ Login Failed:', loginRes);
        process.exit(1);
    }

    const token = loginRes.data.token;

    // 3. Me (Persistence/Token Check)
    console.log(`\n3. Testing /me endpoint...`);
    const meRes = await request('GET', '/api/auth/me', null, token);

    if (meRes.status === 200 && meRes.data.user.username === username) {
        console.log('✅ Token Verification Passed');
    } else {
        console.error('❌ Token Verification Failed:', meRes);
        process.exit(1);
    }

    console.log('\nAll Tests Passed! 🚀');
}

runTests().catch(console.error);
