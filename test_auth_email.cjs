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
    console.log('--- Starting Auth Tests (Email Flow) ---');
    const timestamp = Date.now();
    const email = `test_email_${timestamp}@example.com`;
    const password = 'password123';
    const display_name = `User${timestamp}`;

    // 1. Signup
    console.log(`\n1. Testing Signup for ${email} with name ${display_name}...`);
    const signupRes = await request('POST', '/api/auth/signup', { email, password, display_name });

    if (signupRes.status === 201 && signupRes.data.token && signupRes.data.user.email === email && signupRes.data.user.displayname === display_name) {
        console.log('✅ Signup Passed');
    } else {
        console.error('❌ Signup Failed:', signupRes);
        process.exit(1);
    }

    // 2. Login
    console.log(`\n2. Testing Login for ${email}...`);
    const loginRes = await request('POST', '/api/auth/login', { email, password });

    if (loginRes.status === 200 && loginRes.data.token && loginRes.data.user.email === email && loginRes.data.user.displayname === display_name) {
        console.log('✅ Login Passed');
        console.log('   User:', loginRes.data.user);
    } else {
        console.error('❌ Login Failed:', loginRes);
        process.exit(1);
    }

    console.log('\nAll Tests Passed! 🚀');
}

runTests().catch(console.error);
