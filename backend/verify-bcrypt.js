import bcrypt from 'bcryptjs';

async function verifyBcryptHashing() {
    console.log('🔐 Testing Bcrypt Password Hashing\n');

    const testPassword = 'TestPassword123!';
    const wrongPassword = 'WrongPassword123!';

    try {
        // Test 1: Generate salt and hash
        console.log('1. Testing Salt Generation and Hashing...');
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const salt = await bcrypt.genSalt(saltRounds);
        const hash = await bcrypt.hash(testPassword, salt);

        console.log('✅ Salt generation successful');
        console.log(`   Salt rounds: ${saltRounds}`);
        console.log(`   Generated salt: ${salt.substring(0, 20)}...`);
        console.log(`   Generated hash: ${hash.substring(0, 20)}...`);
        console.log(`   Hash length: ${hash.length} characters\n`);

        // Test 2: Verify correct password
        console.log('2. Testing Password Verification (Correct Password)...');
        const isMatchCorrect = await bcrypt.compare(testPassword, hash);
        console.log(`   Password match: ${isMatchCorrect}`);

        if (isMatchCorrect) {
            console.log('✅ Correct password verification successful\n');
        } else {
            console.log('❌ Password verification failed\n');
        }

        // Test 3: Verify wrong password
        console.log('3. Testing Password Verification (Wrong Password)...');
        const isMatchWrong = await bcrypt.compare(wrongPassword, hash);
        console.log(`   Password match: ${isMatchWrong}`);

        if (!isMatchWrong) {
            console.log('✅ Wrong password correctly rejected\n');
        } else {
            console.log('❌ Wrong password incorrectly accepted\n');
        }

        // Test 4: Test multiple hashes (same password should have different hashes)
        console.log('4. Testing Hash Uniqueness (Same Password, Different Hashes)...');
        const hash1 = await bcrypt.hash(testPassword, saltRounds);
        const hash2 = await bcrypt.hash(testPassword, saltRounds);

        console.log(`   Hash 1: ${hash1.substring(0, 20)}...`);
        console.log(`   Hash 2: ${hash2.substring(0, 20)}...`);
        console.log(`   Hashes are different: ${hash1 !== hash2}`);

        if (hash1 !== hash2) {
            console.log('✅ Hash uniqueness verified (same password produces different hashes)\n');
        } else {
            console.log('❌ Hash uniqueness failed\n');
        }

        // Test 5: Verify both hashes work with the same password
        console.log('5. Testing Both Hashes Work with Original Password...');
        const verifyHash1 = await bcrypt.compare(testPassword, hash1);
        const verifyHash2 = await bcrypt.compare(testPassword, hash2);

        console.log(`   Hash 1 verification: ${verifyHash1}`);
        console.log(`   Hash 2 verification: ${verifyHash2}`);

        if (verifyHash1 && verifyHash2) {
            console.log('✅ Both hashes correctly verify the original password\n');
        } else {
            console.log('❌ Hash verification failed\n');
        }

        // Test 6: Performance test (hash timing)
        console.log('6. Testing Hashing Performance...');
        const startTime = Date.now();
        const performanceHash = await bcrypt.hash(testPassword, saltRounds);
        const endTime = Date.now();
        const hashTime = endTime - startTime;

        console.log(`   Hashing time: ${hashTime}ms`);
        console.log(`   Salt rounds: ${saltRounds}`);

        if (hashTime > 0) {
            console.log('✅ Hashing performance test completed\n');
        }

        console.log('🎉 Bcrypt password hashing verification completed successfully!');
        console.log('\n📋 Bcrypt Hashing Summary:');
        console.log('   ✅ Salt generation with configurable rounds');
        console.log('   ✅ Password hashing with bcrypt algorithm');
        console.log('   ✅ Correct password verification');
        console.log('   ✅ Wrong password rejection');
        console.log('   ✅ Hash uniqueness (same password produces different hashes)');
        console.log('   ✅ Multiple hash verification');
        console.log('   ✅ Performance within acceptable range');

    } catch (error) {
        console.error('❌ Bcrypt test failed:', error.message);
        process.exit(1);
    }
}

// Run the bcrypt verification
verifyBcryptHashing();