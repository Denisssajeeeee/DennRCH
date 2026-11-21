export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") return res.status(204).end();

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const API_KEY = process.env.NEXA_API_KEY;

  const DAILY_LIMIT = 3;
  const TTL = 86400;
  const RATE_MAX = 5;
  const RATE_TTL = 60;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ message: "Server belum dikonfigurasi (KV)." });
  }
  if (!API_KEY) {
    return res.status(500).json({ message: "Server belum dikonfigurasi (API key)." });
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    "unknown";

  const limitKey = `rch:limit:${ip}`;
  const rateKey = `rch:rate:${ip}`;

  async function kv(path, method = "GET") {
    const r = await fetch(`${KV_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const text = await r.text();
    try { return JSON.parse(text); } catch { return text; }
  }

  if (req.method === "GET") {
    const data = await kv(`/get/${limitKey}`);
    const used = Number(data?.result || 0);
    let resetIn = 0;
    if (used > 0) {
      const ttlData = await kv(`/ttl/${limitKey}`);
      resetIn = Math.max(0, Number(ttlData?.result || 0));
    }
    return res.status(200).json({
      limit: DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - used),
      resetIn
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method tidak diizinkan." });
  }

  try {
    const rateRes = await kv(`/incr/${rateKey}`, "POST");
    const rateCount = Number(rateRes?.result || 1);
    if (rateCount === 1) await kv(`/expire/${rateKey}/${RATE_TTL}`, "POST");
    if (rateCount > RATE_MAX) {
      return res.status(429).json({
        message: "Terlalu banyak request. Tunggu sebentar lalu coba lagi."
      });
    }

    const { url, reaction } = req.body || {};

    if (!url || !reaction) {
      return res.status(400).json({ message: "Parameter url dan reaction wajib diisi." });
    }

    const cleanUrl = String(url).trim();
    const cleanReaction = String(reaction).trim().slice(0, 10);

    if (cleanUrl.length > 500) {
      return res.status(400).json({ message: "URL terlalu panjang." });
    }

    if (!/^https:\/\/(www\.)?whatsapp\.com\/channel\//i.test(cleanUrl)) {
      return res.status(400).json({ message: "Link channel WhatsApp tidak valid." });
    }

    if (!cleanReaction) {
      return res.status(400).json({ message: "Emoji wajib diisi." });
    }

    const limitData = await kv(`/get/${limitKey}`);
    const used = Number(limitData?.result || 0);

    if (used >= DAILY_LIMIT) {
      const ttlData = await kv(`/ttl/${limitKey}`);
      const ttl = Math.max(0, Number(ttlData?.result || TTL));
      const hours = Math.max(1, Math.ceil(ttl / 3600));
      return res.status(429).json({
        message: `Limit harian habis (${DAILY_LIMIT}x/hari). Coba lagi dalam ${hours} jam.`,
        remaining: 0,
        resetIn: ttl
      });
    }

    const endpoint = new URL("https://api.nexadev.my.id/api/rch");
    endpoint.searchParams.set("key", API_KEY);
    endpoint.searchParams.set("url", cleanUrl);
    endpoint.searchParams.set("reaction", cleanReaction);

    const apiResponse = await fetch(endpoint.toString(), {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    const raw = await apiResponse.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { message: raw }; }

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({
        message: data.message || data.error || "API reaction menolak request."
      });
    }

    const incrRes = await kv(`/incr/${limitKey}`, "POST");
    const newCount = Number(incrRes?.result || 1);
    if (newCount === 1) await kv(`/expire/${limitKey}/${TTL}`, "POST");

    return res.status(200).json({
      message: data.message || "Reaction berhasil dikirim.",
      remaining: Math.max(0, DAILY_LIMIT - newCount),
      data
    });
  } catch (error) {
    console.error("Reaction error:", error);
    return res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
}