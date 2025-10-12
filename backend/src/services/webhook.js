const axios = require('axios');
const { getAsync } = require('../utils/database');

// Trigger a webhook
const triggerWebhook = async (webhookId, payload) => {
  try {
    const integration = await getAsync(
      'SELECT * FROM integrations WHERE id = ? AND type = ? AND enabled = 1',
      [webhookId, 'n8n_webhook']
    );

    if (!integration) {
      return { success: false, error: 'Webhook integration not found or disabled' };
    }

    let config;
    try {
      config = JSON.parse(integration.config);
    } catch (error) {
      return { success: false, error: 'Invalid webhook configuration' };
    }

    const { webhookUrl, apiKey } = config;

    if (!webhookUrl) {
      return { success: false, error: 'Webhook URL not configured' };
    }

    const headers = {
      'Content-Type': 'application/json'
    };

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await axios.post(webhookUrl, payload, {
      headers,
      timeout: 10000,
    });

    return {
      success: true,
      status: response.status,
      response: response.data,
    };
  } catch (error) {
    console.error('Failed to trigger webhook:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = { triggerWebhook };