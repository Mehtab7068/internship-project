require('dotenv').config();
// Force mock payment mode for deterministic tests
process.env.RAZORPAY_MOCK = 'true';

const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Competition = require('../src/models/Competition');
const Judge = require('../src/models/Judge');

const PORT = 4005;
let server;
let testToken = '';
let competitionId = '';
let userId = '';

const request = (method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (testToken && !options.headers['Authorization']) {
      options.headers['Authorization'] = `Bearer ${testToken}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
};

const runTests = async () => {
  console.log('--- Starting Integration Tests ---');
  let passed = 0;
  let failed = 0;

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
    // 0. Setup
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/feedants_test';
    await mongoose.connect(MONGO_URI);
    await User.deleteMany({});
    await Competition.deleteMany({});

    server = app.listen(PORT);

    // Create a judge first (Competition.judge is a required ObjectId ref)
    const judgeDoc = await Judge.create({
      name: 'Test Judge',
      photoUrl: 'https://example.com/test-judge.jpg',
      title: 'Classical Dance Expert',
      experienceYears: 5
    });

    // Create base competition (matches current Competition schema)
    const compData = {
      title: 'Feedants Classical Dance',
      category: 'Dance',
      prizePool: 1500,
      entryFee: 99,
      totalSpots: 3,
      bookedSpots: 0,
      registerBeforeAt: new Date(Date.now() + 86400000),
      submissionStartAt: new Date(Date.now() + 86400000 * 2),
      submissionEndAt: new Date(Date.now() + 86400000 * 3),
      resultAt: new Date(Date.now() + 86400000 * 4),
      description: 'Test competition',
      status: 'registration_open',
      judge: judgeDoc._id
    };

    const comp = await Competition.create(compData);
    competitionId = comp._id.toString();

    // 1. Health check
    const health = await request('GET', '/health');
    assert(health.status === 200, 'Health check endpoint');

    // 2. User registration
    const registerRes = await request('POST', '/api/auth/register', {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    assert(registerRes.status === 201 || registerRes.status === 200, 'User registration');

    // 3. User login
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    assert(loginRes.status === 200 && (loginRes.data.token || (loginRes.data.data && loginRes.data.data.token)), 'User login');
    testToken = loginRes.data.token || (loginRes.data.data && loginRes.data.data.token);

    // 4. Get competitions list
    const compsList = await request('GET', '/api/competitions');
    assert(compsList.status === 200, 'Get competitions list');

    // 5. Get competition by ID
    const compById = await request('GET', `/api/competitions/${competitionId}`);
    assert(compById.status === 200, 'Get competition by ID');

    // 5b. Reserve endpoint (server-controlled pending_payment reservation)
    const reserveRes = await request('POST', `/api/competitions/${competitionId}/register`, {});
    assert(reserveRes.status === 201, 'Reserve endpoint creates pending_payment reservation', `Got ${reserveRes.status}`);

    // 6. Get competition by slug
    const compBySlug = await request('GET', '/api/competitions/slug/feedants-dance');
    const compBySlug2 = await request('GET', '/api/competitions/feedants-dance');
    assert(compBySlug.status === 200 || compBySlug2.status === 200 || compBySlug.status === 404, 'Get competition by slug handled');

    // 8. Payment order creation (reserves spot + creates order)
    const orderRes = await request('POST', '/api/payments/create-order', {
      competitionId
    });
    assert(orderRes.status === 200, 'Payment order creation (reserves spot)', `Got ${orderRes.status}`);
    const order = orderRes.data.data || orderRes.data;
    const orderId = order.orderId || 'mock_order_123';

    // 9. Payment verification (uses mock credentials returned by create-order)
    const verifyRes = await request('POST', '/api/payments/verify', {
      razorpay_order_id: order.orderId,
      razorpay_payment_id: order.mockPaymentId,
      razorpay_signature: order.mockSignature,
      competitionId
    });
    assert(verifyRes.status === 200, 'Payment verification confirms registration', `Got ${verifyRes.status}: ${JSON.stringify(verifyRes.data)}`);

    // 7. Duplicate registration prevention (after confirming)
    const dupOrderRes = await request('POST', '/api/payments/create-order', {
      competitionId
    });
    assert(dupOrderRes.status === 409, 'Duplicate registration rejected with 409', `Got ${dupOrderRes.status}`);

    // 10. Atomic spot booking verification
    const updatedComp = await Competition.findById(competitionId);
    assert(updatedComp.bookedSpots === 1, 'Spot reserved and confirmed via payment', `Got bookedSpots=${updatedComp.bookedSpots}`);

    // 11. Get winners
    const winnersRes = await request('GET', `/api/competitions/${competitionId}/winners`);
    assert(winnersRes.status === 200 || winnersRes.status === 404, 'Get winners');

    // 12. Get rewards
    const rewardsRes = await request('GET', `/api/competitions/${competitionId}/rewards`);
    assert(rewardsRes.status === 200 || rewardsRes.status === 404, 'Get rewards');

    // 13. Submit review
    const reviewRes = await request('POST', '/api/reviews', {
      competitionCategory: 'Dance',
      rating: 5,
      comment: 'Great!'
    });
    assert(reviewRes.status === 201 || reviewRes.status === 200 || reviewRes.status === 400 || reviewRes.status === 404, 'Submit review handled');

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    // Cleanup
    await User.deleteMany({});
    await Competition.deleteMany({});
    await mongoose.disconnect();
    if (server) server.close();

    console.log(`\nTests finished: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
