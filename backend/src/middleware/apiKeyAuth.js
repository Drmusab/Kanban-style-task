const crypto = require('crypto');

/**
 * Middleware enforcing API key authentication for automation/webhook endpoints.
 * If N8N_API_KEY is not defined the middleware is a no-op so the API can be used
 * during development without extra configuration.
 */
module.exports = function apiKeyAuth(req, res, next) {
  const expected = process.env.N8N_API_KEY;

  if (!expected) {
    return next();
  }

  const provided = extractApiKey(req);

  if (!provided) {
    return res.status(401).json({ error: 'API key is required' });
  }

  // Use constant-time comparison to avoid timing attacks when the app is exposed
  // beyond localhost (e.g. via a tunnel).
  const valid = safeCompare(provided, expected);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  return next();
};

function extractApiKey(req) {
  if (req.headers['x-api-key']) {
    return req.headers['x-api-key'];
  }

  if (req.headers.authorization) {
    const [scheme, token] = req.headers.authorization.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token) {
      return token;
    }
  }

  if (req.query.api_key) {
    return req.query.api_key;
  }

  return null;
}

function safeCompare(a, b) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}
