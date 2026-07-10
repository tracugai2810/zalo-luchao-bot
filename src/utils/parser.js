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

  // Xóa mention patterns
  let cleaned = text
    .replace(/\[@[^\]]*\]/g, '')       // Xóa [@xxx]
    .replace(/@[\w\sÀ-ỹ]+(?=\d)/g, '') // Xóa @TênBot trước số
    .replace(/seri\s*/gi, '')           // Xóa chữ "seri"
    .trim();

  // Tìm các chuỗi số
  const matches = cleaned.match(/\d+/g);
  if (!matches || matches.length === 0) return null;

  // Trả về chuỗi số dài nhất (khả năng cao nhất là seri)
  const seri = matches.reduce((a, b) => (a.length >= b.length ? a : b));

  return seri || null;
}

module.exports = { extractSeri };
