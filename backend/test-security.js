import axios from 'axios';
import { performance } from 'perf_hooks';

// Security test configuration
const TEST_CONFIG = {
    baseURL: 'http://localhost:5000',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Security-Test-Script/1.0'
    }
};

// Test results storage
const testResults = {
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
};

// Helper function to log test results
function logTestResult(testName, passed, message = '', details = {}) {
    const result = {
        test: testName,
        status: passed ? 'PASSED' : 'FAILED',
        message,
        timestamp: new Date().toISOString(),
        details
    };

    testResults.details.push(result);

    if (passed) {
        testResults.passed++;
        console.log(`✅ ${testName}: PASSED - ${message}`);
    } else {
        testResults.failed++;
        console.error(`❌ ${testName}: FAILED - ${message}`);
    }
}

// Helper function to log warning
function logWarning(testName, message, details = {}) {
    testResults.warnings++;
    testResults.details.push({
        test: testName,
        status: 'WARNING',
        message,
        timestamp: new Date().toISOString(),
        details
    });
    console.warn(`⚠️ ${testName}: WARNING - ${message}`);
}

// Security test suite
class SecurityTestSuite {
    constructor() {
        this.client = axios.create(TEST_CONFIG);
    }

    // Test 1: Check security headers
    async testSecurityHeaders() {
        try {
            const response = await this.client.get('/health');
            const headers = response.headers;

            const requiredHeaders = {
                'x-content-type-options': 'nosniff',
                'x-frame-options': 'DENY',
                'x-xss-protection': '1; mode=block',
                'strict-transport-security': (value) => value.includes('max-age=31536000'),
                'content-security-policy': (value) => value.includes("default-src 'self'")
            };

            let allHeadersPresent = true;
            let missingHeaders = [];

            for (const [header, expected] of Object.entries(requiredHeaders)) {
                const value = headers[header] || headers[header.toLowerCase()];

                if (!value) {
                    allHeadersPresent = false;
                    missingHeaders.push(header);
                } else if (typeof expected === 'function') {
                    if (!expected(value)) {
                        allHeadersPresent = false;
                        missingHeaders.push(`${header} (invalid value: ${value})`);
                    }
                } else if (value !== expected) {
                    allHeadersPresent = false;
                    missingHeaders.push(`${header} (expected: ${expected}, got: ${value})`);
                }
            }

            if (allHeadersPresent) {
                logTestResult('Security Headers', true, 'All security headers are properly configured');
            } else {
                logTestResult('Security Headers', false, `Missing or invalid security headers: ${missingHeaders.join(', ')}`);
            }
        } catch (error) {
            logTestResult('Security Headers', false, `Error testing security headers: ${error.message}`);
        }
    }

    // Test 2: Test CORS configuration
    async testCORSConfiguration() {
        try {
            // Test with allowed origin
            const allowedResponse = await this.client.get('/health', {
                headers: {
                    'Origin': 'http://localhost:3000'
                }
            });

            const corsHeaders = allowedResponse.headers['access-control-allow-origin'];
            if (corsHeaders && corsHeaders.includes('localhost:3000')) {
                logTestResult('CORS Configuration - Allowed Origin', true, 'CORS properly allows configured origins');
            } else {
                logTestResult('CORS Configuration - Allowed Origin', false, 'CORS not properly configured for allowed origins');
            }

            // Test with disallowed origin
            try {
                await axios.get(`${TEST_CONFIG.baseURL}/health`, {
                    headers: {
                        'Origin': 'http://evil.com'
                    }
                });
                logTestResult('CORS Configuration - Disallowed Origin', false, 'CORS allowed request from disallowed origin');
            } catch (error) {
                if (error.response && error.response.status === 403) {
                    logTestResult('CORS Configuration - Disallowed Origin', true, 'CORS properly blocked disallowed origin');
                } else {
                    logTestResult('CORS Configuration - Disallowed Origin', false, `Unexpected error: ${error.message}`);
                }
            }
        } catch (error) {
            logTestResult('CORS Configuration', false, `Error testing CORS: ${error.message}`);
        }
    }

