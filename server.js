require('dotenv').config();
const express = require('express');
const { captureQueImage } = require('./src/divination/capture');
const { sendPhoto, sendMessage } = require('./src/zalo/api');
const { extractSeri } = require('./src/utils/parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON & form body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log TẤT CẢ request gửi đến để debug
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// ============================================================
//  Health check — Mở trình duyệt vào URL gốc để kiểm tra bot sống
// ============================================================
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    bot: 'Zalo Lục Hào Bot',
    time: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  });
});

// ============================================================
//  Webhook — Nhận tin nhắn từ Zalo Bot Platform
// ============================================================
app.post(['/', '/webhook'], async (req, res) => {
  // QUAN TRỌNG: Trả 200 OK ngay lập tức (Zalo yêu cầu < 2 giây)
  res.status(200).json({ status: 'ok' });

  try {
    const body = req.body;

    // === LOG để debug ===
    console.log('\n========== WEBHOOK RECEIVED ==========');
    console.log('Body:', JSON.stringify(body, null, 2));
    console.log('=======================================\n');

    // === Xác thực Secret Token ===
    const secretToken = process.env.ZALO_SECRET_TOKEN;
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

    // === Trích xuất thông tin tin nhắn ===
    // Hỗ trợ nhiều format payload khác nhau từ Zalo
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
        // Nếu date > 10^12 thì đã là milliseconds, ngược lại là seconds
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
      console.log('⚠️ Không có text trong tin nhắn');
      return;
    }
    if (!chatId) {
      console.log('⚠️ Không có chatId — kiểm tra lại format webhook');
      console.log('Tất cả keys:', Object.keys(body));
      return;
    }

    console.log(`📩 Tin nhắn: "${text}" | Chat: ${chatId} | Từ: ${senderId}`);

    // === Trích xuất số seri ===
    const seri = extractSeri(text);
    if (!seri) {
      console.log('ℹ️ Không tìm thấy số seri, bỏ qua');
      return;
    }

    console.log(`🔢 Seri tìm thấy: ${seri}`);

    // === Xử lý bất đồng bộ ===
    processQue(seri, chatId, timestamp).catch(err => {
      console.error('❌ Lỗi processQue:', err);
    });

  } catch (err) {
    console.error('❌ Webhook error:', err);
  }
});

// ============================================================
//  Xử lý lập quẻ
// ============================================================
async function processQue(seri, chatId, timestamp) {
  const date = new Date(timestamp);
  // Đảm bảo dùng múi giờ Việt Nam
  const vnTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));

  console.log(`⏳ Lập quẻ seri ${seri} — thời gian: ${vnTime.toLocaleString('vi-VN')}`);

  // Báo cho user biết đang xử lý
  await sendMessage(chatId, `⏳ Đang lập quẻ seri ${seri}...`).catch(() => {});

  try {
    // Chụp ảnh quẻ
    const imagePath = await captureQueImage(seri, vnTime);
    console.log(`📸 Đã chụp ảnh: ${imagePath}`);

    // Gửi ảnh về chat
    await sendPhoto(chatId, imagePath);
    console.log(`✅ Đã gửi ảnh về chat ${chatId}`);

    // Xóa file tạm
    const fs = require('fs');
    try { fs.unlinkSync(imagePath); } catch (e) { /* ignore */ }

  } catch (err) {
    console.error(`❌ Lỗi:`, err.message);
    await sendMessage(chatId, `❌ Lỗi lập quẻ: ${err.message}`).catch(() => {});
  }
}

// ============================================================
//  Khởi động server
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🤖 Zalo Lục Hào Bot đang chạy trên port ${PORT}`);
  console.log(`📡 Webhook URL: https://<your-domain>/webhook`);
  console.log(`⏰ Khởi động lúc: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n`);
});
