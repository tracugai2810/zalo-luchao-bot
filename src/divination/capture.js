const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Thư mục tạm chứa ảnh
const TEMP_DIR = path.join(__dirname, '../../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Giữ 1 browser instance để tái sử dụng (tiết kiệm tài nguyên)
let browserInstance = null;

async function getBrowser() {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  console.log('🌐 Đang khởi tạo trình duyệt...');
  browserInstance = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--mute-audio',
      '--no-first-run',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    timeout: 30000
  });

  console.log('✅ Trình duyệt đã sẵn sàng');
  return browserInstance;
}

/**
 * Chụp ảnh quẻ Lục Hào từ trang luc-hao-public.vercel.app
 *
 * @param {string} serial  – Số seri tiền
 * @param {Date}   date    – Thời gian lập quẻ
 * @returns {Promise<string>} – Đường dẫn file ảnh PNG
 */
async function captureQueImage(serial, date) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Kích thước trang
    await page.setViewport({ width: 1200, height: 900 });

    // Xây dựng URL với tham số
    const pad = n => String(n).padStart(2, '0');
    const saDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const saHour = date.getHours();
    const saMinute = date.getMinutes();

    const url = [
      'https://luc-hao-public.vercel.app/',
      `?sa_serial=${serial}`,
      `&sa_mode=image`,
      `&sa_date=${saDate}`,
      `&sa_hour=${saHour}`,
      `&sa_minute=${saMinute}`
    ].join('');

    console.log(`🌐 Mở trang: ${url}`);

    // Mở trang — chờ DOM sẵn sàng
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('⏳ Chờ ảnh quẻ render...');

    // Chờ ảnh kết quả xuất hiện trong #imageDisplay
    await page.waitForSelector('#imageDisplay img', {
      timeout: 45000,
      visible: true
    });

    // Chờ thêm để ảnh render đầy đủ (base64 data URL, kích thước > 100px)
    await page.waitForFunction(() => {
      const img = document.querySelector('#imageDisplay img');
      return img && img.src && img.src.startsWith('data:') && img.naturalWidth > 100;
    }, { timeout: 30000 });

    console.log('✅ Ảnh quẻ đã render xong!');

    // Trích xuất base64 từ thẻ <img>
    const imageDataUrl = await page.evaluate(() => {
      const img = document.querySelector('#imageDisplay img');
      if (!img || !img.src) return null;

      // Nếu đã là data URL → trả luôn
      if (img.src.startsWith('data:')) return img.src;

      // Nếu là URL thường → vẽ lên canvas rồi xuất
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    });

    if (!imageDataUrl) {
      throw new Error('Không trích xuất được ảnh từ trang');
    }

    // Lưu file PNG tạm
    const base64Data = imageDataUrl.replace(/^data:image\/png;base64,/, '');
    const fileName = `que_${serial}_${Date.now()}.png`;
    const filePath = path.join(TEMP_DIR, fileName);

    fs.writeFileSync(filePath, base64Data, 'base64');
    console.log(`💾 Đã lưu ảnh: ${filePath} (${Math.round(fs.statSync(filePath).size / 1024)}KB)`);

    return filePath;

  } catch (err) {
    console.error('❌ Lỗi chụp ảnh:', err.message);

    // Chụp ảnh debug để kiểm tra trang đang hiển thị gì
    try {
      const debugPath = path.join(TEMP_DIR, `debug_${serial}_${Date.now()}.png`);
      await page.screenshot({ path: debugPath, fullPage: true });
      console.log(`📸 Ảnh debug: ${debugPath}`);
    } catch (e) { /* ignore */ }

    throw err;
  } finally {
    await page.close().catch(() => {});
  }
}

// Đóng browser khi tắt server
process.on('exit', () => {
  if (browserInstance) browserInstance.close().catch(() => {});
});
process.on('SIGINT', () => {
  if (browserInstance) browserInstance.close().catch(() => {});
  process.exit();
});
process.on('SIGTERM', () => {
  if (browserInstance) browserInstance.close().catch(() => {});
  process.exit();
});

module.exports = { captureQueImage };
