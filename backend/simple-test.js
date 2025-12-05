import http from 'http';

const BASE_URL = 'http://localhost:5001/api/auth';

function makeRequest(method, path, data = null, customHeaders = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5001,
            path: `/api/auth${path}`,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...customHeaders
            }
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function testAuth() {
    console.log('🧪 Testing BeautyBite Authentication System\n');

    try {
        // Generate unique email for each test run
        const timestamp = Date.now();
        const testEmail = `test${timestamp}@beautybite.com`;

        // Test 1: User Registration
        console.log('1. Testing User Registration...');
        const registerData = {
            email: testEmail,
            password: 'TestPassword123!',
            firstName: 'Test',
            lastName: 'User'
        };

        const registerResponse = await makeRequest('POST', '/register', registerData);
        console.log(`   Status: ${registerResponse.statusCode}`);
        console.log(`   Response: ${registerResponse.body}`);

        if (registerResponse.statusCode === 201) {
            console.log('✅ Registration successful\n');

            const registerBody = JSON.parse(registerResponse.body);
            const authToken = registerBody.token;
            const refreshToken = registerBody.refreshToken;

            // Test 2: User Login
            console.log('2. Testing User Login...');
            const loginResponse = await makeRequest('POST', '/login', {
                email: testEmail,
                password: 'TestPassword123!'
            });
            console.log(`   Status: ${loginResponse.statusCode}`);
            console.log(`   Response: ${loginResponse.body}`);

            if (loginResponse.statusCode === 200) {
                console.log('✅ Login successful\n');

                const loginBody = JSON.parse(loginResponse.body);
                const newAuthToken = loginBody.token;

                // Test 3: Get Current User (Protected Route)
                console.log('3. Testing Protected Route (Get Current User)...');
                const meResponse = await makeRequest('GET', '/me', null, {
                    'Authorization': `Bearer ${newAuthToken}`
                });
                console.log(`   Status: ${meResponse.statusCode}`);
                console.log(`   Response: ${meResponse.body}`);

                if (meResponse.statusCode === 200) {
                    console.log('✅ Protected route access successful\n');

                    // Test 4: Token Refresh
                    console.log('4. Testing Token Refresh...');
                    const refreshResponse = await makeRequest('POST', '/refresh', {
                        refreshToken: refreshToken
                    });
                    console.log(`   Status: ${refreshResponse.statusCode}`);
                    console.log(`   Response: ${refreshResponse.body}`);

                    if (refreshResponse.statusCode === 200) {
                        console.log('✅ Token refresh successful\n');

                        // Test 5: Logout
                        console.log('5. Testing User Logout...');
                        const logoutResponse = await makeRequest('POST', '/logout', {}, {
                            'Authorization': `Bearer ${newAuthToken}`
                        });
                        console.log(`   Status: ${logoutResponse.statusCode}`);
                        console.log(`   Response: ${logoutResponse.body}`);

                        if (logoutResponse.statusCode === 200) {
                            console.log('✅ Logout successful\n');
                        }
                    }
                }
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testAuth();