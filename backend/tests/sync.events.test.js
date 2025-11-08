process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';

const request = require('supertest');
const app = require('../src/app');
const { initDatabase, clearDatabase } = require('../src/utils/database');
const { resetEvents } = require('../src/services/eventBus');

describe('Sync events API', () => {
  beforeAll(async () => {
    await initDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    resetEvents();
  });

  test('captures board creation events', async () => {
    const createResponse = await request(app)
      .post('/api/boards')
      .send({ name: 'Realtime Board', description: 'For sync testing' });

    expect(createResponse.status).toBe(201);

    const eventsResponse = await request(app)
      .get('/api/sync/events')
      .query({ limit: 10 });

    expect(eventsResponse.status).toBe(200);
    expect(Array.isArray(eventsResponse.body)).toBe(true);

    const createdEvent = eventsResponse.body.find(
      (event) => event.resource === 'board' && event.action === 'created'
    );

    expect(createdEvent).toBeDefined();
    expect(createdEvent.data.board.name).toBe('Realtime Board');
  });

  test('filters events when lastEventId is provided', async () => {
    await request(app)
      .post('/api/boards')
      .send({ name: 'Initial Board' });

    const initialEvents = await request(app)
      .get('/api/sync/events')
      .query({ limit: 10 });

    expect(initialEvents.status).toBe(200);
    expect(initialEvents.body.length).toBeGreaterThan(0);

    const lastEventId = initialEvents.body[initialEvents.body.length - 1].id;

    await request(app)
      .post('/api/boards')
      .send({ name: 'Subsequent Board' });

    const filteredEvents = await request(app)
      .get('/api/sync/events')
      .query({ lastEventId, limit: 10 });

    expect(filteredEvents.status).toBe(200);
    expect(filteredEvents.body.length).toBeGreaterThan(0);
    expect(filteredEvents.body.every((event) => event.id !== lastEventId)).toBe(true);
    expect(
      filteredEvents.body.some(
        (event) => event.resource === 'board' && event.data.board.name === 'Subsequent Board'
      )
    ).toBe(true);
  });
});
