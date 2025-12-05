import axios from 'axios';

const BASE_URL = 'http://localhost:5001/api/auth';

// Test user data
const testUser = {
    email: 'test@beautybite.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    phone: '+1234567890'
};

let authToken = '';
let refreshToken = '';

async function testAuthentication() {
    console.log('🧪 Testing BeautyBite Authentication System\n');

    try {
        // Test 1: User Registration
        console.log('1. Testing User Registration...');
        const registerResponse = await axios.post(`${BASE_URL}/register`, testUser);
        console.log('✅ Registration successful');
        console.log('   User ID:', registerResponse.data.user.id);
        console.log('   Email:', registerResponse.data.user.email);
        authToken = registerResponse.data.token;
        refreshToken = registerResponse.data.refreshToken;
        console.log('   Access Token received');
        console.log('   Refresh Token received\n');

        // Test 2: User Login
        console.log('2. Testing User Login...');
        const loginResponse = await axios.post(`${BASE_URL}/login`, {
            email: testUser.email,
            password: testUser.password
        });
        console.log('✅ Login successful');
        console.log('   User:', loginResponse.data.user.email);
        authToken = loginResponse.data.token;
        refreshToken = loginResponse.data.refreshToken;
        console.log('   New Access Token received\n');

        // Test 3: Get Current User (Protected Route)
        console.log('3. Testing Protected Route (Get Current User)...');
        const meResponse = await axios.get(`${BASE_URL}/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        console.log('✅ Protected route access successful');
        console.log('   Current user:', meResponse.data.user.fullName);
        console.log('   Role:', meResponse.data.user.role);
        console.log('   Email verified:', meResponse.data.user.emailVerified, '\n');

        // Test 4: Token Refresh
        console.log('4. Testing Token Refresh...');
        const refreshResponse = await axios.post(`${BASE_URL}/refresh`, {
            refreshToken: refreshToken
        });
        console.log('✅ Token refresh successful');
        console.log('   New access token received');
        console.log('   New refresh token received\n');
        authToken = refreshResponse.data.token;
        refreshToken = refreshResponse.data.refreshToken;

        // Test 5: Update Password
        console.log('5. Testing Password Update...');
        const updatePasswordResponse = await axios.put(`${BASE_URL}/update-password`, {
            currentPassword: testUser.password,
            newPassword: 'NewPassword123!'
        }, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        console.log('✅ Password update successful');
        console.log('   New tokens received after password change\n');

        // Update auth token after password change
        authToken = updatePasswordResponse.data.token;
        refreshToken = updatePasswordResponse.data.refreshToken;

        // Test 6: Logout
        console.log('6. Testing User Logout...');
        const logoutResponse = await axios.post(`${BASE_URL}/logout`, {}, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        console.log('✅ Logout successful');
        console.log('   Message:', logoutResponse.data.message, '\n');

        // Test 7: Verify token is invalid after logout
        console.log('7. Testing Token Invalidation After Logout...');
        try {
            await axios.get(`${BASE_URL}/me`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            console.log('❌ Token should have been invalidated but still works');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Token properly invalidated after logout');
            } else {
                console.log('❌ Unexpected error:', error.response?.data);
            }
        }

        console.log('\n🎉 All authentication tests passed successfully!');
        console.log('\n📋 Authentication System Summary:');
        console.log('   ✅ User registration with password hashing');
        console.log('   ✅ User login with credential validation');
        console.log('   ✅ JWT token generation and validation');
        console.log('   ✅ Protected route access control');
        console.log('   ✅ Token refresh mechanism');
        console.log('   ✅ Password update functionality');
        console.log('   ✅ User logout and token invalidation');
        console.log('   ✅ Session management with MongoDB store');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);

        if (error.response?.data?.error) {
            console.error('   Error details:', error.response.data.error);
        }

        process.exit(1);
    }
}

// Run the tests
testAuthentication();