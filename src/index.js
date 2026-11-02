import 'dotenv/config';
import express from 'express';
import { planTour } from './planTour.js';

export const app = express();
export const CHUNK_SEPARATOR = '\n';

app.use(express.json({ limit: '10mb' }));

/**
 * Health check endpoint.
 */
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Explorify Travel Planner',
    version: '0.4.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: 'GET /',
      plan: 'POST /api/plan',
    },
  });
});

/**
 * Main tour planning streaming endpoint.
 *
 * Request body:
 * {
 *   "session": [ { "role": "user", "parts": [ { "text": "Plan trip to Goa" } ] } ],
 *   "token_map": [],
 *   "secret": "your-api-secret"
 * }
 *
 * Response: Newline-delimited JSON stream of session updates and final token_map.
 */
app.post('/api/plan', async (req, res) => {
  const { session, token_map = [], secret } = req.body || {};

  // 1. Validate API secret
  const expectedSecret = process.env.API_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API secret' });
  }

  // 2. Validate session history payload
  if (!Array.isArray(session)) {
    return res.status(400).json({ error: 'Invalid request: "session" must be an array' });
  }

  // 3. Set streaming headers for newline-delimited JSON
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const tokenMap = Array.isArray(token_map) ? [...token_map] : [];

  try {
    // 4. Run the planTour agent loop, streaming chunks separated by newline
    await planTour(session, tokenMap, (chunk) => {
      res.write(JSON.stringify(chunk) + CHUNK_SEPARATOR);
    });

    res.end();
  } catch (err) {
    console.error('Error during travel planning execution:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    } else {
      res.write(JSON.stringify({ error: err.message || String(err) }) + CHUNK_SEPARATOR);
      res.end();
    }
  }
});

const PORT = process.env.PORT || 3000;

// Start server if run directly (and not during testing imports)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Explorify Travel Planner server listening on port ${PORT}`);
  });
}

export default app;
