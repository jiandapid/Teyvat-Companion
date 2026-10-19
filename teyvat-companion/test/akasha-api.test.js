import test from 'node:test';
import assert from 'node:assert/strict';
import akashaHandler from '../api/akasha.js';

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = value; },
  };
}

test('AKASHA proxy uses the public community wrapper user-agent and returns profiles', async () => {
  const originalFetch = globalThis.fetch;
  let receivedUrl = '';
  let receivedHeaders = {};
  globalThis.fetch = async (url, options) => {
    receivedUrl = String(url);
    receivedHeaders = options.headers;
    return new Response(JSON.stringify([
      { uid: '123456789', name: 'Test Character', characterId: 1, calculations: [] },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const res = mockResponse();
    await akashaHandler({ method: 'GET', query: { uid: '123456789' } }, res);
    const body = JSON.parse(res.body);
    assert.equal(res.statusCode, 200);
    assert.equal(receivedUrl, 'https://akasha.cv/api/getCalculationsForUser/123456789');
    assert.equal(receivedHeaders['User-Agent'], 'akasha-py');
    assert.equal(body.profiles.length, 1);
    assert.equal(body.profiles[0].name, 'Test Character');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('AKASHA proxy explains a denied public API request without mislabeling the UID', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: 'Forbidden',
    message: 'automated requests rejected',
  }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  try {
    const res = mockResponse();
    await akashaHandler({ method: 'GET', query: { uid: '123456789' } }, res);
    const body = JSON.parse(res.body);
    assert.equal(res.statusCode, 403);
    assert.match(body.error, /HTTP 403/);
    assert.match(body.error, /not necessarily a problem with your UID/i);
    assert.match(body.error, /automated requests rejected/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('AKASHA proxy continues to validate UID input before fetching', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('should not fetch'); };
  try {
    const res = mockResponse();
    await akashaHandler({ method: 'GET', query: { uid: 'not-a-uid' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
