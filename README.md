# 🤖 Zalo Bot Lập Quẻ Lục Hào

Bot Zalo tự động lập quẻ Lục Hào từ số seri tiền.

## Cách dùng

Tag bot trong nhóm Zalo kèm số seri:

```
@Bot Công Đam 1234
```

Bot sẽ tự động:
1. Lập quẻ với seri "1234" tại thời điểm bạn gửi tin
2. Gửi ảnh kết quả quẻ về nhóm

## Deploy lên Railway

1. Push code lên GitHub
2. Tạo project trên Railway → chọn repo GitHub
3. Thêm biến môi trường: `ZALO_BOT_TOKEN`, `ZALO_SECRET_TOKEN`
4. Railway tự build & deploy
5. Copy URL → thêm `/webhook` → paste vào Webhook URL trên Zalo Bot