    // Test 3: Test rate limiting
    async testRateLimiting() {
        try {
            const requests = [];
            const startTime = performance.now();

            // Make multiple rapid requests to trigger rate limiting
            for (let i = 0; i < 15; i++) {
                requests.push(
                    this.client.get('/health').catch(error => error)
                );
            }

            const responses = await Promise.all(requests);
            const endTime = performance.now();

            const rateLimited = responses.some(response =>
                response.response && response.response.status === 429
            );

            const requestDuration = endTime - startTime;

            if (rateLimited) {
                logTestResult('Rate Limiting', true, 'Rate limiting properly triggered after multiple requests');
            } else {
                logTestResult('Rate Limiting', false, 'Rate limiting not triggered for rapid requests');
            }

            if (requestDuration < 5000) {
                logTestResult('Rate Limiting Performance', true, 'Rate limiting responses are fast');
            } else {
                logWarning('Rate Limiting Performance', 'Rate limiting responses are slow', { duration: requestDuration });
            }
        } catch (error) {
            logTestResult('Rate Limiting', false, `Error testing rate limiting: ${error.message}`);
        }
    }

    // Test 4: Test authentication rate limiting
    async testAuthRateLimiting() {
        try {
            const authRequests = [];

            // Make multiple auth attempts
            for (let i = 0; i < 6; i++) {
                authRequests.push(
                    this.client.post('/api/auth/login', {
                        email: `test${i}@example.com`,
                        password: 'wrongpassword'
                    }).catch(error => error)
                );
            }

            const responses = await Promise.all(authRequests);
            const rateLimited = responses.some(response =>
                response.response && response.response.status === 429
            );

            if (rateLimited) {
                logTestResult('Authentication Rate Limiting', true, 'Authentication rate limiting properly triggered');
            } else {
                logTestResult('Authentication Rate Limiting', false, 'Authentication rate limiting not triggered');
            }
        } catch (error) {
            logTestResult('Authentication Rate Limiting', false, `Error testing auth rate limiting: ${error.message}`);
        }
    }

    // Test 5: Test SQL injection protection
    async testSQLInjectionProtection() {
        const sqlInjectionPayloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "1' UNION SELECT 1,2,3--",
            "admin' --"
        ];

        let blockedCount = 0;

        for (const payload of sqlInjectionPayloads) {
            try {
                await this.client.get(`/api/products?search=${encodeURIComponent(payload)}`);
                // If request succeeds, injection might not be blocked
                logWarning('SQL Injection Protection', `Potential SQL injection payload not blocked: ${payload}`);
            } catch (error) {
                if (error.response && (error.response.status === 400 || error.response.status === 403)) {
                    blockedCount++;
                }
            }
        }

