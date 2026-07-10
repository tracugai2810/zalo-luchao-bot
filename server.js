require('dotenv').config();
const express = require('express');
const { captureQueImage } = require('./src/divination/capture');
const { extractSeri } = require('./src/utils/parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON & form body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log Táº¤T Cáº¢ request gá»­i Ä‘áº¿n Ä‘á»ƒ debug
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// ============================================================
//  Health check â€” Má»Ÿ trÃ¬nh duyá»‡t vÃ o URL gá»‘c Ä‘á»ƒ kiá»ƒm tra bot sá»‘ng
// ============================================================
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    bot: 'Zalo Lá»¥c HÃ o Bot',
    time: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  });
});

// ============================================================
//  Webhook â€” Nháº­n tin nháº¯n tá»« Zalo Bot Platform
// ============================================================
app.post(['/', '/webhook'], async (req, res) => {
  // QUAN TRá»ŒNG: Tráº£ 200 OK ngay láº­p tá»©c (Zalo yÃªu cáº§u < 2 giÃ¢y)
  res.status(200).json({ status: 'ok' });

  try {
    const body = req.body;

    // === LOG Ä‘á»ƒ debug ===
    console.log('\n========== WEBHOOK RECEIVED ==========');
    console.log('Body:', JSON.stringify(body, null, 2));
    console.log('=======================================\n');

    // === Xác thực Secret Token ===
    const secretToken = 'z8fTaV4U-N0Nx5-gfw';
    if (secretToken) {
      const headerSecret =
        req.headers['x-bot-api-secret-token'] ||
        req.headers['x-zalobot-secret-token'] ||
        req.headers['x-zalo-signature'];
      if (headerSecret && headerSecret !== secretToken) {
        console.log('❌ Secret token không khớp, bỏ qua');
        return;
      }
    }

    // === TrÃ­ch xuáº¥t thÃ´ng tin tin nháº¯n ===
    // Há»— trá»£ nhiá» u format payload khÃ¡c nhau tá»« Zalo
    let text = '';
    let chatId = '';
    let senderId = '';
    let timestamp = Date.now();

    // Format 1: Telegram-like  { message: { text, chat: { id } } }
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
        // Náº¿u date > 10^12 thÃ¬ Ä‘Ã£ lÃ  milliseconds, ngÆ°á»£c láº¡i lÃ  seconds
        timestamp = body.message.date > 10000000000 ? body.message.date : body.message.date * 1000;
      }
    }
    // Format 2: Zalo OA  { event_name, sender, recipient, message }
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
    // Format 3: Direct  { text, chat_id }
    else if (body.text || body.content) {
      text = body.text || body.content || '';
      chatId = body.chat_id || body.chatId || body.recipient_id || '';
      senderId = body.sender_id || body.senderId || '';
    }

    if (!text) {
      console.log('âš ï¸ KhÃ´ng cÃ³ text trong tin nháº¯n');
      return;
    }
    if (!chatId) {
      console.log('âš ï¸ KhÃ´ng cÃ³ chatId â€” kiá»ƒm tra láº¡i format webhook');
      console.log('Táº¥t cáº£ keys:', Object.keys(body));
      return;
    }

    console.log(`ðŸ“© Tin nháº¯n: "${text}" | Chat: ${chatId} | Tá»«: ${senderId}`);

    // === TrÃ­ch xuáº¥t sá»‘ seri ===
    const seri = extractSeri(text);
    if (!seri) {
      console.log('â„¹ï¸ KhÃ´ng tÃ¬m tháº¥y sá»‘ seri, bá» qua');
      return;
    }

    console.log(`ðŸ”¢ Seri tÃ¬m tháº¥y: ${seri}`);

    // === Xá»­ lÃ½ báº¥t Ä‘á»“ng bá»™ ===
    processQue(seri, chatId, timestamp).catch(err => {
      console.error('âŒ Lá»—i processQue:', err);
    });

  } catch (err) {
    console.error('âŒ Webhook error:', err);
  }
});

// ============================================================
//  Xá»­ lÃ½ láº­p quáº»
// ============================================================
async function processQue(seri, chatId, timestamp) {
  const date = new Date(timestamp);
  // Äáº£m báº£o dÃ¹ng mÃºi giá» Viá»‡t Nam
  const vnTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));

  console.log(`â³ Láº­p quáº» seri ${seri} â€” thá»i gian: ${vnTime.toLocaleString('vi-VN')}`);

  // BÃ¡o cho user biáº¿t Ä‘ang xá»­ lÃ½
  await sendMessage(chatId, `â³ Äang láº­p quáº» seri ${seri}...`).catch(() => {});

  try {
    // Chá»¥p áº£nh quáº»
    const imagePath = await captureQueImage(seri, vnTime);
    console.log(`ðŸ“¸ ÄÃ£ chá»¥p áº£nh: ${imagePath}`);

    // Gá»­i áº£nh vá» chat
    await sendPhoto(chatId, imagePath);
    console.log(`âœ… ÄÃ£ gá»­i áº£nh vá» chat ${chatId}`);

    // XÃ³a file táº¡m
    const fs = require('fs');
    try { fs.unlinkSync(imagePath); } catch (e) { /* ignore */ }

  } catch (err) {
    console.error(`âŒ Lá»—i:`, err.message);
    await sendMessage(chatId, `âŒ Lá»—i láº­p quáº»: ${err.message}`).catch(() => {});
  }
}

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// ============================================================
//  API ZALO - Xóa sạch dấu cách thừa trong Token
// ============================================================
const BOT_TOKEN = () => {
  let t = '1141953159893961283:GyDTCCAwzZvHuwFKsnXxiBmXWgwnlfrUcyOFtjVmqHjhWyxQRfeJjqrpJYWZqWli';
  t = t.replace(/[^a-zA-Z0-9:]/g, ''); // Xóa toàn bộ ký tự lạ, dấu ngoặc kép, khoảng trắng
  return t;
};
const BASE_URL = () => `https://bot-api.zaloplatforms.com/bot${BOT_TOKEN()}`;

async function sendMessage(chatId, text) {
  try {
    const url = `${BASE_URL()}/sendMessage`;
    console.log(`📤 sendMessage → chat: ${chatId} | Token length: ${BOT_TOKEN().length}`);

    const response = await axios.post(url, {
      chat_id: chatId,
      text: text
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('ðŸ“¤ sendMessage response:', JSON.stringify(response.data));
    return response.data;
  } catch (err) {
    console.error('âŒ sendMessage error:', err.response?.data || err.message);
    throw err;
  }
}

async function sendPhoto(chatId, imagePath, caption = '') {
  try {
    const url = `${BASE_URL()}/sendPhoto`;
    console.log(`📤 sendPhoto → chat: ${chatId}, file: ${path.basename(imagePath)} | Token length: ${BOT_TOKEN().length}`);

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

    console.log('ðŸ“¤ sendPhoto response:', JSON.stringify(response.data));
    return response.data;
  } catch (err) {
    console.error('âŒ sendPhoto error:', err.response?.data || err.message);
    throw err;
  }
}


// ============================================
//  Kh?i d?ng server
// ============================================
app.listen(PORT, () => {
  console.log("\n?? Zalo L?c Hào Bot dang ch?y trên port " + PORT);
  console.log("?? Webhook URL: https://<your-domain>/webhook");
  console.log("? Kh?i d?ng lúc: " + new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) + "\n");
});
