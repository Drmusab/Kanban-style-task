const axios = require('axios');
const { allAsync } = require('../utils/database');

const parseIntegrationConfig = (integration) => {
  try {
    const config = JSON.parse(integration.config || '{}');
    return {
      id: integration.id,
      name: integration.name,
      webhookUrl: config.webhookUrl,
      apiKey: config.apiKey,
    };
  } catch (error) {
    return null;
  }
};

const getEnabledWebhooks = async () => {
  const integrations = await allAsync(
    "SELECT * FROM integrations WHERE type = 'n8n_webhook' AND enabled = 1"
  );

  return integrations
    .map(parseIntegrationConfig)
    .filter((config) => config && config.webhookUrl);
};

const postToWebhook = async (config, payload) => {
  const headers = { 'Content-Type': 'application/json' };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const response = await axios.post(config.webhookUrl, payload, {
    headers,
    timeout: 10000,
  });

  return {
    id: config.id,
    name: config.name,
    status: response.status,
    data: response.data,
  };
};

const broadcastN8nEvent = async (eventType, payload = {}, options = {}) => {
  try {
    const webhooks = await getEnabledWebhooks();

    if (webhooks.length === 0) {
      return {
        success: false,
        delivered: 0,
        failed: 0,
        message: 'No enabled n8n webhook integrations configured',
      };
    }

    const body = {
      eventType,
      timestamp: new Date().toISOString(),
      payload,
    };

    const results = await Promise.allSettled(
      webhooks.map((config) => postToWebhook(config, body))
    );

    const delivered = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);

    const failed = results
      .filter((result) => result.status === 'rejected')
      .map((result) => ({ error: result.reason?.message || 'Unknown error' }));

    return {
      success: delivered.length > 0,
      delivered: delivered.length,
      failed: failed.length,
      deliveries: delivered,
      errors: failed,
    };
  } catch (error) {
    if (!options.silent) {
      console.error('Failed to broadcast n8n event:', error);
    }
    return { success: false, delivered: 0, failed: 0, error: error.message };
  }
};

module.exports = { broadcastN8nEvent, getEnabledWebhooks };
