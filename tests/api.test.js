
import fetch from 'node-fetch';
import assert from 'assert';

const BASE_URL = 'http://localhost:3001/api';

async function testAuth() {
  console.log('Testing Auth...');
  
  // 1. Register
  const email = `test${Date.now()}@example.com`;
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email, password: 'password123' })
  });
  
  const data = await res.json();
  assert.strictEqual(res.status, 201, 'Register failed');
  assert.ok(data.token, 'No token returned');
  
  console.log('Auth Test Passed!');
  return data;
}

async function run() {
  try {
    await testAuth();
    console.log('All Tests Passed');
  } catch (e) {
    console.error('Test Failed:', e);
    process.exit(1);
  }
}

run();
