require('dotenv').config();
const express = require('express');
const { captureQueImage } = require('./src/divination/capture');
const { extractSeri } = require('./src/utils/parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON & form body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log tat ca request de debug
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    bot: 'Zalo Luc Hao Bot',
    time: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  });
});

// Webhook
app.post(['/', '/webhook'], async (req, res) => {
  res.status(200).json({ status: 'ok' });

  try {
    const body = req.body;

    console.log('\n========== WEBHOOK RECEIVED ==========');
    console.log('Body:', JSON.stringify(body, null, 2));
    console.log('=======================================\n');

    // Quet Secret Token
    const secretToken = 'z8fTaV4U-N0Nx5-gfw';
    if (secretToken) {
      const headerSecret =
        req.headers['x-bot-api-secret-token'] ||
        req.headers['x-zalobot-secret-token'] ||
        req.headers['x-zalo-signature'];
      if (headerSecret && headerSecret !== secretToken) {
        console.log('Secret token khong khop, bo qua');
        return;
      }
    }

    let text = '';
    let chatId = '';
    let senderId = '';
    let timestamp = Date.now();

    if (body.message) {
      text = body.message.text || body.message.content || '';
      chatId =
        body.message.chat?.id ||
        body.message.chatId ||
        body.message.chat_id ||
        '';
      senderId =
        body.message.from?.id ||
        body.message.sender?.id ||
        body.message.senderId ||
        '';
      if (body.message.date) {
        timestamp = body.message.date > 10000000000 ? body.message.date : body.message.date * 1000;
      }
    }
    else if (body.event_name) {
      text = body.message?.text || body.message?.content || '';
      chatId =
        body.recipient?.id ||
        body.recipient?.group_id ||
        '';
      senderId = body.sender?.id || '';
      if (body.timestamp) {
        timestamp = parseInt(body.timestamp);
      }
    }
    else if (body.text || body.content) {
      text = body.text || body.content || '';
      chatId = body.chat_id || body.chatId || body.recipient_id || '';
      senderId = body.sender_id || body.senderId || '';
    }

    console.log(`Tin nhan: "${text}" | Chat: ${chatId} | Tu: ${senderId}`);

    const seri = extractSeri(text);
    if (!seri) {
      console.log('Khong tim thay so seri, bo qua');
      return;
    }

    console.log(`Seri tim thay: ${seri}`);

    processQue(seri, chatId, timestamp).catch(err => {
      console.error('Loi processQue:', err);
    });

  } catch (err) {
    console.error('Webhook error:', err);
  }
});

// Xu ly lap que
async function processQue(seri, chatId, timestamp) {
  const date = new Date(timestamp);
  const vnTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));

  console.log(`Lap que seri ${seri} - thoi gian: ${vnTime.toLocaleString('vi-VN')}`);

  // Gui tin nhan thong bao dang lap que (dung khong dau de tranh loi font Zalo)
  await sendMessage(chatId, `Dang lap que cho seri ${seri}, vui long cho giay lat...`).catch(() => {});

  try {
    const imagePath = await captureQueImage(seri, vnTime);
    console.log(`Da chup anh: ${imagePath}`);

    await sendPhoto(chatId, imagePath);
    console.log(`Da gui anh ve chat ${chatId}`);

    const fs = require('fs');
    try { fs.unlinkSync(imagePath); } catch (e) {}

  } catch (err) {
    console.error(`Loi processQue:`, err.message);
    await sendMessage(chatId, `Co loi xay ra khi lap que: ${err.message}`).catch(() => {});
  }
}

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const BOT_TOKEN = () => {
  let t = '1141953159893961283:GyDTCCAwzZvHuwFKsnXxiBmXWgwnlfrUcyOFtjVmqHjhWyxQRfeJjqrpJYWZqWli';
  t = t.replace(/[^a-zA-Z0-9:]/g, '');
  return t;
};
const BASE_URL = () => `https://bot-api.zaloplatforms.com/bot${BOT_TOKEN()}`;

async function sendMessage(chatId, text) {
  try {
    const url = `${BASE_URL()}/sendMessage`;
    console.log(`sendMessage -> chat: ${chatId}`);

    const response = await axios.post(url, {
      chat_id: chatId,
      text: text
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('sendMessage response:', JSON.stringify(response.data));
    return response.data;
  } catch (err) {
    console.error('sendMessage error:', err.response?.data || err.message);
    throw err;
  }
}

async function sendPhoto(chatId, imagePath, caption = '') {
  try {
    const url = `${BASE_URL()}/sendPhoto`;
    console.log(`sendPhoto -> chat: ${chatId}, file: ${path.basename(imagePath)} | Token length: ${BOT_TOKEN().length}`);

    const fileBuffer = fs.readFileSync(imagePath);
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('photo', fileBuffer, {
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

    console.log('sendPhoto response:', JSON.stringify(response.data));
    return response.data;
  } catch (err) {
    console.error('sendPhoto error:', err.response?.data || err.message);
    throw err;
  }
}

app.listen(PORT, () => {
  console.log(`Zalo Bot is running on port ${PORT}`);
});
