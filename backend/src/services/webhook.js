const axios = require('axios');
const { db } = require('../utils/database');

// Trigger a webhook
const triggerWebhook = async (webhookId, payload) => {
  try {
    // Get the webhook integration
    db.get(
      'SELECT * FROM integrations WHERE id = ? AND type = ? AND enabled = 1',
      [webhookId, 'n8n_webhook'],
      async (err, integration) => {
        if (err) {
          throw new Error(`Error fetching webhook: ${err.message}`);
        }
        
        if (!integration) {
          throw new Error('Webhook integration not found or disabled');
        }
        
        const config = JSON.parse(integration.config);
        const { webhookUrl, apiKey } = config;
        
        if (!webhookUrl) {
          throw new Error('Webhook URL not configured');
        }
        
        const headers = {
          'Content-Type': 'application/json'
        };
        
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        const response = await axios.post(webhookUrl, payload, { headers });
        
        return {
          success: true,
          status: response.status,
          response: response.data
        };
      }
    );
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = { triggerWebhook };