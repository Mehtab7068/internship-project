require('dotenv').config();
// Force mock payment mode BEFORE requiring the app so PaymentService
// constructs in mock mode regardless of local .env contents.
process.env.RAZORPAY_MOCK = 'true';

const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const User = require('../src/models/User');
const Competition = require('../src/models/Competition');
const Judge = require('../src/models/Judge');

const PORT = 4006;

const request = (method, path, body = null, token = null) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', (err) => resolve({ status: 500, error: err.message }));

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
};

const runConcurrencyTest = async () => {
  console.log('--- Starting Concurrency Test ---');
  let passed = 0;
  let failed = 0;
  let server;

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details}`);
      failed++;
    }
  };

  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/feedants_test';
    await mongoose.connect(MONGO_URI);
    await User.deleteMany({});
    await Competition.deleteMany({});

    server = app.listen(PORT);

    // 1. Create a judge (Competition.judge is a required ObjectId ref)
    const judgeDoc = await Judge.create({
      name: 'Concurrency Judge',
      photoUrl: 'https://example.com/judge.jpg',
      title: 'Test Judge',
      experienceYears: 5
    });

    // 2. Create a competition with exactly 3 spots (correct schema field names)
    const compData = {
      title: 'Concurrency Test Competition',
      category: 'Test',
      prizePool: 1000,
      entryFee: 100,
      totalSpots: 3,
      bookedSpots: 0,
      registerBeforeAt: new Date(Date.now() + 86400000),
      submissionStartAt: new Date(Date.now() + 86400000 * 2),
      submissionEndAt: new Date(Date.now() + 86400000 * 3),
      resultAt: new Date(Date.now() + 86400000 * 4),
      description: 'Testing concurrency',
      status: 'registration_open',
      judge: judgeDoc._id
    };

    const comp = await Competition.create(compData);
    const competitionId = comp._id.toString();

    // 3. Create 10 test users and login to get tokens
    const tokens = [];
    const passwordHash = await bcrypt.hash('password123', 10);

    console.log('Creating 10 users...');
    for (let i = 0; i < 10; i++) {
      const email = `user${i}@test.com`;
      await User.create({
        name: `User ${i}`,
        email,
        passwordHash,
        role: 'USER'
      });

      const loginRes = await request('POST', '/api/auth/login', {
        email,
        password: 'password123'
      });

      const token = loginRes.data.token || (loginRes.data.data && loginRes.data.data.token);
      if (token) {
        tokens.push(token);
      } else {
        console.warn(`Failed to login user ${i}`);
      }
    }

    console.log(`Created and logged in ${tokens.length} users`);

    // 4. Fire all 10 create-order requests in parallel (each reserves a spot)
    console.log('Firing 10 parallel create-order requests...');
    const promises = tokens.map(token =>
      request('POST', '/api/payments/create-order', { competitionId }, token)
    );

    const results = await Promise.all(promises);
    const successes = results.filter(r => r.status === 200 || r.status === 201).length;
    const failures = results.filter(r => r.status >= 400).length;

    console.log(`Results: ${successes} succeeded, ${failures} failed.`);
    assert(successes === 3 && failures === 7, 'Exactly 3 reservations succeeded and 7 failed', `Got ${successes} successes / ${failures} failures`);

    // 5. Assert competition.bookedSpots === 3
    const updatedComp = await Competition.findById(competitionId);
    assert(updatedComp.bookedSpots === 3, 'Competition bookedSpots is exactly 3', `Got ${updatedComp.bookedSpots}`);

  } catch (error) {
    console.error('Concurrency test error:', error);
  } finally {
    await User.deleteMany({});
    await Competition.deleteMany({});
    await mongoose.disconnect();
    if (server) server.close();
    console.log(`\nConcurrency tests finished: ${passed} passed, ${failed} failed`);
    console.log('--- Concurrency Test Finished ---');
    process.exit(failed > 0 ? 1 : 0);
  }
};

runConcurrencyTest();
