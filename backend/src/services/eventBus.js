const { EventEmitter } = require('events');

const MAX_BUFFERED_EVENTS = 500;

const eventEmitter = new EventEmitter();
const bufferedEvents = [];

const normalizeBoolean = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  return Boolean(value);
};

const toNumericBoolean = (value) => {
  const normalized = normalizeBoolean(value);
  if (normalized === undefined) {
    return undefined;
  }
  return normalized ? 1 : 0;
};

const emitEvent = (resource, action, payload) => {
  const event = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    resource,
    action,
    timestamp: new Date().toISOString(),
    data: payload,
  };

  bufferedEvents.push(event);
  if (bufferedEvents.length > MAX_BUFFERED_EVENTS) {
    bufferedEvents.shift();
  }

  eventEmitter.emit('event', event);
  return event;
};

const subscribe = (listener) => {
  eventEmitter.on('event', listener);
  return () => eventEmitter.off('event', listener);
};

const parseSinceParam = (since) => {
  if (!since) {
    return undefined;
  }

  const parsedDate = new Date(since);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate;
  }

  return undefined;
};

const getEventsSince = ({ since, lastEventId, limit } = {}) => {
  let events = [...bufferedEvents];

  if (lastEventId) {
    const index = events.findIndex((event) => event.id === lastEventId);
    if (index !== -1) {
      events = events.slice(index + 1);
    }
  } else if (since) {
    const sinceDate = parseSinceParam(since);
    if (sinceDate) {
      events = events.filter((event) => new Date(event.timestamp) > sinceDate);
    } else {
      events = [];
    }
  }

  if (limit !== undefined) {
    const numericLimit = Number(limit);
    if (!Number.isNaN(numericLimit) && numericLimit > 0) {
      events = events.slice(-numericLimit);
    }
  }

  return events;
};

const resetEvents = () => {
  bufferedEvents.length = 0;
};

module.exports = {
  emitEvent,
  subscribe,
  getEventsSince,
  toNumericBoolean,
  resetEvents,
};
