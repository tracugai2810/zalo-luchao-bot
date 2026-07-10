require('dotenv').config();
const express = require('express');
const { captureQueImage } = require('./src/divination/capture');
const { extractSeri } = require('./src/utils/parser');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON & form body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cấu hình phục vụ file ảnh tĩnh công khai từ thư mục temp để Zalo tự tải về
app.use('/temp', express.static(path.join(__dirname, 'temp')));

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

    // Lay public URL cua server tu request
    const host = req.get('host');
    const protocol = 'https'; // Cuong che dung https de Zalo tai anh tin cay
    const publicUrlBase = `${protocol}://${host}`;

    processQue(seri, chatId, timestamp, publicUrlBase).catch(err => {
      console.error('Loi processQue:', err);
    });

  } catch (err) {
    console.error('Webhook error:', err);
  }
});

// Xu ly lap que
async function processQue(seri, chatId, timestamp, publicUrlBase) {
  const date = new Date(timestamp);
  const vnTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));

  console.log(`Lap que seri ${seri} - thoi gian: ${vnTime.toLocaleString('vi-VN')}`);

  try {
    const imagePath = await captureQueImage(seri, vnTime);
    const filename = path.basename(imagePath);
    const publicImageUrl = `${publicUrlBase}/temp/${filename}`;
    console.log(`Da chup anh: ${imagePath} | Public URL: ${publicImageUrl}`);

    // Gui anh bang cach truyen link anh cho Zalo tu tai ve kem theo caption
    await sendPhoto(chatId, publicImageUrl, 'Quẻ của lão sư đây');
    console.log(`Da gui anh ve chat ${chatId}`);

    // Xoa file anh ngay lap tuc sau khi Zalo da tai xong
    try {
      fs.unlinkSync(imagePath);
      console.log(`Da xoa file anh tam: ${filename}`);
    } catch (e) {}

  } catch (err) {
    console.error(`Loi processQue:`, err.message);
    await sendMessage(chatId, `Co loi xay ra khi lap que: ${err.message}`).catch(() => {});
  }
}


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

async function sendPhoto(chatId, photoUrl, caption = '') {
  try {
    const url = `${BASE_URL()}/sendPhoto`;
    console.log(`sendPhoto -> chat: ${chatId}, url: ${photoUrl}`);

    const response = await axios.post(url, {
      chat_id: chatId,
      photo: photoUrl,
      caption: caption
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
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
