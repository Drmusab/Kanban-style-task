const { broadcastN8nEvent } = require('./n8n');

// Send a desktop or webhook notification
const sendNotification = async (title, message, payload = {}) => {
  try {
    console.log(`NOTIFICATION: ${title} - ${message}`);

    const n8nResult = await broadcastN8nEvent(
      'notification',
      { title, message, ...payload },
      { silent: true }
    );

    return {
      success: true,
      message: 'Notification processed',
      n8n: n8nResult,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = { sendNotification };
