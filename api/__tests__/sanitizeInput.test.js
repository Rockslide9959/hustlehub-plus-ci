const express = require('express');
const request = require('supertest');

// The input sanitiser (Part 2) and its log-injection protection (Part 3).
// The real logger is replaced so the tests can check exactly what is logged.

jest.mock('../utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));

const logger = require('../utils/logger');
const sanitizeInput = require('../middleware/sanitizeInput');

const app = express();
app.use(express.json());
app.use(sanitizeInput);
app.all('/*path', (req, res) => res.status(200).json({ ok: true }));

afterEach(() => {
  jest.clearAllMocks();
});

describe('sanitizeInput', () => {
  test('lets normal input through', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'Secret123' });

    expect(res.status).toBe(200);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('blocks NoSQL operators such as $ne in the body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $ne: null }, password: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Request contains data that is not allowed');
  });

  test('blocks prototype pollution keys', async () => {
    const res = await request(app)
      .post('/api/gigs')
      .set('Content-Type', 'application/json')
      .send('{"title":"x","constructor":{"prototype":{"admin":true}}}');

    expect(res.status).toBe(400);
  });

  test('blocks NoSQL operators in the query string', async () => {
    const res = await request(app).get('/api/gigs?category[$ne]=x');

    expect(res.status).toBe(400);
  });

  test('records every blocked request in the security log', async () => {
    await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: 'x' });

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'unsafe_input_blocked',
      expect.objectContaining({ event: 'input_sanitisation', method: 'POST', path: '%2Fapi%2Fauth%2Flogin' })
    );
  });

  test('attacker text cannot add fake lines to the log (log injection)', async () => {
    await request(app)
      .post('/api/x%0AFAKE%20LOG%20LINE')
      .set('Content-Type', 'application/json')
      .send('{"evil\\nkey":{"$ne":null}}');

    const [, details] = logger.warn.mock.calls[0];
    expect(details.path).not.toMatch(/[\r\n]/);
    expect(details.field).not.toMatch(/[\r\n]/);
    expect(details.field).toContain('%0A');
  });

  test('logged values are length-limited', async () => {
    const longKey = 'k'.repeat(500);
    await request(app)
      .post('/api/x')
      .set('Content-Type', 'application/json')
      .send(`{"${longKey}":{"$ne":null}}`);

    const [, details] = logger.warn.mock.calls[0];
    expect(details.field.length).toBeLessThanOrEqual(100);
  });
});
