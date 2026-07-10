const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// Zalo Bot Platform API (giống Telegram)
const BOT_TOKEN = () => process.env.ZALO_BOT_TOKEN;
const BASE_URL = () => `https://bot-api.zaloplatforms.com/bot${BOT_TOKEN()}`;

/**
 * Gửi tin nhắn text đến chat
 */
async function sendMessage(chatId, text) {
  try {
    const url = `${BASE_URL()}/sendMessage`;
    console.log(`📤 sendMessage → chat: ${chatId}`);

    const response = await axios.post(url, {
      chat_id: chatId,
      text: text
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('📤 sendMessage response:', JSON.stringify(response.data));
    return response.data;
  } catch (err) {
    console.error('❌ sendMessage error:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Gửi ảnh đến chat
 */
async function sendPhoto(chatId, imagePath, caption = '') {
  try {
    const url = `${BASE_URL()}/sendPhoto`;
    console.log(`📤 sendPhoto → chat: ${chatId}, file: ${path.basename(imagePath)}`);

    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('photo', fs.createReadStream(imagePath), {
      filename: path.basename(imagePath),
      contentType: 'image/png'
    });
    if (caption) {
      form.append('caption', caption);
    }

    const response = await axios.post(url, form, {
      headers: { ...form.getHeaders() },
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('📤 sendPhoto response:', JSON.stringify(response.data));
    return response.data;
  } catch (err) {
    console.error('❌ sendPhoto error:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = { sendMessage, sendPhoto };
