const CORS_HEADERS = {
  "content-type": "application/json; charset=UTF-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function cleanText(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanWa(value) {
  let number = String(value || "").replace(/\D/g, "");
  if (number.startsWith("0")) number = "62" + number.slice(1);
  else if (number.startsWith("8")) number = "62" + number;
  return number;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isAdmin(request, env) {
  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${env.ADMIN_TOKEN}`;
}

function generateOrderCode() {
  const now = new Date();
  const pad = (number) => String(number).padStart(2, "0");
  const date = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate());
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase();
  return `JSX-${date}-${random}`;
}

async function sendClaimPhotoToTelegram(env, file, caption) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    throw new Error("TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum diatur.");
  }

  const form = new FormData();
  form.append("chat_id", String(env.TELEGRAM_CHAT_ID));
  form.append("caption", caption);
  form.append("parse_mode", "HTML");

  const photoBlob = new Blob([await file.arrayBuffer()], { type: file.type || "image/jpeg" });
  form.append("photo", photoBlob, file.name || `bukti-kendala-${Date.now()}.jpg`);

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    body: form,
  });

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || "Foto gagal dikirim ke Telegram.");
  }
  return result;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      if (path === "/api/health" && request.method === "GET") {
        return json({ ok: true, service: "JuaStoreX Customer API" });
      }

      if (path === "/api/check" && request.method === "POST") {
        const data = await request.json();
        const code = cleanText(data.code || data.order_code || data.orderCode, 100).toUpperCase();
        const wa = cleanWa(data.wa || data.whatsapp || data.phone);

        if (!code || !wa) {
          return json({ error: "Kode order dan nomor WhatsApp wajib diisi." }, 400);
        }

        const order = await env.DB.prepare(`
          SELECT id, code, customer_name, COALESCE(wa, whatsapp) AS wa,
                 whatsapp, product, price, order_date, warranty_end,
                 account_info, access_info
          FROM orders
          WHERE UPPER(TRIM(code)) = ?
            AND (COALESCE(wa, '') = ? OR COALESCE(whatsapp, '') = ?)
          LIMIT 1
        `).bind(code, wa, wa).first();

        if (!order) {
          return json({ error: "Data order tidak ditemukan. Periksa kode dan nomor WhatsApp." }, 404);
        }

        return json({ ok: true, order: { ...order, wa: order.wa || order.whatsapp || "" } });
      }

      if (path === "/api/claims" && request.method === "POST") {
        const contentType = request.headers.get("content-type") || "";
        if (!contentType.includes("multipart/form-data")) {
          return json({ error: "Format klaim harus multipart/form-data." }, 400);
        }

        const form = await request.formData();
        const orderCode = cleanText(form.get("order_code") || form.get("code"), 100).toUpperCase();
        const wa = cleanWa(form.get("wa") || form.get("whatsapp"));
        const reason = cleanText(form.get("reason") || form.get("alasan"), 2000);
        const photo = form.get("photo");

        if (!orderCode || !wa || !reason) {
          return json({ error: "Kode order, WhatsApp, dan alasan wajib diisi." }, 400);
        }
        if (!(photo instanceof File) || photo.size === 0) {
          return json({ error: "Foto bukti kendala wajib dipilih." }, 400);
        }
        if (!ALLOWED_PHOTO_TYPES.has(photo.type)) {
          return json({ error: "Foto harus berformat JPG, PNG, atau WEBP." }, 400);
        }
        if (photo.size > MAX_PHOTO_SIZE) {
          return json({ error: "Ukuran foto maksimal 5 MB." }, 400);
        }

        const order = await env.DB.prepare(`
          SELECT * FROM orders
          WHERE UPPER(TRIM(code)) = ?
            AND (COALESCE(wa, '') = ? OR COALESCE(whatsapp, '') = ?)
          LIMIT 1
        `).bind(orderCode, wa, wa).first();

        if (!order) {
          return json({ error: "Order tidak ditemukan. Periksa kode dan WhatsApp." }, 404);
        }

        const existingClaim = await env.DB.prepare(`
          SELECT id FROM claims
          WHERE order_code = ? AND status IN ('Menunggu', 'Diproses')
          LIMIT 1
        `).bind(order.code).first();

        if (existingClaim) {
          return json({ error: "Order ini masih memiliki klaim yang sedang diproses." }, 409);
        }

        const caption = [
          "🛡️ <b>KLAIM GARANSI BARU</b>",
          "",
          `🔐 <b>Kode:</b> ${escapeHtml(order.code)}`,
          `👤 <b>Customer:</b> ${escapeHtml(order.customer_name || "-")}`,
          `📱 <b>WhatsApp:</b> ${escapeHtml(wa)}`,
          `📦 <b>Produk:</b> ${escapeHtml(order.product || "-")}`,
          `💰 <b>Harga:</b> Rp${Number(order.price || 0).toLocaleString("id-ID")}`,
          `📅 <b>Tanggal order:</b> ${escapeHtml(order.order_date || "-")}`,
          `🛡️ <b>Garansi sampai:</b> ${escapeHtml(order.warranty_end || "-")}`,
          "",
          `⚠️ <b>Kendala:</b>\n${escapeHtml(reason)}`,
          "",
          "📸 Foto bukti terlampir.",
        ].join("\n");

        const telegramResult = await sendClaimPhotoToTelegram(env, photo, caption);

        await env.DB.prepare(`
          INSERT INTO claims (order_id, order_code, wa, reason, proof_url, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'Menunggu', datetime('now'))
        `).bind(order.id, order.code, wa, reason, `telegram:${telegramResult.result.message_id}`).run();

        return json({ ok: true, message: "Klaim dan foto berhasil dikirim ke admin Telegram." }, 201);
      }

      if (path.startsWith("/api/admin/") && !isAdmin(request, env)) {
        return json({ error: "Tidak memiliki akses." }, 401);
      }

      if (path === "/api/admin/stats" && request.method === "GET") {
        const stats = await env.DB.prepare(`
          SELECT COUNT(*) AS total,
                 COALESCE(SUM(price), 0) AS revenue,
                 COALESCE(SUM(CASE WHEN date(warranty_end) > date('now', '+3 day') THEN 1 ELSE 0 END), 0) AS active,
                 COALESCE(SUM(CASE WHEN date(warranty_end) BETWEEN date('now') AND date('now', '+3 day') THEN 1 ELSE 0 END), 0) AS expiring,
                 COALESCE(SUM(CASE WHEN date(warranty_end) < date('now') THEN 1 ELSE 0 END), 0) AS expired
          FROM orders
        `).first();
        return json({
          total: Number(stats?.total || 0),
          active: Number(stats?.active || 0),
          expiring: Number(stats?.expiring || 0),
          expired: Number(stats?.expired || 0),
          revenue: Number(stats?.revenue || 0),
        });
      }

      if (path === "/api/admin/orders" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT id, code, customer_name, COALESCE(wa, whatsapp) AS wa,
                 product, price, order_date, warranty_end, account_info,
                 access_info, internal_note, created_at, updated_at
          FROM orders ORDER BY id DESC
        `).all();
        return json({ orders: result.results || [] });
      }

      if (path === "/api/admin/orders" && request.method === "POST") {
        const data = await request.json();
        const customerName = cleanText(data.customer_name, 200);
        const wa = cleanWa(data.wa || data.whatsapp);
        const product = cleanText(data.product, 200);
        const price = Number(data.price || 0);
        const orderDate = cleanText(data.order_date, 30);
        const warrantyEnd = cleanText(data.warranty_end, 30);
        const accountInfo = cleanText(data.account_info, 2000);
        const accessInfo = cleanText(data.access_info, 2000);
        const internalNote = cleanText(data.internal_note, 2000);

        if (!customerName || !wa || !product || !orderDate || !warrantyEnd) {
          return json({ error: "Nama, WhatsApp, produk, tanggal order, dan garansi wajib diisi." }, 400);
        }

        let code = generateOrderCode();
        while (await env.DB.prepare("SELECT id FROM orders WHERE code = ?").bind(code).first()) {
          code = generateOrderCode();
        }

        await env.DB.prepare(`
          INSERT INTO orders (
            code, customer_name, wa, whatsapp, product, price, order_date,
            warranty_end, account_info, access_info, internal_note, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(code, customerName, wa, wa, product, price, orderDate, warrantyEnd,
                accountInfo, accessInfo, internalNote).run();

        return json({ ok: true, code, message: "Order berhasil ditambahkan." }, 201);
      }

      const orderMatch = path.match(/^\/api\/admin\/orders\/(\d+)$/);

      if (orderMatch && request.method === "PUT") {
        const id = Number(orderMatch[1]);
        const data = await request.json();
        const customerName = cleanText(data.customer_name, 200);
        const wa = cleanWa(data.wa || data.whatsapp);
        const product = cleanText(data.product, 200);
        const price = Number(data.price || 0);
        const orderDate = cleanText(data.order_date, 30);
        const warrantyEnd = cleanText(data.warranty_end, 30);
        const accountInfo = cleanText(data.account_info, 2000);
        const accessInfo = cleanText(data.access_info, 2000);
        const internalNote = cleanText(data.internal_note, 2000);

        await env.DB.prepare(`
          UPDATE orders SET customer_name = ?, wa = ?, whatsapp = ?, product = ?, price = ?,
            order_date = ?, warranty_end = ?, account_info = ?, access_info = ?, internal_note = ?,
            updated_at = datetime('now') WHERE id = ?
        `).bind(customerName, wa, wa, product, price, orderDate, warrantyEnd,
                accountInfo, accessInfo, internalNote, id).run();

        return json({ ok: true, message: "Order berhasil diperbarui." });
      }

      if (orderMatch && request.method === "DELETE") {
        const id = Number(orderMatch[1]);
        await env.DB.prepare("DELETE FROM claims WHERE order_id = ?").bind(id).run();
        await env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(id).run();
        return json({ ok: true, message: "Order berhasil dihapus." });
      }

      if (path === "/api/admin/claims" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT claims.*, orders.customer_name, orders.product
          FROM claims LEFT JOIN orders ON orders.id = claims.order_id
          ORDER BY claims.id DESC LIMIT 100
        `).all();
        return json({ claims: result.results || [] });
      }

      return json({ error: "Rute tidak ditemukan." }, 404);
    } catch (error) {
      console.error(error);
      return json({ error: error?.message || "Terjadi kesalahan pada server." }, 500);
    }
  },
};