        const successRate = (blockedCount / sqlInjectionPayloads.length) * 100;
        if (successRate >= 75) {
            logTestResult('SQL Injection Protection', true, `Blocked ${blockedCount}/${sqlInjectionPayloads.length} SQL injection attempts`);
        } else {
            logTestResult('SQL Injection Protection', false, `Only blocked ${blockedCount}/${sqlInjectionPayloads.length} SQL injection attempts`);
        }
    }

    // Test 6: Test XSS protection
    async testXSSProtection() {
        const xssPayloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')",
            "<body onload=alert('XSS')>"
        ];

        let blockedCount = 0;

        for (const payload of xssPayloads) {
            try {
                await this.client.post('/api/products', {
                    name: payload,
                    description: 'Test product'
                });
                logWarning('XSS Protection', `Potential XSS payload not blocked: ${payload}`);
            } catch (error) {
                if (error.response && (error.response.status === 400 || error.response.status === 403)) {
                    blockedCount++;
                }
            }
        }

        const successRate = (blockedCount / xssPayloads.length) * 100;
        if (successRate >= 75) {
            logTestResult('XSS Protection', true, `Blocked ${blockedCount}/${xssPayloads.length} XSS attempts`);
        } else {
            logTestResult('XSS Protection', false, `Only blocked ${blockedCount}/${xssPayloads.length} XSS attempts`);
        }
    }

    // Test 7: Test input validation
    async testInputValidation() {
        const invalidInputs = [
            { email: 'invalid-email', password: 'short' },
            { email: 'test@example.com', password: '' },
            { email: '', password: 'validpassword123' },
            { email: 'a'.repeat(256) + '@example.com', password: 'validpassword123' }
        ];

        let validatedCount = 0;

        for (const input of invalidInputs) {
            try {
                await this.client.post('/api/auth/register', input);
                logWarning('Input Validation', `Invalid input not rejected: ${JSON.stringify(input)}`);
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    validatedCount++;
                }
            }
        }

        const successRate = (validatedCount / invalidInputs.length) * 100;
        if (successRate >= 75) {
            logTestResult('Input Validation', true, `Validated ${validatedCount}/${invalidInputs.length} invalid inputs`);
        } else {
            logTestResult('Input Validation', false, `Only validated ${validatedCount}/${invalidInputs.length} invalid inputs`);
        }
    }

    // Test 8: Test security monitoring
    async testSecurityMonitoring() {
        try {
            // Trigger some security events
            await this.testSQLInjectionProtection();
            await this.testXSSProtection();
            await this.testAuthRateLimiting();

            // Wait a bit for events to be processed
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check security report (only in development)
            if (process.env.NODE_ENV !== 'production') {
                const reportResponse = await this.client.get('/api/security/report');
                const report = reportResponse.data;

                if (report.success && report.data && report.data.summary) {
                    logTestResult('Security Monitoring', true, 'Security monitoring is active and reporting');
                    console.log('📊 Security Report Summary:', report.data.summary);
                } else {
                    logTestResult('Security Monitoring', false, 'Security monitoring report not available');
                }
            } else {
                logWarning('Security Monitoring', 'Security report endpoint disabled in production (expected)');
            }
        } catch (error) {
            if (error.response && error.response.status === 403) {
                logWarning('Security Monitoring', 'Security report endpoint blocked in production (expected)');
            } else {
                logTestResult('Security Monitoring', false, `Error testing security monitoring: ${error.message}`);
            }
        }
    }

    // Test 9: Test error handling (no information leakage)
    async testErrorHandling() {
        try {
            // Trigger a 404 error
            const response = await this.client.get('/nonexistent-endpoint').catch(error => error.response);

            if (response && response.status === 404) {
                const responseBody = response.data;

                // Check that error response doesn't leak sensitive information
                const sensitiveInfo = ['stack', 'error.stack', 'path', 'sql', 'database', 'password'];
                let infoLeaked = false;
                let leakedFields = [];

                const checkObject = (obj, path = '') => {
                    for (const [key, value] of Object.entries(obj)) {
                        const currentPath = path ? `${path}.${key}` : key;

                        if (sensitiveInfo.some(info => currentPath.includes(info))) {
                            infoLeaked = true;
                            leakedFields.push(currentPath);
                        }

                        if (typeof value === 'object' && value !== null) {
                            checkObject(value, currentPath);
                        }
                    }
                };

                checkObject(responseBody);

                if (!infoLeaked) {
                    logTestResult('Error Handling', true, 'Error responses do not leak sensitive information');
                } else {
                    logTestResult('Error Handling', false, `Error response leaks sensitive information: ${leakedFields.join(', ')}`);
                }
            } else {
                logTestResult('Error Handling', false, 'Unexpected response for non-existent endpoint');
            }
        } catch (error) {
            logTestResult('Error Handling', false, `Error testing error handling: ${error.message}`);
        }
    }

    // Test 10: Test session security
    async testSessionSecurity() {
        try {
            const response = await this.client.get('/health');
            const cookies = response.headers['set-cookie'];

            if (cookies) {
                const sessionCookie = cookies.find(cookie => cookie.includes('beautybite.sid'));

                if (sessionCookie) {
                    const hasHttpOnly = sessionCookie.includes('HttpOnly');
                    const hasSecure = sessionCookie.includes('Secure') || process.env.NODE_ENV !== 'production';
                    const hasSameSite = sessionCookie.includes('SameSite');

                    if (hasHttpOnly && hasSecure && hasSameSite) {
                        logTestResult('Session Security', true, 'Session cookies are properly secured');
                    } else {
                        const missing = [];
                        if (!hasHttpOnly) missing.push('HttpOnly');
                        if (!hasSecure) missing.push('Secure');
                        if (!hasSameSite) missing.push('SameSite');
                        logTestResult('Session Security', false, `Session cookies missing security attributes: ${missing.join(', ')}`);
                    }
                } else {
                    logTestResult('Session Security', false, 'No session cookie found');
                }
            } else {
                logTestResult('Session Security', false, 'No cookies set in response');
            }
        } catch (error) {
            logTestResult('Session Security', false, `Error testing session security: ${error.message}`);
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('🔒 Starting Security Test Suite...\n');

        const tests = [
            this.testSecurityHeaders.bind(this),
            this.testCORSConfiguration.bind(this),
            this.testRateLimiting.bind(this),
            this.testAuthRateLimiting.bind(this),
            this.testSQLInjectionProtection.bind(this),
            this.testXSSProtection.bind(this),
            this.testInputValidation.bind(this),
            this.testSecurityMonitoring.bind(this),
            this.testErrorHandling.bind(this),
            this.testSessionSecurity.bind(this)
        ];

        for (const test of tests) {
            await test();
            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        this.printSummary();
    }

    // Print test summary
    printSummary() {
        console.log('\n' + '='.repeat(50));
        console.log('🔒 SECURITY TEST SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Passed: ${testResults.passed}`);
        console.log(`❌ Failed: ${testResults.failed}`);
        console.log(`⚠️ Warnings: ${testResults.warnings}`);
        console.log(`📊 Total: ${testResults.details.length}`);

        const successRate = (testResults.passed / testResults.details.length) * 100;
        console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);

        if (testResults.failed > 0) {
            console.log('\n🔍 Failed Tests:');
            testResults.details
                .filter(result => result.status === 'FAILED')
                .forEach(result => {
                    console.log(`   - ${result.test}: ${result.message}`);
                });
        }

        if (testResults.warnings > 0) {
            console.log('\n💡 Warnings:');
            testResults.details
                .filter(result => result.status === 'WARNING')
                .forEach(result => {
                    console.log(`   - ${result.test}: ${result.message}`);
                });
        }

        console.log('\n' + '='.repeat(50));

        if (testResults.failed === 0) {
            console.log('🎉 All critical security tests passed!');
            process.exit(0);
        } else {
            console.log('🚨 Some security tests failed. Please review and fix.');
            process.exit(1);
        }
    }
}

// Run the security test suite
const securityTest = new SecurityTestSuite();

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Security Test Suite for BeautyBite

Usage:
  node test-security.js          # Run all security tests
  node test-security.js --help   # Show this help message

Tests Included:
  - Security Headers
  - CORS Configuration
  - Rate Limiting
  - Authentication Rate Limiting
  - SQL Injection Protection
  - XSS Protection
  - Input Validation
  - Security Monitoring
  - Error Handling
  - Session Security

Make sure the backend server is running on http://localhost:5000 before running tests.
    `);
    process.exit(0);
}

// Start the tests
securityTest.runAllTests().catch(error => {
    console.error('❌ Error running security tests:', error);
    process.exit(1);
});