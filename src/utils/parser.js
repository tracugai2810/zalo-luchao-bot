/**
 * Trích xuất số seri từ tin nhắn Zalo
 *
 * Ví dụ:
 *   "@Bot Công Đam 1234"      → "1234"
 *   "@Bot 12345678"            → "12345678"
 *   "seri 9999"                → "9999"
 *   "1111"                     → "1111"
 *   "Hello bot"                → null (không có số)
 */
function extractSeri(text) {
  if (!text || typeof text !== 'string') return null;

  // Tìm tất cả các chuỗi số liên tục
  const matches = text.match(/\d+/g);
  if (!matches || matches.length === 0) return null;

  // Lấy chuỗi số dài nhất (thường là seri tiền)
  const seri = matches.reduce((a, b) => (a.length >= b.length ? a : b));

  // Seri tiền thường phải từ 3 chữ số trở lên để tránh bắt nhầm các số linh tinh trong câu
  if (seri.length < 3) return null;

  return seri;
}

module.exports = { extractSeri };
