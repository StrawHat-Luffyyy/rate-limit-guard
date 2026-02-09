// src/tests/redis-check.js
import redisClient, { healthCheck, closeRedis } from '../config/redis.js';

const runTest = async () => {
  console.log('\n--- Starting Redis Connection Test ---\n');

  //  Wait for the connection to be ready before sending commands
  if (redisClient.status !== 'ready') {
    console.log('Waiting for Redis to be ready...');
    await new Promise((resolve, reject) => {
      redisClient.once('ready', resolve);
      redisClient.once('error', reject);
      
      // Safety timeout in case it never connects
      setTimeout(() => {
        if (redisClient.status !== 'ready') reject(new Error('Connection timeout'));
      }, 5000); 
    });
    console.log('Redis is ready!');
  }

  // 1. Check Health
  console.log('\n1. Running Health Check...');
  const health = await healthCheck();
  console.log('   Result:', health);

  if (health.status !== 'healthy') {
    console.error('   Aborting test due to unhealthy connection.');
    process.exit(1);
  }

  // 2. Test Write
  console.log('\n2. Testing Write Operation...');
  const testKey = 'test:connection_check';
  // 'EX' sets expiry in seconds (60s)
  await redisClient.set(testKey, 'Hello Redis', 'EX', 60); 
  console.log(`   Key set: ${testKey}`);

  // 3. Test Read
  console.log('\n3. Testing Read Operation...');
  const value = await redisClient.get(testKey);
  console.log(`   Value retrieved: "${value}"`);

  if (value === 'Hello Redis') {
    console.log(' Read/Write verification passed');
  } else {
    console.error('   Value mismatch');
  }

  // 4. Test Delete
  console.log('\n4. Cleaning up...');
  await redisClient.del(testKey);
  console.log('   Key deleted.');

  // 5. Shutdown
  console.log('\n5. Closing connection...');
  await closeRedis();
  console.log('   Done.');
};

runTest().catch(err => {
  console.error('Test Failed:', err.message);
  process.exit(1);
});