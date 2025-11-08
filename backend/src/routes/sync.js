const express = require('express');
const router = express.Router();

const { subscribe, getEventsSince } = require('../services/eventBus');

const writeEvent = (res, event) => {
  res.write(`id: ${event.id}\n`);
  res.write(`event: ${event.resource}.${event.action}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};

router.get('/events', (req, res) => {
  const { since, lastEventId, limit } = req.query;
  const events = getEventsSince({ since, lastEventId, limit });
  res.json(events);
});

router.get('/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  res.flushHeaders();

  const { since, lastEventId, limit } = req.query;
  const headerLastEventId = req.get('last-event-id');
  const backlog = getEventsSince({
    since,
    lastEventId: headerLastEventId || lastEventId,
    limit,
  });

  backlog.forEach((event) => writeEvent(res, event));

  const unsubscribe = subscribe((event) => {
    writeEvent(res, event);
  });

  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\n`);
    res.write('data: {}\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

module.exports = router;
