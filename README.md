# JuaStoreX – Foto Klaim Langsung ke Telegram

Foto tidak disimpan di R2 atau ImgBB. Foto langsung dikirim melalui bot Telegram.

## Worker
Cloudflare → Workers & Pages → juastorex-customer-api → Edit code.
Hapus kode lama, copy isi worker.js, lalu Deploy.

## Binding dan Secret
Pastikan Worker memiliki:
- D1 binding: DB
- Secret: ADMIN_TOKEN
- Secret: TELEGRAM_BOT_TOKEN
- Variable/Secret: TELEGRAM_CHAT_ID = 8584898880

Jangan menulis token bot di worker.js.

## Penting
Buka chat bot Telegram dan tekan START terlebih dahulu agar bot bisa mengirim foto ke chat pribadi.

## Database
Kalau tabel claims sudah ada, jangan jalankan schema.sql lagi.
Kalau belum ada, buka D1 → Console lalu jalankan isi schema.sql.

## Frontend
Upload tiga file di folder public ke Static Assets Worker juastorex-web-final:
- index.html
- styles.css
- app.js

## Tes
1. Cek order memakai kode dan WhatsApp.
2. Isi alasan kendala.
3. Pilih foto.
4. Klik Kirim klaim.
5. Foto dan detail klaim masuk langsung ke Telegram.
