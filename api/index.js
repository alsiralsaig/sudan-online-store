var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/server/telegram.ts
async function sendTelegram(text2, opts = {}) {
  if (!token()) return { sent: 0, skipped: "NOT_CONFIGURED" };
  const ids = chatIds();
  if (ids.length === 0) return { sent: 0, skipped: "NO_CHAT_ID" };
  let sent = 0;
  let skipped = "";
  for (const chatId of ids) {
    try {
      const res = await withTimeout(api("sendMessage"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text2,
          disable_web_page_preview: true,
          ...opts.markdown === false ? {} : { parse_mode: "Markdown" }
        })
      });
      const payload = await res.json().catch(() => null);
      if (payload?.ok) sent += 1;
      else if (!skipped) skipped = `API_${payload?.error_code ?? res.status}`;
    } catch (err) {
      if (!skipped) skipped = err.name === "AbortError" ? "TIMEOUT" : "NETWORK";
    }
  }
  return { sent, skipped };
}
async function discoverChats() {
  if (!token()) {
    return { ok: false, hint: "TELEGRAM_BOT_TOKEN \u063A\u064A\u0631 \u0645\u0636\u0628\u0648\u0637 \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062E\u0627\u062F\u0645.", chats: [] };
  }
  try {
    const res = await withTimeout(api("getUpdates?timeout=0"));
    const payload = await res.json().catch(() => null);
    if (!payload?.ok) {
      return {
        ok: false,
        hint: payload?.description || "\u062A\u0644\u064A\u062C\u0631\u0627\u0645 \u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628 \u2014 \u062A\u0623\u0643\u062F \u0625\u0646 \u0627\u0644\u062A\u0648\u0643\u0646 \u0635\u062D\u064A\u062D \u0648\u0625\u0646\u0643 \u0623\u0631\u0633\u0644\u062A /start \u0644\u0644\u0628\u0648\u062A.",
        chats: []
      };
    }
    const seen = /* @__PURE__ */ new Map();
    for (const update of payload.result || []) {
      const chat = update?.message?.chat || update?.channel_post?.chat || update?.my_chat_member?.chat;
      if (!chat?.id) continue;
      seen.set(String(chat.id), {
        id: String(chat.id),
        name: [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.title || chat.username || "\u2014",
        username: chat.username
      });
    }
    return {
      ok: true,
      hint: seen.size ? "\u0627\u0646\u0633\u062E \u0627\u0644\u0640 id \u0648\u062D\u0637\u0651\u0647 \u0641\u064A TELEGRAM_CHAT_IDS." : "\u0645\u0627 \u0641\u064A \u0645\u062D\u0627\u062F\u062B\u0627\u062A \u0628\u0639\u062F \u2014 \u0627\u0641\u062A\u062D \u0627\u0644\u0628\u0648\u062A \u0641\u064A \u062A\u0644\u064A\u062C\u0631\u0627\u0645 \u0648\u0627\u0636\u063A\u0637 Start \u0623\u0648 \u0623\u0631\u0633\u0644 /start \u062B\u0645 \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.",
      chats: [...seen.values()]
    };
  } catch (err) {
    return {
      ok: false,
      hint: err.name === "AbortError" ? "\u0627\u0646\u062A\u0647\u0649 \u0648\u0642\u062A \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u062A\u0644\u064A\u062C\u0631\u0627\u0645." : "\u0641\u0634\u0644 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u062A\u0644\u064A\u062C\u0631\u0627\u0645.",
      chats: []
    };
  }
}
var token, chatIds, kindList, telegramConfigured, telegramChatCount, telegramEnabledFor, api, withTimeout, telegramStatus;
var init_telegram = __esm({
  "src/server/telegram.ts"() {
    token = () => String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
    chatIds = () => String(process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "").split(",").map((s) => s.trim()).filter(Boolean);
    kindList = () => String(process.env.TELEGRAM_KINDS || "system").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    telegramConfigured = () => !!token() && chatIds().length > 0;
    telegramChatCount = () => chatIds().length;
    telegramEnabledFor = (kind) => {
      if (!telegramConfigured()) return false;
      const kinds = kindList();
      if (kinds.includes("all")) return true;
      return !!kind && kinds.includes(String(kind).toLowerCase());
    };
    api = (method) => `https://api.telegram.org/bot${token()}/${method}`;
    withTimeout = async (url, init, ms = 8e3) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    };
    telegramStatus = () => ({
      configured: telegramConfigured(),
      chats: telegramChatCount(),
      kinds: kindList()
    });
  }
});

// src/server/email.ts
function toEmailBody(report) {
  return report.replace(/\*/g, "").replace(/^✅ /gm, "[\u0633\u0644\u064A\u0645] ").replace(/^❌ /gm, "[\u0645\u0634\u0643\u0644\u0629] ").replace(/^🚨 /gm, "[\u062A\u0646\u0628\u064A\u0647] ").replace(/^🕒 /gm, "\u0627\u0644\u0648\u0642\u062A: ");
}
function emailSubject(report) {
  return report.includes("\u{1F6A8}") || report.includes("\u274C") ? "\u062A\u0646\u0628\u064A\u0647 \u0633\u0646\u062F: \u0641\u064A \u0645\u0634\u0643\u0644\u0629 \u0645\u062D\u062A\u0627\u062C\u0629 \u0646\u0638\u0631\u0629" : "\u0633\u0646\u062F: \u0643\u0644 \u0627\u0644\u0641\u062D\u0648\u0635\u0627\u062A \u0633\u0644\u064A\u0645\u0629";
}
async function sendEmail(subject, report) {
  const key = apiKey();
  const to = recipients();
  if (!key) return { sent: 0, skipped: "NOT_CONFIGURED" };
  if (to.length === 0) return { sent: 0, skipped: "NO_RECIPIENT" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ from: sender(), to, subject, text: toEmailBody(report) }),
      signal: controller.signal
    });
    const payload = await res.json().catch(() => null);
    if (res.ok && payload?.id) return { sent: to.length, skipped: "" };
    return { sent: 0, skipped: `API_${payload?.statusCode ?? res.status}` };
  } catch (err) {
    return { sent: 0, skipped: err.name === "AbortError" ? "TIMEOUT" : "NETWORK" };
  } finally {
    clearTimeout(timer);
  }
}
var API_URL, TIMEOUT_MS, apiKey, recipients, sender, emailConfigured;
var init_email = __esm({
  "src/server/email.ts"() {
    API_URL = "https://api.resend.com/emails";
    TIMEOUT_MS = 8e3;
    apiKey = () => String(process.env.RESEND_API_KEY || "").trim();
    recipients = () => String(process.env.ALERT_EMAIL_TO || "").split(",").map((s) => s.trim()).filter((s) => s.includes("@"));
    sender = () => String(process.env.ALERT_EMAIL_FROM || "Sanad Alerts <onboarding@resend.dev>").trim();
    emailConfigured = () => !!apiKey() && recipients().length > 0;
  }
});

// src/server/ntfy.ts
async function claimInDb(key) {
  if (!isDbEnabled()) return null;
  try {
    if (!claimTableReady) {
      await query(
        `CREATE TABLE IF NOT EXISTS ${CLAIM_TABLE} (
           key text PRIMARY KEY,
           sent_at timestamptz NOT NULL DEFAULT now()
         )`
      );
      claimTableReady = true;
    }
    await query(`DELETE FROM ${CLAIM_TABLE} WHERE sent_at < now() - interval '7 days'`);
    const res = await query(
      `INSERT INTO ${CLAIM_TABLE} (key) VALUES ($1) ON CONFLICT (key) DO NOTHING RETURNING key`,
      [key]
    );
    return (res.rowCount ?? 0) > 0;
  } catch {
    return null;
  }
}
async function sendNtfy(title, body, opts = {}) {
  const t = topic();
  if (!t) return { sent: 0, skipped: "NOT_CONFIGURED" };
  if (opts.dedupe !== false) {
    const key = `${title}|${body}`.replace(/\s+/g, " ").trim();
    const dbClaim = await claimInDb(key);
    if (dbClaim === false) return { sent: 0, skipped: "DUPLICATE" };
    if (dbClaim === null && recentlySent(key)) return { sent: 0, skipped: "DUPLICATE" };
  }
  if (rateLimited()) return { sent: 0, skipped: "RATE_LIMITED" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6e3);
  try {
    const res = await fetch(`${server()}/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: t,
        title: title.slice(0, 120),
        message: body.slice(0, 1500),
        priority: opts.priority ?? 3,
        ...opts.tags ? { tags: opts.tags.split(",").map((s) => s.trim()).filter(Boolean) } : {}
      }),
      signal: controller.signal
    });
    if (res.ok) return { sent: 1, skipped: "" };
    return { sent: 0, skipped: `API_${res.status}` };
  } catch (err) {
    return { sent: 0, skipped: err.name === "AbortError" ? "TIMEOUT" : "NETWORK" };
  } finally {
    clearTimeout(timer);
  }
}
var DEFAULT_TOPIC, topic, server, kindList2, ntfyConfigured, ntfyEnabledFor, DEDUPE_TTL_MS, MAX_CACHE, recent, recentlySent, RATE_WINDOW_MS, RATE_MAX, windowStart, windowCount, rateLimited, CLAIM_TABLE, claimTableReady, ntfyStatus;
var init_ntfy = __esm({
  "src/server/ntfy.ts"() {
    init_pg();
    DEFAULT_TOPIC = "sanad-alerts-x7k2m9";
    topic = () => String(process.env.NTFY_TOPIC || DEFAULT_TOPIC).trim();
    server = () => String(process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/+$/, "");
    kindList2 = () => String(process.env.NTFY_KINDS || "all").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    ntfyConfigured = () => !!topic();
    ntfyEnabledFor = (kind) => {
      if (!ntfyConfigured()) return false;
      const kinds = kindList2();
      if (kinds.includes("all")) return true;
      return !!kind && kinds.includes(String(kind).toLowerCase());
    };
    DEDUPE_TTL_MS = 24 * 60 * 60 * 1e3;
    MAX_CACHE = 500;
    recent = /* @__PURE__ */ new Map();
    recentlySent = (key) => {
      const now = Date.now();
      const at = recent.get(key);
      if (at && now - at < DEDUPE_TTL_MS) return true;
      if (at) recent.delete(key);
      if (recent.size > MAX_CACHE) {
        const oldest = [...recent.entries()].sort((a, b) => a[1] - b[1])[0];
        if (oldest) recent.delete(oldest[0]);
      }
      recent.set(key, now);
      return false;
    };
    RATE_WINDOW_MS = 60 * 1e3;
    RATE_MAX = 6;
    windowStart = 0;
    windowCount = 0;
    rateLimited = () => {
      const now = Date.now();
      if (now - windowStart > RATE_WINDOW_MS) {
        windowStart = now;
        windowCount = 0;
      }
      if (windowCount >= RATE_MAX) return true;
      windowCount += 1;
      return false;
    };
    CLAIM_TABLE = "sanad_ntfy_claims";
    claimTableReady = false;
    ntfyStatus = () => {
      const t = topic();
      const masked = t ? `${t.slice(0, 4)}\u2026${t.slice(-3)}` : "";
      return { configured: ntfyConfigured(), topic: masked, kinds: kindList2() };
    };
  }
});

// src/server/alerts.ts
async function notifyAll(text2) {
  const channels = channelsConfigured();
  if (channels.length === 0) return { sent: 0, skipped: "NOT_CONFIGURED", channels };
  let sent = 0;
  let skipped = "";
  if (channels.includes("telegram")) {
    try {
      const v = await sendTelegram(text2);
      sent += v.sent;
      if (v.sent === 0 && !skipped) skipped = `telegram:${v.skipped}`;
    } catch (err) {
      if (!skipped) skipped = `telegram:THREW:${err.message.slice(0, 30)}`;
    }
  }
  if (channels.includes("email")) {
    try {
      const v = await sendEmail(emailSubject(text2), text2);
      sent += v.sent;
      if (v.sent === 0 && !skipped) skipped = `email:${v.skipped}`;
    } catch (err) {
      if (!skipped) skipped = `email:THREW:${err.message.slice(0, 30)}`;
    }
  }
  if (channels.includes("ntfy")) {
    try {
      const firstLine = text2.split("\n").find((l) => l.trim()) || "\u062A\u0646\u0628\u064A\u0647 \u0645\u0646 \u0633\u0646\u062F";
      const v = await sendNtfy(emailSubject(text2), text2, { dedupe: false });
      sent += v.sent;
      if (v.sent === 0 && !skipped) skipped = `ntfy:${v.skipped || firstLine.slice(0, 0)}`;
    } catch (err) {
      if (!skipped) skipped = `ntfy:THREW:${err.message.slice(0, 30)}`;
    }
  }
  return { sent, skipped, channels };
}
var channelsConfigured, anyChannelConfigured;
var init_alerts = __esm({
  "src/server/alerts.ts"() {
    init_telegram();
    init_email();
    init_ntfy();
    channelsConfigured = () => {
      const list2 = [];
      if (telegramConfigured()) list2.push("telegram");
      if (emailConfigured()) list2.push("email");
      if (ntfyConfigured()) list2.push("ntfy");
      return list2;
    };
    anyChannelConfigured = () => channelsConfigured().length > 0;
  }
});

// src/server/storage.ts
import { put } from "@vercel/blob";
function blobEnabled() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}
function storageMode() {
  return blobEnabled() ? "blob" : "database";
}
function extensionFor(mime) {
  return EXTENSIONS[mime] || "bin";
}
async function putMedia(id, data, mime, kind) {
  const path2 = `sanad/${kind}/${id}.${extensionFor(mime)}`;
  const result = await put(path2, data, {
    access: "public",
    contentType: mime,
    // Immutable ids: a re-upload always gets a new id, so caching is safe.
    addRandomSuffix: false,
    cacheControlMaxAge: 60 * 60 * 24 * 365
  });
  return result.url;
}
var EXTENSIONS;
var init_storage = __esm({
  "src/server/storage.ts"() {
    EXTENSIONS = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov"
    };
  }
});

// src/server/watchdog.ts
var watchdog_exports = {};
__export(watchdog_exports, {
  alertDbFailure: () => alertDbFailure,
  buildReport: () => buildReport,
  resetAlertState: () => resetAlertState,
  runWatch: () => runWatch,
  runWatchdog: () => runWatchdog,
  shouldSendAlert: () => shouldSendAlert
});
function buildReport(checks, at = /* @__PURE__ */ new Date()) {
  const problems = checks.filter((c) => !c.ok);
  const stamp2 = at.toISOString().slice(0, 16).replace("T", " ");
  const lines = [];
  if (problems.length === 0) {
    lines.push("\u2705 *\u0633\u0646\u062F \u0628\u062E\u064A\u0631*");
  } else {
    lines.push("\u{1F6A8} *\u0645\u0634\u0643\u0644\u0629 \u0641\u064A \u0633\u0646\u062F*");
  }
  lines.push(`\u{1F552} ${stamp2} UTC`);
  for (const c of checks) {
    lines.push(`${c.ok ? "\u2705" : "\u274C"} ${c.name}: ${c.detail}`);
  }
  if (problems.length > 0) {
    lines.push("");
    lines.push("\u0627\u0644\u062E\u0637\u0648\u0629 \u0627\u0644\u0623\u0648\u0644\u0649: \u0627\u0641\u062A\u062D /api/health \u0648\u0634\u0648\u0641 \u0631\u062F \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.");
  }
  return { ok: problems.length === 0, checks, problems, text: lines.join("\n") };
}
function shouldSendAlert(key, now = Date.now()) {
  if (key === lastAlertKey && now - lastAlertAt < ALERT_COOLDOWN_MS) return false;
  lastAlertKey = key;
  lastAlertAt = now;
  return true;
}
function resetAlertState() {
  lastAlertAt = 0;
  lastAlertKey = "";
  lastWasHealthy = true;
}
async function runWatch(deps) {
  const checks = [];
  try {
    checks.push(await deps.checkDb());
  } catch (err) {
    checks.push({ name: "\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A", ok: false, detail: `\u0641\u0634\u0644 \u0627\u0644\u0641\u062D\u0635: ${err.message.slice(0, 80)}` });
  }
  try {
    checks.push(deps.checkStorage());
  } catch (err) {
    checks.push({ name: "\u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u0645\u0644\u0641\u0627\u062A", ok: false, detail: `\u0641\u0634\u0644 \u0627\u0644\u0641\u062D\u0635: ${err.message.slice(0, 80)}` });
  }
  const report = buildReport(checks);
  let notified = "SKIPPED";
  const notifySafe = async (text2) => {
    try {
      return await deps.notify(text2);
    } catch (err) {
      return { sent: 0, skipped: `THREW:${err.message.slice(0, 40)}` };
    }
  };
  const key = report.problems.map((p) => p.name).sort().join("|");
  if (!report.ok) {
    if (shouldSendAlert(key)) {
      const verdict = await notifySafe(report.text);
      notified = verdict.sent > 0 ? "SENT" : `FAILED:${verdict.skipped}`;
      lastWasHealthy = false;
    } else {
      notified = "THROTTLED";
    }
  } else if (!lastWasHealthy) {
    const verdict = await notifySafe("\u2705 *\u0633\u0646\u062F \u0631\u062C\u0639 \u062A\u0645\u0627\u0645*\n\u0643\u0644 \u0627\u0644\u0641\u062D\u0648\u0635\u0627\u062A \u0633\u0644\u064A\u0645\u0629 \u0627\u0644\u0622\u0646.");
    notified = verdict.sent > 0 ? "RECOVERY_SENT" : `FAILED:${verdict.skipped}`;
    lastWasHealthy = true;
  }
  return { ...report, notified };
}
async function runWatchdog() {
  const { query: query2 } = await Promise.resolve().then(() => (init_pg(), pg_exports));
  const checkDb = async () => {
    if (!isDbEnabled()) {
      return { name: "\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A", ok: false, detail: "DATABASE_URL \u063A\u064A\u0631 \u0645\u0636\u0628\u0648\u0637" };
    }
    try {
      const t0 = Date.now();
      const { rows } = await query2("SELECT 1 AS ok");
      const ms = Date.now() - t0;
      if (!rows[0]) return { name: "\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A", ok: false, detail: "\u0645\u0627 \u0631\u062C\u0639\u062A \u0646\u062A\u064A\u062C\u0629" };
      const tables = await query2(
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'sanad%'"
      );
      return {
        name: "\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A",
        ok: true,
        detail: `${ms}ms \xB7 ${tables.rows[0]?.n ?? 0} \u062C\u062F\u0648\u0644 \xB7 ${String(dbTarget()).split(" ")[0]}`
      };
    } catch (err) {
      const msg = err.message || String(err);
      return { name: "\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A", ok: false, detail: msg.slice(0, 120) };
    }
  };
  const checkStorage = () => {
    const mode = storageMode();
    if (mode === "blob") {
      return { name: "\u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u0645\u0644\u0641\u0627\u062A", ok: true, detail: "Blob \u0645\u0631\u0628\u0648\u0637" };
    }
    return {
      name: "\u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u0645\u0644\u0641\u0627\u062A",
      ok: false,
      detail: "\u063A\u064A\u0631 \u0645\u0631\u0628\u0648\u0637 \u2014 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0628\u062A\u062A\u062E\u0632\u0646 \u0641\u064A \u0627\u0644\u0642\u0627\u0639\u062F\u0629 (\u062E\u0637\u0631 \u0639\u0644\u0649 \u0627\u0644\u062D\u0635\u0629)"
    };
  };
  return {
    ...await runWatch({ checkDb, checkStorage, notify: notifyAll }),
    channels: channelsConfigured(),
    // توافق للخلف مع أي عميل لسه بيقرأ الحقل القديم.
    telegram: channelsConfigured().includes("telegram"),
    email: channelsConfigured().includes("email")
  };
}
function alertDbFailure(err) {
  const message = err?.message || String(err);
  if (!shouldSendAlert(`db:${message.slice(0, 60)}`)) return;
  const text2 = [
    "\u{1F6A8} *\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0633\u0646\u062F \u0641\u0634\u0644\u062A*",
    `\u0627\u0644\u062E\u0637\u0623: ${message.slice(0, 200)}`,
    lastDbError && lastDbError !== message ? `\u0633\u0627\u0628\u0642\u0627\u064B: ${lastDbError.slice(0, 120)}` : "",
    "",
    "\u0627\u0644\u0641\u062D\u0635: /api/health"
  ].filter(Boolean).join("\n");
  void notifyAll(text2).catch(() => {
  });
}
var ALERT_COOLDOWN_MS, lastAlertAt, lastAlertKey, lastWasHealthy;
var init_watchdog = __esm({
  "src/server/watchdog.ts"() {
    init_alerts();
    init_pg();
    init_storage();
    ALERT_COOLDOWN_MS = 30 * 60 * 1e3;
    lastAlertAt = 0;
    lastAlertKey = "";
    lastWasHealthy = true;
  }
});

// src/server/pg.ts
var pg_exports = {};
__export(pg_exports, {
  acquireWriteLock: () => acquireWriteLock,
  clearDbError: () => clearDbError,
  closePool: () => closePool,
  dbTarget: () => dbTarget,
  getPool: () => getPool,
  isDbEnabled: () => isDbEnabled,
  lastDbError: () => lastDbError,
  query: () => query,
  recordDbError: () => recordDbError,
  setSqlClient: () => setSqlClient,
  transaction: () => transaction
});
import pg from "pg";
function recordDbError(err) {
  lastDbError = err instanceof Error ? err.message : String(err);
  void Promise.resolve().then(() => (init_watchdog(), watchdog_exports)).then((m) => m.alertDbFailure(err)).catch(() => {
  });
}
function clearDbError() {
  lastDbError = null;
}
function dbTarget() {
  const url = process.env.DATABASE_URL;
  if (!url) return "unset";
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname} pooler=${u.hostname.includes("-pooler")} sslmode=${u.searchParams.get("sslmode") || "none"}`;
  } catch {
    return "unparseable";
  }
}
function isDbEnabled() {
  return injected !== null || !!process.env.DATABASE_URL;
}
function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!pool) {
    const isNeon = /neon\.tech/.test(process.env.DATABASE_URL);
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      // Neon and most managed Postgres providers require TLS.
      ssl: isNeon ? { rejectUnauthorized: false } : void 0,
      max: Number(process.env.PG_POOL_MAX || 3),
      idleTimeoutMillis: 1e4,
      connectionTimeoutMillis: 1e4
    });
    pool.on("error", (err) => {
      console.error("[DB] Unexpected pool error:", err.message);
    });
  }
  return pool;
}
function setSqlClient(client) {
  injected = client;
}
function activeClient() {
  if (injected) return injected;
  return getPool();
}
async function query(text2, params) {
  const client = activeClient();
  try {
    const result = await client.query(text2, params);
    clearDbError();
    return result;
  } catch (err) {
    recordDbError(err);
    throw err;
  }
}
async function transaction(fn) {
  const client = activeClient();
  const anyClient = client;
  if (typeof anyClient.transaction === "function") {
    return anyClient.transaction(async (tx) => fn(tx));
  }
  await client.query("BEGIN");
  try {
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
    }
    throw err;
  }
}
async function acquireWriteLock(waitMs = 15e3) {
  if (injected) {
    return async () => {
    };
  }
  const pool2 = getPool();
  const client = await pool2.connect();
  const deadline = Date.now() + waitMs;
  let delay = 40;
  try {
    for (; ; ) {
      const { rows } = await client.query("SELECT pg_try_advisory_lock($1) AS ok", [LOCK_KEY]);
      if (rows[0]?.ok) break;
      if (Date.now() > deadline) {
        throw new Error("DB write lock timeout \u2014 another instance is still writing");
      }
      await new Promise((r) => setTimeout(r, delay + Math.random() * delay));
      delay = Math.min(delay * 2, 500);
    }
  } catch (err) {
    client.release();
    throw err;
  }
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    } catch (err) {
      console.warn("[DB] Failed to release advisory lock:", err.message);
    } finally {
      client.release();
    }
  };
}
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
var pool, injected, lastDbError, LOCK_KEY;
var init_pg = __esm({
  "src/server/pg.ts"() {
    pool = null;
    injected = null;
    lastDbError = null;
    LOCK_KEY = 982451301;
  }
});

// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// src/server/routes.ts
import { Router } from "express";

// src/server/barcodeLookup.ts
var CATALOGS = [
  { name: "Open Food Facts", base: "https://world.openfoodfacts.org" },
  { name: "Open Beauty Facts", base: "https://world.openbeautyfacts.org" },
  { name: "Open Products Facts", base: "https://world.openproductsfacts.org" }
];
function text(value) {
  return typeof value === "string" ? value.trim().slice(0, 250) : "";
}
async function queryCatalog(catalog, barcode) {
  const fields = "product_name_ar,product_name_en,product_name,brands,quantity";
  const response = await fetch(`${catalog.base}/api/v2/product/${barcode}?fields=${fields}`, {
    headers: { "User-Agent": "SanadPOS/1.0 (alsiralsaig@gmail.com)" },
    signal: AbortSignal.timeout(7e3)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`catalog unavailable: ${response.status}`);
  const body = await response.json();
  if (body.status !== 1 || !body.product) return null;
  const p = body.product;
  const productName = text(p.product_name_ar) || text(p.product_name) || text(p.product_name_en);
  if (!productName) return null;
  const brand = text(p.brands).split(",")[0].trim();
  const quantity = text(p.quantity);
  const nameParts = [productName];
  if (brand && !productName.toLocaleLowerCase().includes(brand.toLocaleLowerCase())) nameParts.push(brand);
  if (quantity && !productName.toLocaleLowerCase().includes(quantity.toLocaleLowerCase())) nameParts.push(quantity);
  return { name: nameParts.join(" - "), source: catalog.name, sourceUrl: `${catalog.base}/product/${barcode}` };
}
async function barcodeLookupHandler(req, res) {
  const barcode = req.params.barcode;
  if (!/^(?:\d{8}|\d{12,14})$/.test(barcode)) {
    return res.status(400).json({ error: "\u0627\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0631\u0643\u0648\u062F \u0631\u0642\u0645\u064A \u0645\u0646 8 \u0623\u0648 12 \u0625\u0644\u0649 14 \u0631\u0642\u0645\u0627\u064B." });
  }
  res.set("Cache-Control", "no-store");
  const results = await Promise.allSettled(CATALOGS.map((catalog) => queryCatalog(catalog, barcode)));
  const match = results.find((result) => result.status === "fulfilled" && result.value !== null);
  if (match?.status === "fulfilled" && match.value) return res.json({ found: true, product: match.value });
  if (results.some((result) => result.status === "rejected")) {
    return res.status(503).json({ error: "\u062A\u0639\u0630\u0631 \u0627\u0644\u0628\u062D\u062B \u0641\u064A \u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u062D\u0627\u0644\u064A\u0627\u064B. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0623\u0648 \u0623\u0643\u0645\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u064A\u062F\u0648\u064A\u0627\u064B." });
  }
  return res.json({ found: false });
}

// src/lib/staffPermissions.ts
var PERM_DEFS = [
  { key: "view_profits", label: "\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0635\u0627\u0641\u064A \u0627\u0644\u0623\u0631\u0628\u0627\u062D" },
  { key: "view_cogs", label: "\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0634\u0631\u0627\u0621 (COGS)" },
  { key: "edit_prices", label: "\u062A\u0639\u062F\u064A\u0644 \u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A" },
  { key: "process_returns", label: "\u0625\u0631\u062C\u0627\u0639 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631" },
  { key: "override_stock", label: "\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0628\u0627\u0644\u0633\u0627\u0644\u0628" },
  { key: "manage_staff", label: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646" },
  { key: "view_audit", label: "\u0633\u062C\u0644 \u0627\u0644\u062A\u062F\u0642\u064A\u0642" }
];
function defaultPermissions(role) {
  switch (role) {
    case "owner":
    case "super_admin":
      return ["all", ...PERM_DEFS.map((p) => p.key), "pos:sell", "inventory:view"];
    case "branch_manager":
      return ["pos:sell", "inventory:view", "edit_prices", "process_returns", "manage_staff", "view_audit"];
    case "cashier":
      return ["pos:sell", "inventory:view", "process_returns"];
    case "inventory_officer":
      return ["inventory:view", "view_cogs", "override_stock"];
    case "accountant":
      return ["view_profits", "view_cogs", "view_audit"];
    case "auditor":
      return ["view_audit", "inventory:view"];
    default:
      return ["pos:sell", "inventory:view"];
  }
}
function hasPerm(employee, key) {
  const perms = employee.permissions || [];
  if (perms.includes("all") || employee.role === "owner" || employee.role === "super_admin") return true;
  return perms.includes(key);
}
function resolveActorPerms(role, employee) {
  const source = employee ? employee : {
    role: role || "cashier",
    permissions: defaultPermissions(role || "cashier")
  };
  return {
    viewCogs: hasPerm(source, "view_cogs"),
    viewProfits: hasPerm(source, "view_profits"),
    editPrices: hasPerm(source, "edit_prices"),
    processReturns: hasPerm(source, "process_returns"),
    overrideStock: hasPerm(source, "override_stock"),
    manageStaff: hasPerm(source, "manage_staff"),
    viewAudit: hasPerm(source, "view_audit")
  };
}

// src/lib/barcodeMatch.ts
function normalizeBarcode(raw) {
  return (raw || "").replace(/[\s\u200e\u200f-]/g, "");
}

// src/server/db.ts
init_pg();

// src/server/ids.ts
import { randomUUID } from "crypto";
function newId(prefix) {
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}
function newCode(prefix, pad = 6) {
  const rand = randomUUID().replace(/-/g, "").slice(0, pad).toUpperCase();
  return `${prefix}-${rand}`;
}

// src/server/repository.ts
init_pg();
var PRIMARY_KEY_OVERRIDES = {
  currencies: "code"
};
function primaryKeyFor(collection, rows) {
  const override = PRIMARY_KEY_OVERRIDES[collection];
  if (override) return override;
  const sample = rows.find((r) => r && typeof r === "object");
  if (sample && sample.id === void 0 && sample.code !== void 0) return "code";
  return "id";
}
var EXTRA_COLUMN = "__extra";
var INDEXED_FIELDS = [
  "tenantId",
  "branchId",
  "productId",
  "customerId",
  "status",
  "createdAt",
  "timestamp",
  "submittedAt",
  "saleId",
  "shiftId"
];
function sqlTypeOf(value) {
  if (typeof value === "number") return "double precision";
  if (typeof value === "boolean") return "boolean";
  if (value && typeof value === "object") return "jsonb";
  return "text";
}
function inferColumns(rows) {
  const columns = {};
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    for (const [key, value] of Object.entries(row)) {
      if (key === "id") continue;
      const inferred = sqlTypeOf(value);
      const existing = columns[key];
      if (!existing) {
        columns[key] = inferred;
      } else if (existing !== inferred) {
        columns[key] = "jsonb";
      }
    }
  }
  return columns;
}
function buildTableDefs(seed) {
  return Object.entries(seed).filter(([, rows]) => Array.isArray(rows)).map(([collection, rows]) => {
    const primaryKey = primaryKeyFor(collection, rows);
    const columns = inferColumns(rows);
    delete columns[primaryKey];
    return {
      collection,
      table: toTableName(collection),
      columns,
      primaryKey
    };
  });
}
function toTableName(collection) {
  return `sanad_${collection.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`;
}
var q = (identifier) => `"${identifier.replace(/"/g, '""')}"`;
function ddlStatementsFor(def) {
  const cols = Object.entries(def.columns).map(
    ([name, type]) => `  ${q(name)} ${type}`
  );
  const statements = [
    `CREATE TABLE IF NOT EXISTS ${q(def.table)} (
  ${q(def.primaryKey)} text PRIMARY KEY,
${cols.map((c) => `${c},`).join("\n")}
  ${q(EXTRA_COLUMN)} jsonb
)`
  ];
  for (const field of INDEXED_FIELDS) {
    if (field in def.columns) {
      const indexName = `idx_${def.table}_${field.toLowerCase()}`;
      statements.push(
        `CREATE INDEX IF NOT EXISTS ${q(indexName)} ON ${q(def.table)} (${q(field)})`
      );
    }
  }
  return statements;
}
async function ensureSchema(seed) {
  const defs = buildTableDefs(seed);
  if (await schemaExists(defs)) {
    return defs;
  }
  await transaction(async (client) => {
    for (const def of defs) {
      for (const statement of ddlStatementsFor(def)) {
        await client.query(statement);
      }
    }
  });
  return defs;
}
async function loadAll(defs) {
  const result = {};
  if (defs.length === 0) return result;
  const parts = defs.map(
    (def, i) => `SELECT ${i}::int AS idx, COALESCE(json_agg(t), '[]'::json) AS rows FROM ${q(def.table)} t`
  );
  const { rows } = await query(parts.join("\nUNION ALL\n"));
  const byIndex = /* @__PURE__ */ new Map();
  for (const row of rows) {
    byIndex.set(Number(row.idx), row.rows || []);
  }
  defs.forEach((def, i) => {
    const tableRows = byIndex.get(i) || [];
    result[def.collection] = tableRows.map((row) => hydrate(def, row));
  });
  return result;
}
function hydrate(def, row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === EXTRA_COLUMN) continue;
    out[key] = value;
  }
  const extra = row[EXTRA_COLUMN];
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    for (const [key, value] of Object.entries(extra)) {
      if (out[key] === void 0) out[key] = value;
    }
  }
  return out;
}
async function persistAll(defs, data, onlyCollections) {
  const targets = onlyCollections ? defs.filter((d) => onlyCollections.has(d.collection)) : defs;
  if (targets.length === 0) return;
  await transaction(async (client) => {
    for (const def of targets) {
      const rows = data[def.collection];
      if (!Array.isArray(rows)) continue;
      await persistTable(client, def, rows);
    }
  });
}
async function persistTable(client, def, rows) {
  const known = Object.keys(def.columns);
  const pk = def.primaryKey;
  const ids = rows.map((row) => String(row[pk])).filter(Boolean);
  if (ids.length > 0) {
    await client.query(
      `DELETE FROM ${q(def.table)} WHERE ${q(pk)} <> ALL($1::text[])`,
      [ids]
    );
  } else {
    await client.query(`DELETE FROM ${q(def.table)}`);
  }
  for (const row of rows) {
    if (!row || row[pk] === void 0 || row[pk] === null) continue;
    const values = [String(row[pk])];
    const placeholders = ["$1"];
    const assignments = [];
    const columns = [q(pk)];
    for (const field of known) {
      const raw = row[field];
      values.push(encodeValue(raw));
      placeholders.push(`$${values.length}`);
      columns.push(q(field));
      assignments.push(`${q(field)} = EXCLUDED.${q(field)}`);
    }
    const extras = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === pk || known.includes(key)) continue;
      extras[key] = value;
    }
    values.push(Object.keys(extras).length ? JSON.stringify(extras) : null);
    placeholders.push(`$${values.length}`);
    columns.push(q(EXTRA_COLUMN));
    assignments.push(`${q(EXTRA_COLUMN)} = EXCLUDED.${q(EXTRA_COLUMN)}`);
    await client.query(
      `INSERT INTO ${q(def.table)} (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       ON CONFLICT (${q(pk)}) DO UPDATE SET ${assignments.join(", ")}`,
      values
    );
  }
}
function encodeValue(value) {
  if (value === void 0 || value === null) return null;
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return value;
}
async function schemaExists(defs) {
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS n
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])`,
      [defs.map((d) => d.table)]
    );
    return Number(rows[0]?.n) === defs.length;
  } catch {
    return false;
  }
}
function rowFingerprint(row) {
  try {
    return JSON.stringify(row);
  } catch {
    return Math.random().toString(36);
  }
}
function keyOf(def, row) {
  const value = row?.[def.primaryKey];
  return value === void 0 || value === null ? null : String(value);
}
function buildBaseline(defs, data) {
  const baseline = /* @__PURE__ */ new Map();
  for (const def of defs) {
    const rows = data[def.collection] || [];
    const map = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const key = keyOf(def, row);
      if (key !== null) map.set(key, rowFingerprint(row));
    }
    baseline.set(def.collection, map);
  }
  return baseline;
}
async function persistDiff(defs, data, baseline) {
  const work = [];
  let upsertCount = 0;
  let deleteCount = 0;
  for (const def of defs) {
    const rows = data[def.collection];
    if (!Array.isArray(rows)) continue;
    const before = baseline.get(def.collection) || /* @__PURE__ */ new Map();
    const seen = /* @__PURE__ */ new Set();
    const upserts = [];
    for (const row of rows) {
      const key = keyOf(def, row);
      if (key === null) continue;
      seen.add(key);
      if (before.get(key) !== rowFingerprint(row)) {
        upserts.push(row);
      }
    }
    const deletes = [...before.keys()].filter((k) => !seen.has(k));
    if (upserts.length || deletes.length) {
      work.push({ def, upserts, deletes });
      upsertCount += upserts.length;
      deleteCount += deletes.length;
    }
  }
  if (work.length === 0) return { upserts: 0, deletes: 0, collections: [] };
  await transaction(async (client) => {
    for (const { def, upserts, deletes } of work) {
      for (const id of deletes) {
        await client.query(
          `DELETE FROM ${q(def.table)} WHERE ${q(def.primaryKey)} = $1`,
          [id]
        );
      }
      for (const row of upserts) {
        await upsertRow(client, def, row);
      }
    }
  });
  return {
    upserts: upsertCount,
    deletes: deleteCount,
    collections: work.map((w) => w.def.collection)
  };
}
async function upsertRow(client, def, row) {
  const pk = def.primaryKey;
  const known = Object.keys(def.columns);
  const values = [String(row[pk])];
  const placeholders = ["$1"];
  const assignments = [];
  const columns = [q(pk)];
  for (const field of known) {
    values.push(encodeValue(row[field]));
    placeholders.push(`$${values.length}`);
    columns.push(q(field));
    assignments.push(`${q(field)} = EXCLUDED.${q(field)}`);
  }
  const extras = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === pk || known.includes(key)) continue;
    extras[key] = value;
  }
  values.push(Object.keys(extras).length ? JSON.stringify(extras) : null);
  placeholders.push(`$${values.length}`);
  columns.push(q(EXTRA_COLUMN));
  assignments.push(`${q(EXTRA_COLUMN)} = EXCLUDED.${q(EXTRA_COLUMN)}`);
  await client.query(
    `INSERT INTO ${q(def.table)} (${columns.join(", ")})
     VALUES (${placeholders.join(", ")})
     ON CONFLICT (${q(pk)}) DO UPDATE SET ${assignments.join(", ")}`,
    values
  );
}

// src/server/db.ts
var INITIAL_PLANS = [
  {
    id: "plan_starter",
    name: "\u0628\u0627\u0642\u0629 \u0627\u0644\u062A\u0627\u062C\u0631 \u0627\u0644\u0645\u0628\u062A\u062F\u0626 (Starter)",
    description: "\u0645\u062B\u0627\u0644\u064A\u0629 \u0644\u0644\u0645\u062A\u0627\u062C\u0631 \u0627\u0644\u0635\u063A\u064A\u0631\u0629 \u0648\u0627\u0644\u062F\u0643\u0627\u0643\u064A\u0646 \u0627\u0644\u0641\u0631\u062F\u064A\u0629",
    monthlyPriceSdg: 75e3,
    maxBranches: 1,
    maxEmployees: 3,
    features: ["\u0641\u0631\u0639 \u0648\u0627\u062D\u062F \u0641\u0642\u0637", "\u062D\u062A\u0649 3 \u0645\u0648\u0638\u0641\u064A\u0646", "\u0646\u0642\u0637\u0629 \u0628\u064A\u0639 POS \u062A\u0639\u0645\u0644 \u062F\u0648\u0646 \u0625\u0646\u062A\u0631\u0646\u062A", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0648\u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F", "\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0648\u0645\u064A\u0629"]
  },
  {
    id: "plan_growth",
    name: "\u0628\u0627\u0642\u0629 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0648\u0627\u0644\u0646\u0645\u0648 (Growth)",
    description: "\u0627\u0644\u0623\u0646\u0633\u0628 \u0644\u0644\u0634\u0631\u0643\u0627\u062A \u0648\u0645\u062D\u0644\u0627\u062A \u0627\u0644\u062A\u062C\u0632\u0626\u0629 \u0630\u0627\u062A \u0627\u0644\u0641\u0631\u0648\u0639 \u0627\u0644\u0645\u062A\u0639\u062F\u062F\u0629",
    monthlyPriceSdg: 18e4,
    maxBranches: 4,
    maxEmployees: 15,
    features: [
      "\u062D\u062A\u0649 4 \u0641\u0631\u0648\u0639 \u0645\u0633\u062A\u0642\u0644\u0629",
      "\u062D\u062A\u0649 15 \u0645\u0648\u0638\u0641\u0627\u064B \u0645\u0639 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0645\u062E\u0635\u0635\u0629",
      "\u062A\u062D\u0648\u064A\u0644\u0627\u062A \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0628\u064A\u0646 \u0627\u0644\u0641\u0631\u0648\u0639 \u0645\u0639 \u0645\u062D\u0627\u0636\u0631 \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645",
      "\u0645\u062A\u062C\u0631 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0639\u0627\u0645 \u0645\u0639 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0632\u0628\u0627\u0626\u0646",
      "\u062A\u0639\u062F\u062F \u0627\u0644\u0639\u0645\u0644\u0627\u062A \u0648\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0628\u062F\u0642\u0629",
      "\u0631\u0628\u0637 \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0648\u0628\u0646\u0643\u0643"
    ],
    isPopular: true
  },
  {
    id: "plan_enterprise",
    name: "\u0628\u0627\u0642\u0629 \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0648\u0627\u0644\u0645\u0624\u0633\u0633\u0627\u062A (Enterprise)",
    description: "\u0634\u0627\u0645\u0644\u0629 \u0644\u0643\u0628\u0631\u0649 \u0627\u0644\u0645\u0624\u0633\u0633\u0627\u062A \u0648\u0633\u0644\u0627\u0633\u0644 \u0627\u0644\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A",
    monthlyPriceSdg: 35e4,
    maxBranches: 20,
    maxEmployees: 100,
    features: [
      "\u0641\u0631\u0648\u0639 \u063A\u064A\u0631 \u0645\u062D\u062F\u0648\u062F\u0629 (\u062D\u062A\u0649 20 \u0641\u0631\u0639\u0627\u064B)",
      "\u0645\u0648\u0638\u0641\u0648\u0646 \u063A\u064A\u0631 \u0645\u062D\u062F\u0648\u062F\u064A\u0646",
      "\u062A\u0642\u0627\u0631\u064A\u0631 \u0645\u062D\u0627\u0633\u0628\u064A\u0629 \u062A\u0641\u0635\u064A\u0644\u064A\u0629 \u0648\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0623\u0631\u0628\u0627\u062D \u0648\u0627\u0644\u062E\u0633\u0627\u0626\u0631",
      "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0648\u0631\u062F\u064A\u0627\u062A \u0648\u062A\u062F\u0642\u064A\u0642 \u0627\u0644\u0639\u062C\u0632 \u0648\u0627\u0644\u0641\u0627\u0626\u0636 \u0627\u0644\u0645\u062A\u0642\u062F\u0645",
      "\u062F\u0639\u0645 \u0641\u0646\u064A \u0645\u062E\u0635\u0635 \u0639\u0644\u0649 \u0645\u062F\u0627\u0631 24 \u0633\u0627\u0639\u0629",
      "\u0646\u0633\u062E \u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0641\u0648\u0631\u064A \u0648\u0633\u062D\u0627\u0628\u064A \u0622\u0645\u0646"
    ]
  }
];
var INITIAL_TENANTS = [
  {
    id: "tenant_alrowad",
    slug: "alrowad-trade",
    name: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0627\u0644\u0645\u062D\u0627\u0635\u064A\u0644",
    tradeName: "\u0627\u0644\u0631\u0648\u0627\u062F \u0645\u0627\u0631\u0643\u062A \u0648\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u062C\u0645\u0644\u0629",
    phone: "+249 91 234 5678",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0639\u0631\u0628\u064A - \u0639\u0645\u0627\u0631\u0629 \u0627\u0644\u0631\u0648\u0627\u062F - \u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    currency: "SDG",
    status: "active",
    subscriptionPlanId: "plan_growth",
    subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString(),
    settings: {
      receiptHeader: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u0627\u0633\u062A\u0647\u0644\u0627\u0643\u064A\u0629\n\u0627\u0644\u062E\u0631\u0637\u0648\u0645 - \u0647\u0627\u062A\u0641: 0912345678",
      receiptFooter: "\u0634\u0643\u0631\u0627\u064B \u0644\u0632\u064A\u0627\u0631\u062A\u0643\u0645! \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0627\u0644\u0645\u0628\u0627\u0639\u0629 \u062A\u0631\u062F \u0648\u062A\u0633\u062A\u0628\u062F\u0644 \u062E\u0644\u0627\u0644 3 \u0623\u064A\u0627\u0645 \u0645\u0639 \u0625\u0628\u0631\u0627\u0632 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629.\n\u0631\u0642\u0645 \u0627\u0644\u0634\u0643\u0627\u0648\u0649: 0123456789",
      allowNegativeStock: false,
      defaultMaxDiscountPct: 15,
      zatcaQrEnabled: true,
      taxNumber: "1004892348",
      commercialRegNo: "SD-KHT-2021-998",
      bankakAccount: "2498765",
      bankakAccountName: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u062A\u062C\u0627\u0631\u0629",
      bankakPhone: "0912345678",
      costingMethod: "weighted_average",
      vatEnabled: true,
      defaultVatPct: 15,
      taxIdentificationNumber: "1004892348",
      pricesIncludeVat: false,
      showVatBreakdown: true,
      showTaxPerItem: true,
      loyaltyRateSdgPerPoint: 1e3
    },
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "tenant_nile_boutique",
    slug: "nile-boutique",
    name: "\u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644 \u0644\u0644\u0645\u0644\u0627\u0628\u0633 \u0648\u0627\u0644\u0623\u0646\u0627\u0642\u0629",
    tradeName: "\u0627\u0644\u0646\u064A\u0644 \u0641\u0627\u0634\u0648\u0646",
    phone: "+249 92 888 7777",
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    address: "\u0633\u0648\u0642 \u062F\u064A\u0645 \u0633\u0648\u0627\u0643\u0646 - \u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u064A\u0646\u0627\u0621 - \u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    currency: "SDG",
    status: "active",
    subscriptionPlanId: "plan_starter",
    subscriptionExpiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1e3).toISOString(),
    settings: {
      receiptHeader: "\u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644 \u0644\u0644\u0645\u0644\u0627\u0628\u0633 \u0648\u0627\u0644\u0623\u0646\u0627\u0642\u0629\n\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 - \u062A\u0631\u062D\u0627\u0628\u0627\u064B \u0628\u0643\u0645",
      receiptFooter: "\u0634\u0643\u0631\u0627\u064B \u0644\u0627\u062E\u062A\u064A\u0627\u0631\u0643\u0645 \u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644! \u062A\u0627\u0628\u0639\u0648\u0627 \u062A\u0634\u0643\u064A\u0644\u062A\u0646\u0627 \u0639\u0644\u0649 \u0627\u0644\u0625\u0646\u0633\u062A\u063A\u0631\u0627\u0645",
      allowNegativeStock: false,
      defaultMaxDiscountPct: 10,
      zatcaQrEnabled: true,
      taxNumber: "2005991823",
      commercialRegNo: "SD-PSD-2023-412",
      bankakAccount: "3109844",
      bankakAccountName: "\u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644",
      bankakPhone: "0928887777",
      costingMethod: "fifo",
      vatEnabled: true,
      defaultVatPct: 15,
      taxIdentificationNumber: "2005991823",
      pricesIncludeVat: false,
      showVatBreakdown: true,
      showTaxPerItem: true,
      loyaltyRateSdgPerPoint: 1e3
    },
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_BRANCHES = [
  {
    id: "branch_kht_main",
    tenantId: "tenant_alrowad",
    name: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A (\u0627\u0644\u0631\u064A\u0627\u0636 / \u0627\u0644\u0645\u0634\u062A\u0644)",
    code: "KHT-01",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u062A\u0642\u0627\u0637\u0639 \u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u0634\u062A\u0644 \u0645\u0639 \u0627\u0644\u062C\u0632\u0627\u0631\u060C \u0627\u0644\u0631\u064A\u0627\u0636",
    phone: "0912345678",
    isMain: true,
    isActive: true,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "branch_madani",
    tenantId: "tenant_alrowad",
    name: "\u0641\u0631\u0639 \u0648\u062F \u0645\u062F\u0646\u064A (\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0643\u0628\u064A\u0631)",
    code: "MDN-02",
    city: "\u0648\u062F \u0645\u062F\u0646\u064A",
    address: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0643\u0628\u064A\u0631 - \u0628\u0627\u0644\u0642\u0631\u0628 \u0645\u0646 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0623\u0647\u0644\u064A \u0627\u0644\u0645\u0635\u0631\u064A",
    phone: "0912345679",
    isMain: false,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "branch_psd_main",
    tenantId: "tenant_nile_boutique",
    name: "\u0641\u0631\u0639 \u0628\u0648\u0631\u062A\u0633\u0648\u062Fan \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    code: "PSD-01",
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    address: "\u0634\u0627\u0631\u0639 \u0627\u0644\u0633\u064A\u062F \u0639\u0644\u064A \u0627\u0644\u0645\u064A\u0631\u063A\u0646\u064A\u060C \u0648\u0633\u0637 \u0627\u0644\u0628\u0644\u062F",
    phone: "0928887777",
    isMain: true,
    isActive: true,
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_EMPLOYEES = [
  {
    id: "emp_owner_rowad",
    tenantId: "tenant_alrowad",
    name: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    email: "ahmed@alrowad.sd",
    phone: "0912000001",
    role: "owner",
    pin: "1234",
    permissions: ["all"],
    maxDiscountPct: 50,
    isActive: true,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "emp_mgr_kht",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    name: "\u0639\u062B\u0645\u0627\u0646 \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u064A\u0645 (\u0645\u062F\u064A\u0631 \u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645)",
    email: "osman@alrowad.sd",
    phone: "0912000002",
    role: "branch_manager",
    pin: "4321",
    permissions: ["pos:view", "pos:sell", "inventory:view", "inventory:transfer", "shifts:review", "reports:view"],
    maxDiscountPct: 20,
    isActive: true,
    createdAt: new Date(Date.now() - 80 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "emp_cashier_kht",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    name: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647 (\u0643\u0627\u0634\u064A\u0631 - \u0627\u0644\u062E\u0631\u0637\u0648\u0645)",
    email: "mohamed@alrowad.sd",
    phone: "0912000003",
    role: "cashier",
    pin: "0000",
    permissions: ["pos:view", "pos:sell", "shifts:manage"],
    maxDiscountPct: 10,
    isActive: true,
    createdAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "emp_inventory_rowad",
    tenantId: "tenant_alrowad",
    name: "\u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0639\u0644\u064A (\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u062E\u0632\u0646)",
    email: "ibrahim@alrowad.sd",
    phone: "0912000004",
    role: "inventory_officer",
    pin: "5555",
    permissions: ["inventory:view", "inventory:edit", "inventory:transfer", "purchases:manage"],
    maxDiscountPct: 0,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "emp_accountant_rowad",
    tenantId: "tenant_alrowad",
    name: "\u0633\u0627\u0631\u0629 \u0645\u0635\u0637\u0641\u0649 (\u0627\u0644\u0645\u062D\u0627\u0633\u0628 \u0627\u0644\u0645\u0627\u0644\u064A)",
    email: "sara@alrowad.sd",
    phone: "0912000005",
    role: "accountant",
    pin: "7777",
    permissions: ["reports:view", "expenses:manage", "purchases:view", "accounting:view"],
    maxDiscountPct: 0,
    isActive: true,
    createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_PRODUCTS = [
  {
    id: "prod_sugar_kenana",
    tenantId: "tenant_alrowad",
    name: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645",
    sku: "SUG-KEN-10KG",
    barcode: "628100123001",
    category: "\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u064A\u0629 \u0648\u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629",
    unit: "\u0643\u064A\u0633 10 \u0643\u062C\u0645",
    purchaseCost: 26e3,
    costCurrency: "SDG",
    sellingPriceSdg: 31500,
    minStockAlert: 15,
    minimumStock: 15,
    imageUrl: "/assets/images/product_sugar_kenana_1792173270044.jpg",
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_cooking_oil",
    tenantId: "tenant_alrowad",
    name: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631",
    sku: "OIL-SBH-4.5L",
    barcode: "628100123002",
    category: "\u0627\u0644\u0632\u064A\u0648\u062A \u0648\u0627\u0644\u0633\u0645\u0646",
    unit: "\u062C\u0631\u0643\u0646 4.5 \u0644\u062A\u0631",
    purchaseCost: 19500,
    costCurrency: "SDG",
    sellingPriceSdg: 23800,
    minStockAlert: 10,
    minimumStock: 10,
    imageUrl: "/assets/images/product_cooking_oil_1792173269992.jpg",
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_sayga_flour",
    tenantId: "tenant_alrowad",
    name: "\u062F\u0642\u064A\u0642 \u0633\u064A\u0642\u0627 \u0645\u062E\u0635\u0648\u0635 \u0641\u0627\u062E\u0631 1 \u0643\u062C\u0645",
    sku: "FLR-SYG-1KG",
    barcode: "628100123003",
    category: "\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u064A\u0629 \u0648\u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629",
    unit: "\u0628\u0627\u0643\u062A 1 \u0643\u062C\u0645",
    purchaseCost: 2100,
    costCurrency: "SDG",
    sellingPriceSdg: 2650,
    minStockAlert: 30,
    minimumStock: 30,
    imageUrl: "/assets/images/product_sayga_flour_1792173271374.jpg",
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_tea_ghazal",
    tenantId: "tenant_alrowad",
    name: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0633\u064A\u0644\u0627\u0646\u064A \u0641\u0627\u062E\u0631 400 \u062C\u0645",
    sku: "TEA-GHZ-400G",
    barcode: "628100123004",
    category: "\u0627\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062A \u0648\u0627\u0644\u0634\u0627\u064A",
    unit: "\u0639\u0644\u0628\u0629 400 \u062C\u0645",
    purchaseCost: 5800,
    costCurrency: "SDG",
    sellingPriceSdg: 7200,
    minStockAlert: 15,
    minimumStock: 15,
    imageUrl: "/assets/images/product_tea_box_1792173271153.jpg",
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_kapo_milk",
    tenantId: "tenant_alrowad",
    name: "\u062D\u0644\u064A\u0628 \u0643\u0627\u0628\u0648 \u0628\u0648\u062F\u0631\u0629 \u0643\u0627\u0645\u0644 \u0627\u0644\u062F\u0633\u0645 2.25 \u0643\u062C\u0645",
    sku: "MLK-KAPO-2.25K",
    barcode: "628100123005",
    category: "\u0627\u0644\u0623\u0644\u0628\u0627\u0646 \u0648\u0645\u0634\u062A\u0642\u0627\u062A\u0647\u0627",
    unit: "\u0639\u0644\u0628\u0629 \u0635\u0641\u064A\u062D",
    purchaseCost: 32e3,
    costCurrency: "SDG",
    sellingPriceSdg: 37500,
    minStockAlert: 10,
    minimumStock: 10,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_badr_soap",
    tenantId: "tenant_alrowad",
    name: "\u0635\u0627\u0628\u0648\u0646 \u063A\u0633\u064A\u0644 \u0627\u0644\u0628\u062F\u0631 \u062F\u0633\u062A\u0629 (12 \u0642\u0637\u0639\u0629)",
    sku: "SOP-BDR-12PC",
    barcode: "628100123006",
    category: "\u0627\u0644\u0645\u0646\u0638\u0641\u0627\u062A \u0648\u0627\u0644\u0639\u0646\u0627\u064A\u0629 \u0627\u0644\u0645\u0646\u0632\u0644\u064A\u0629",
    unit: "\u062F\u0633\u062A\u0629 (12 \u0642\u0637\u0639\u0629)",
    purchaseCost: 6500,
    costCurrency: "SDG",
    sellingPriceSdg: 8200,
    minStockAlert: 15,
    minimumStock: 15,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_coffee_beans",
    tenantId: "tenant_alrowad",
    name: "\u0628\u0646 \u062D\u0628\u0634\u064A \u0647\u0631\u0631\u064A \u062F\u0631\u062C\u0629 \u0623\u0648\u0644\u0649 1 \u0643\u062C\u0645",
    sku: "COF-ETH-1KG",
    barcode: "628100123007",
    category: "\u0627\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062A \u0648\u0627\u0644\u0634\u0627\u064A",
    unit: "\u0643\u062C\u0645",
    purchaseCost: 11e3,
    costCurrency: "SDG",
    sellingPriceSdg: 14500,
    minStockAlert: 12,
    minimumStock: 12,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_rice_prince",
    tenantId: "tenant_alrowad",
    name: "\u0623\u0631\u0632 \u0645\u0635\u0631\u064A \u0627\u0644\u0628\u0631\u0646\u0633 \u0643\u0627\u0645\u0648\u0644\u064A\u0646\u0648 5 \u0643\u062C\u0645",
    sku: "RCE-PRN-5KG",
    barcode: "628100123008",
    category: "\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u064A\u0629 \u0648\u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629",
    unit: "\u0643\u064A\u0633 5 \u0643\u062C\u0645",
    purchaseCost: 13500,
    costCurrency: "SDG",
    sellingPriceSdg: 16800,
    minStockAlert: 20,
    minimumStock: 20,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_INVENTORIES = [
  // Branch Khartoum Main
  { id: "inv_1", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_sugar_kenana", quantity: 45, minAlertQuantity: 15, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_2", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_cooking_oil", quantity: 28, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_3", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_sayga_flour", quantity: 120, minAlertQuantity: 30, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_4", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_tea_ghazal", quantity: 6, minAlertQuantity: 15, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 6 <= 15
  { id: "inv_5", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_kapo_milk", quantity: 18, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_6", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_badr_soap", quantity: 50, minAlertQuantity: 15, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_7", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_coffee_beans", quantity: 4, minAlertQuantity: 12, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 4 <= 12
  { id: "inv_8", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_rice_prince", quantity: 8, minAlertQuantity: 20, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 8 <= 20
  // Branch Wad Madani
  { id: "inv_9", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_sugar_kenana", quantity: 20, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_10", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_cooking_oil", quantity: 14, minAlertQuantity: 8, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_11", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_sayga_flour", quantity: 55, minAlertQuantity: 20, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_12", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_tea_ghazal", quantity: 5, minAlertQuantity: 15, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 5 <= 15
  { id: "inv_13", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_kapo_milk", quantity: 3, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 3 <= 10
  { id: "inv_14", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_badr_soap", quantity: 25, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_15", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_coffee_beans", quantity: 2, minAlertQuantity: 12, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 2 <= 12
  { id: "inv_16", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_rice_prince", quantity: 18, minAlertQuantity: 20, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() }
];
var INITIAL_CURRENCIES = [
  { code: "SDG", name: "\u062C\u0646\u064A\u0647 \u0633\u0648\u062F\u0627\u0646\u064A", symbol: "\u062C.\u0633", rateToSdg: 1, isBase: true, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "USD", name: "\u062F\u0648\u0644\u0627\u0631 \u0623\u0645\u0631\u064A\u0643\u064A", symbol: "$", rateToSdg: 2750, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "SAR", name: "\u0631\u064A\u0627\u0644 \u0633\u0639\u0648\u062F\u064A", symbol: "\u0631.\u0633", rateToSdg: 733.33, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "TRY", name: "\u0644\u064A\u0631\u0629 \u062A\u0631\u0643\u064A\u0629", symbol: "\u20BA", rateToSdg: 82.5, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "EGP", name: "\u062C\u0646\u064A\u0647 \u0645\u0635\u0631\u064A", symbol: "\u062C.\u0645", rateToSdg: 56.8, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "AED", name: "\u062F\u0631\u0647\u0645 \u0625\u0645\u0627\u0631\u0627\u062A\u064A", symbol: "\u062F.\u0625", rateToSdg: 748.5, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "EUR", name: "\u064A\u0648\u0631\u0648 \u0623\u0648\u0631\u0648\u0628\u064A", symbol: "\u20AC", rateToSdg: 2980, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "QAR", name: "\u0631\u064A\u0627\u0644 \u0642\u0637\u0631\u064A", symbol: "\u0631.\u0642", rateToSdg: 755, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() }
];
var INITIAL_SHIFTS = [
  {
    id: "shift_kht_001",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A (\u0627\u0644\u0631\u064A\u0627\u0636 / \u0627\u0644\u0645\u0634\u062A\u0644)",
    cashierId: "emp_cashier_kht",
    cashierName: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647 (\u0643\u0627\u0634\u064A\u0631 - \u0627\u0644\u062E\u0631\u0637\u0648\u0645)",
    openedAt: new Date(Date.now() - 4 * 60 * 60 * 1e3).toISOString(),
    openingCashSdg: 5e4,
    expectedCashSdg: 144500,
    status: "open",
    totalSalesSdg: 236e3,
    totalCashSalesSdg: 94500,
    totalBankakSalesSdg: 121500,
    totalCardSalesSdg: 2e4,
    salesCount: 6,
    refundsCount: 0,
    refundsTotalSdg: 0
  }
];
var INITIAL_SALES = [
  {
    id: "sale_demo_1",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    shiftId: "shift_kht_001",
    invoiceNumber: "INV-2026-00101",
    customerName: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0647\u0627\u0634\u0645 \u0645\u064A\u0631\u063A\u0646\u064A",
    customerPhone: "0912111222",
    items: [
      {
        productId: "prod_sugar_kenana",
        productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645",
        unit: "\u0643\u064A\u0633 10 \u0643\u062C\u0645",
        quantity: 2,
        unitPriceSdg: 31500,
        discountSdg: 0,
        totalSdg: 63e3,
        costPerUnitSdg: 26e3
      },
      {
        productId: "prod_cooking_oil",
        productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631",
        unit: "\u062C\u0631\u0643\u0646 4.5 \u0644\u062A\u0631",
        quantity: 1,
        unitPriceSdg: 23800,
        discountSdg: 0,
        totalSdg: 23800,
        costPerUnitSdg: 19500
      }
    ],
    subtotalSdg: 86800,
    discountTotalSdg: 0,
    taxTotalSdg: 0,
    grandTotalSdg: 86800,
    paymentMethod: "bankak",
    paymentReference: "BNK-TXN-8849201",
    status: "completed",
    cashierId: "emp_cashier_kht",
    cashierName: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647",
    isOfflineCreated: false,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "sale_demo_2",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    shiftId: "shift_kht_001",
    invoiceNumber: "INV-2026-00102",
    customerName: "\u0639\u0645\u064A\u0644 \u0646\u0642\u062F\u064A",
    items: [
      {
        productId: "prod_tea_ghazal",
        productName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0633\u064A\u0644\u0627\u0646\u064A \u0641\u0627\u062E\u0631 400 \u062C\u0645",
        unit: "\u0639\u0644\u0628\u0629 400 \u062C\u0645",
        quantity: 3,
        unitPriceSdg: 7200,
        discountSdg: 600,
        totalSdg: 21e3,
        costPerUnitSdg: 5800
      },
      {
        productId: "prod_sayga_flour",
        productName: "\u062F\u0642\u064A\u0642 \u0633\u064A\u0642\u0627 \u0645\u062E\u0635\u0648\u0635 \u0641\u0627\u062E\u0631 1 \u0643\u062C\u0645",
        unit: "\u0628\u0627\u0643\u062A 1 \u0643\u062C\u0645",
        quantity: 5,
        unitPriceSdg: 2650,
        discountSdg: 0,
        totalSdg: 13250,
        costPerUnitSdg: 2100
      }
    ],
    subtotalSdg: 34850,
    discountTotalSdg: 600,
    taxTotalSdg: 0,
    grandTotalSdg: 34250,
    paymentMethod: "cash",
    status: "completed",
    cashierId: "emp_cashier_kht",
    cashierName: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647",
    isOfflineCreated: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_CUSTOMERS = [
  {
    id: "cust_01",
    tenantId: "tenant_alrowad",
    name: "\u0645. \u0639\u0628\u062F \u0627\u0644\u0639\u0638\u064A\u0645 \u0627\u0644\u0641\u0627\u062A\u062D",
    phone: "0912389441",
    email: "abdelazim.f@gmail.com",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0631\u064A\u0627\u0636 - \u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u0634\u062A\u0644",
    loyaltyPoints: 340,
    totalPurchasesSdg: 485e3,
    invoicesCount: 6,
    notes: "\u0639\u0645\u064A\u0644 \u062F\u0627\u0626\u0645 - \u064A\u0641\u0636\u0644 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0627\u0644\u0633\u0631\u064A\u0639 \u0644\u0644\u0645\u0646\u0632\u0644",
    createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 2 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "cust_02",
    tenantId: "tenant_alrowad",
    name: "\u062F. \u0641\u0627\u0637\u0645\u0629 \u0639\u062B\u0645\u0627\u0646 \u0623\u062D\u0645\u062F",
    phone: "0911223344",
    email: "dr.fatima@hotmail.com",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0645\u0639\u0645\u0648\u0631\u0629 - \u0645\u0631\u0628\u0639 69",
    loyaltyPoints: 185,
    totalPurchasesSdg: 23e4,
    invoicesCount: 3,
    notes: "\u0637\u0628\u064A\u0628\u0629 \u0628\u0627\u0644\u0639\u064A\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u062C\u0645\u0639\u0629 - \u062A\u0633\u0648\u0642 \u062F\u0648\u0631\u064A \u0644\u0644\u0633\u0644\u0639 \u0627\u0644\u0645\u0646\u0632\u0644\u064A\u0629",
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 5 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "cust_03",
    tenantId: "tenant_alrowad",
    name: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0623\u0641\u0642 \u0644\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0627\u062A \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629",
    phone: "0123998877",
    email: "procurement@alofuq.sd",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0639\u0645\u0627\u0631\u0627\u062A - \u0634\u0627\u0631\u0639 15",
    taxNumber: "1008823194",
    loyaltyPoints: 850,
    totalPurchasesSdg: 125e4,
    invoicesCount: 12,
    notes: "\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0645\u0643\u062A\u0628\u064A\u0629 \u0648\u0645\u0648\u0627\u062F \u0636\u064A\u0627\u0641\u0629 \u0628\u0641\u0648\u0627\u062A\u064A\u0631 \u0636\u0631\u064A\u0628\u064A\u0629 \u0645\u0639\u062A\u0645\u062F\u0629 \u0644\u0644\u0634\u0631\u0643\u0629",
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 1 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "cust_04",
    tenantId: "tenant_alrowad",
    name: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0647\u0627\u0634\u0645 \u0645\u064A\u0631\u063A\u0646\u064A",
    phone: "0912111222",
    email: "hashem.m@yahoo.com",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0635\u062D\u0627\u0641\u0629 \u0634\u0631\u0642",
    loyaltyPoints: 120,
    totalPurchasesSdg: 165e3,
    invoicesCount: 2,
    notes: "\u0639\u0645\u064A\u0644 \u0623\u0633\u062A\u0627\u0630 \u062C\u0627\u0645\u0639\u064A",
    createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 3 * 3600 * 1e3).toISOString()
  },
  {
    id: "cust_05",
    tenantId: "tenant_nile_boutique",
    name: "\u0633\u0627\u0631\u0629 \u062E\u0627\u0644\u062F \u0627\u0644\u0628\u062F\u0648\u064A",
    phone: "0912556677",
    email: "sara.kh@gmail.com",
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    address: "\u062D\u064A \u0627\u0644\u0634\u0627\u0637\u0626",
    loyaltyPoints: 95,
    totalPurchasesSdg: 14e4,
    invoicesCount: 2,
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 4 * 24 * 3600 * 1e3).toISOString()
  }
];
var INITIAL_TRANSFERS = [
  {
    id: "trf_001",
    tenantId: "tenant_alrowad",
    transferNumber: "TRF-2026-001",
    sourceBranchId: "branch_kht_main",
    sourceBranchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    targetBranchId: "branch_madani",
    targetBranchName: "\u0641\u0631\u0639 \u0648\u062F \u0645\u062F\u0646\u064A",
    status: "received",
    items: [
      { productId: "prod_sugar_kenana", productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645", requestedQty: 10, dispatchedQty: 10, receivedQty: 10 },
      { productId: "prod_cooking_oil", productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631", requestedQty: 5, dispatchedQty: 5, receivedQty: 5 }
    ],
    notes: "\u062A\u0639\u0632\u064A\u0632 \u0645\u062E\u0632\u0648\u0646 \u0641\u0631\u0639 \u0648\u062F \u0645\u062F\u0646\u064A \u0644\u0645\u0648\u0627\u0643\u0628\u0629 \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064A",
    createdBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    dispatchedBy: "\u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0639\u0644\u064A",
    receivedBy: "\u0639\u0628\u062F \u0627\u0644\u0642\u0627\u062F\u0631 \u0645\u0648\u0633\u0649",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1e3).toISOString(),
    dispatchedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1e3).toISOString(),
    receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_EXPENSES = [
  {
    id: "exp_001",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    category: "\u0643\u0647\u0631\u0628\u0627\u0621 \u0648\u0645\u064A\u0627\u0647",
    amountSdg: 45e3,
    description: "\u0634\u0631\u0627\u0621 \u0643\u0631\u0648\u062A \u0643\u0647\u0631\u0628\u0627\u0621 \u062A\u062C\u0627\u0631\u064A\u0629 \u0644\u0644\u0645\u062D\u0644 \u0648\u0627\u0644\u0625\u0646\u0627\u0631\u0629 \u0648\u0627\u0644\u062B\u0644\u0627\u062C\u0627\u062A",
    paidBy: "\u0639\u062B\u0645\u0627\u0646 \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u064A\u0645",
    receiptNumber: "ELEC-2026-90",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "exp_002",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    category: "\u0646\u0642\u0644 \u0648\u062A\u0641\u0631\u064A\u063A",
    amountSdg: 3e4,
    description: "\u0639\u062A\u0627\u0644\u0629 \u0648\u062A\u0646\u0632\u064A\u0644 \u0634\u062D\u0646\u0629 \u0633\u0643\u0631 \u0648\u0632\u064A\u0648\u062A \u0645\u0646 \u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    paidBy: "\u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0639\u0644\u064A",
    receiptNumber: "LOG-771",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_RECURRING_EXPENSES = [
  {
    id: "recexp_01",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title: "\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0639\u0642\u0627\u0631 \u0648\u0627\u0644\u0645\u0642\u0631 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    category: "\u0625\u064A\u062C\u0627\u0631",
    amountSdg: 35e4,
    frequency: "monthly",
    dayOfMonth: 1,
    nextDueDate: new Date(Date.now() + 12 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    lastPostedDate: new Date(Date.now() - 18 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    autoPost: true,
    isActive: true,
    notes: "\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0644\u0645\u0627\u0644\u0643 \u0639\u0628\u0631 \u062A\u0637\u0628\u064A\u0642 \u0628\u0646\u0643\u0643 \u0623\u0648\u0644 \u0643\u0644 \u0634\u0647\u0631 \u0645\u064A\u0644\u0627\u062F\u064A",
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "recexp_02",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title: "\u0631\u0648\u0627\u062A\u0628 \u0645\u0648\u0638\u0641\u064A \u0648\u0639\u0645\u0627\u0644 \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0634\u0647\u0631\u064A",
    category: "\u0631\u0648\u0627\u062A\u0628",
    amountSdg: 85e4,
    frequency: "monthly",
    dayOfMonth: 28,
    nextDueDate: new Date(Date.now() + 10 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    lastPostedDate: new Date(Date.now() - 20 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    autoPost: true,
    isActive: true,
    notes: "\u0645\u0633\u064A\u0631 \u0627\u0644\u0631\u0648\u0627\u062A\u0628 \u0644\u0639\u062F\u062F 5 \u0645\u0648\u0638\u0641\u064A\u0646 \u0648\u0643\u0627\u0634\u064A\u0631 \u0648\u0639\u0645\u0627\u0644 \u0627\u0644\u0646\u0638\u0627\u0641\u0629",
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "recexp_03",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title: "\u0627\u0634\u062A\u0631\u0627\u0643 \u0641\u0627\u064A\u0628\u0631 \u0625\u0646\u062A\u0631\u0646\u062A \u0648\u0633\u064A\u0631\u0641\u0631 \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 (\u0643\u0627\u0646\u0627\u0631/\u0633\u0648\u062F\u0627\u0646\u064A)",
    category: "\u0625\u0646\u062A\u0631\u0646\u062A \u0648\u0627\u062A\u0635\u0627\u0644\u0627\u062A",
    amountSdg: 45e3,
    frequency: "monthly",
    dayOfMonth: 5,
    nextDueDate: new Date(Date.now() + 16 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    lastPostedDate: new Date(Date.now() - 14 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    autoPost: false,
    isActive: true,
    notes: "\u0627\u0634\u062A\u0631\u0627\u0643 \u0625\u0646\u062A\u0631\u0646\u062A \u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0639\u0631\u064A\u0636 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u062F\u0648\u062F \u0645\u0639 \u062E\u0637 \u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0634\u0631\u064A\u062D\u0629 4G",
    createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "recexp_04",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title: "\u0634\u062D\u0646 \u0643\u0631\u0648\u062A \u0643\u0647\u0631\u0628\u0627\u0621 \u062A\u062C\u0627\u0631\u064A 3 \u0641\u0627\u0632 \u0623\u0633\u0628\u0648\u0639\u064A",
    category: "\u0643\u0647\u0631\u0628\u0627\u0621 \u0648\u0645\u064A\u0627\u0647",
    amountSdg: 3e4,
    frequency: "weekly",
    dayOfWeek: 0,
    nextDueDate: new Date(Date.now() + 2 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    lastPostedDate: new Date(Date.now() - 5 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    autoPost: true,
    isActive: true,
    notes: "\u0634\u062D\u0646 \u0639\u062F\u0627\u062F \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u0645\u0633\u0628\u0642 \u0644\u0636\u0645\u0627\u0646 \u0639\u0645\u0644 \u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u062A\u0628\u0631\u064A\u062F \u0648\u0627\u0644\u062B\u0644\u0627\u062C\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u0645\u0631",
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1e3).toISOString()
  }
];
var INITIAL_PROMOTIONS = [
  {
    id: "promo_01",
    tenantId: "tenant_alrowad",
    title: "\u0639\u0631\u0636 \u0627\u0644\u0635\u0628\u0627\u062D: \u0627\u0634\u062A\u0631\u0650 2 \u0648\u0627\u062D\u0635\u0644 \u0639\u0644\u0649 1 \u0645\u062C\u0627\u0646\u0627\u064B",
    description: "\u0639\u0646\u062F \u0634\u0631\u0627\u0621 \u0642\u0637\u0639\u062A\u064A\u0646 \u0645\u0646 \u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0627\u0644\u0623\u0635\u0644\u064A \u0627\u062D\u0635\u0644 \u0639\u0644\u0649 \u0627\u0644\u062B\u0627\u0644\u062B\u0629 \u0645\u062C\u0627\u0646\u0627\u064B",
    type: "buy_x_get_y",
    buyProductId: "prod_tea_ghazalteen",
    buyProductName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0627\u0644\u0623\u0635\u0644\u064A 450 \u062C\u0645",
    buyQuantity: 2,
    freeProductId: "prod_tea_ghazalteen",
    freeProductName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0627\u0644\u0623\u0635\u0644\u064A 450 \u062C\u0645",
    freeQuantity: 1,
    isActive: true,
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "promo_02",
    tenantId: "tenant_alrowad",
    title: "\u062E\u0635\u0645 \u0627\u0644\u062C\u0645\u0644\u0629: 10% \u0639\u0646\u062F \u0634\u0631\u0627\u0621 \u0623\u0643\u062B\u0631 \u0645\u0646 5 \u0639\u0628\u0648\u0627\u062A",
    description: "\u062E\u0635\u0645 \u0641\u0648\u0631\u064A 10% \u0639\u0644\u0649 \u0643\u0644 \u0639\u0628\u0648\u0629 \u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0639\u0646\u062F \u0634\u0631\u0627\u0621 5 \u0642\u0637\u0639 \u0623\u0648 \u0623\u0643\u062B\u0631",
    type: "qty_discount_pct",
    productId: "prod_cooking_oil",
    productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631",
    minQuantity: 5,
    discountPct: 10,
    isActive: true,
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "promo_03",
    tenantId: "tenant_alrowad",
    title: "\u0645\u0643\u0627\u0641\u0623\u0629 \u0627\u0644\u0633\u0644\u0629 \u0627\u0644\u0643\u0628\u064A\u0631\u0629: \u062E\u0635\u0645 5,000 \u062C.\u0633 \u0639\u0646\u062F \u062A\u062C\u0627\u0648\u0632 100,000 \u062C.\u0633",
    description: "\u062E\u0635\u0645 \u0645\u0642\u0637\u0648\u0639 \u0648\u0645\u0628\u0627\u0634\u0631 5,000 \u062C\u0646\u064A\u0647 \u0633\u0648\u062F\u0627\u0646\u064A \u0639\u0644\u0649 \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0639\u0646\u062F \u0648\u0635\u0648\u0644 \u0627\u0644\u0633\u0644\u0629 \u0625\u0644\u0649 100,000 \u062C\u0646\u064A\u0647",
    type: "cart_fixed_discount",
    minCartTotalSdg: 1e5,
    discountAmountSdg: 5e3,
    isActive: true,
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1e3).toISOString()
  }
];
var INITIAL_KITCHEN_TICKETS = [
  {
    id: "kds_01",
    saleId: "sale_demo_01",
    invoiceNumber: "INV-2026-0001",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    customerName: "\u0645. \u0639\u0628\u062F \u0627\u0644\u0639\u0638\u064A\u0645 \u0627\u0644\u0641\u0627\u062A\u062D",
    orderType: "quick_order",
    status: "preparing",
    items: [
      {
        id: "kds_item_1",
        productId: "prod_sugar_kenana",
        productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645",
        quantity: 2,
        unit: "\u0643\u064A\u0633 10 \u0643\u062C\u0645",
        notes: "\u0637\u0644\u0628 \u0633\u0631\u064A\u0639 - \u062A\u062C\u0647\u064A\u0632 \u0644\u0644\u062A\u0633\u0644\u064A\u0645 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0628\u0627\u0644\u0633\u064A\u0627\u0631\u0629",
        status: "ready"
      },
      {
        id: "kds_item_2",
        productId: "prod_tea_ghazalteen",
        productName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0627\u0644\u0623\u0635\u0644\u064A 450 \u062C\u0645",
        quantity: 3,
        unit: "\u0628\u0627\u0643\u062A",
        notes: "\u0639\u0631\u0636 \u0627\u0634\u062A\u0631 2 \u0648\u0627\u062D\u0635\u0644 \u0639\u0644\u0649 1 \u0645\u062C\u0627\u0646\u0627\u064B - \u062A\u063A\u0644\u064A\u0641 \u0647\u062F\u064A\u0629",
        status: "preparing"
      }
    ],
    createdAt: new Date(Date.now() - 14 * 60 * 1e3).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 1e3).toISOString()
  },
  {
    id: "kds_02",
    saleId: "sale_demo_02",
    invoiceNumber: "INV-2026-0002",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    customerName: "\u062F. \u0645\u0646\u0649 \u0627\u0644\u0637\u0627\u0647\u0631",
    orderType: "takeaway",
    status: "pending",
    items: [
      {
        id: "kds_item_3",
        productId: "prod_cooking_oil",
        productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631",
        quantity: 1,
        unit: "\u062C\u0631\u0643\u0627\u0646\u0629",
        notes: "\u0637\u0644\u0628 \u0633\u0631\u064A\u0639 - \u0628\u062F\u0648\u0646 \u0634\u0637\u0629 \u0633\u0641\u0631\u064A / \u0648\u0636\u0639 \u0641\u064A \u0643\u064A\u0633 \u0645\u0632\u062F\u0648\u062C \u0645\u0642\u0648\u0649",
        status: "pending"
      }
    ],
    createdAt: new Date(Date.now() - 4 * 60 * 1e3).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 1e3).toISOString()
  }
];
var INITIAL_PURCHASES = [
  {
    id: "purch_001",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    supplierName: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0633\u0643\u0631 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A\u0629 \u0627\u0644\u0645\u062D\u062F\u0648\u062F\u0629",
    invoiceNumber: "SUP-SUG-8821",
    currency: "SDG",
    exchangeRate: 1,
    items: [
      {
        productId: "prod_sugar_kenana",
        productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645",
        quantity: 100,
        costInCurrency: 26e3,
        currency: "SDG",
        exchangeRate: 1,
        costSdg: 26e5
      }
    ],
    totalCostSdg: 26e5,
    paymentStatus: "paid",
    notes: "\u0634\u0631\u0627\u0621 \u062F\u0641\u0639\u0629 \u0634\u0647\u0631\u064A\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u0645\u0646 \u0627\u0644\u0645\u0648\u0631\u062F",
    createdBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "purch_002",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    supplierName: "\u0645\u0624\u0633\u0633\u0629 \u0627\u0644\u0634\u0627\u064A \u0627\u0644\u0639\u0627\u0644\u0645\u064A\u0629 (\u062F\u0628\u064A)",
    invoiceNumber: "IMP-TEA-2026",
    currency: "AED",
    exchangeRate: 748.5,
    items: [
      {
        productId: "prod_tea_ghazal",
        productName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0633\u064A\u0644\u0627\u0646\u064A \u0641\u0627\u062E\u0631 400 \u062C\u0645",
        quantity: 100,
        costInCurrency: 7.75,
        // 7.75 AED * 748.5 = ~5800 SDG
        currency: "AED",
        exchangeRate: 748.5,
        costSdg: 580087.5
      }
    ],
    totalCostSdg: 580087.5,
    paymentStatus: "paid",
    notes: "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0628\u0627\u0644\u062F\u0631\u0647\u0645 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A\u064A \u0645\u0639 \u0642\u064A\u062F \u0633\u0639\u0631 \u0627\u0644\u0635\u0631\u0641 \u0627\u0644\u062A\u0627\u0631\u064A\u062E\u064A \u0627\u0644\u0641\u0639\u0644\u064A",
    createdBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_STORE_ORDERS = [
  {
    id: "ord_101",
    tenantId: "tenant_alrowad",
    orderNumber: "ORD-2026-901",
    customerName: "\u0641\u0627\u0637\u0645\u0629 \u0639\u0628\u062F \u0627\u0644\u0645\u0646\u0639\u0645",
    customerPhone: "0912445566",
    deliveryMethod: "delivery",
    deliveryAddress: "\u062D\u064A \u0627\u0644\u0635\u0641\u0627\u060C \u0627\u0644\u062E\u0631\u0637\u0648\u0645 - \u0642\u0631\u0628 \u0645\u0633\u062C\u062F \u0627\u0644\u0646\u0648\u0631",
    items: [
      { productId: "prod_cooking_oil", productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631", quantity: 1, unitPriceSdg: 23800, totalSdg: 23800 },
      { productId: "prod_sugar_kenana", productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645", quantity: 1, unitPriceSdg: 31500, totalSdg: 31500 }
    ],
    totalSdg: 55300,
    status: "new",
    paymentStatus: "paid_bankak",
    bankakRef: "BNK-APP-998231",
    notes: "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0642\u0628\u0644 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0644\u062A\u0633\u0644\u064A\u0645",
    createdAt: new Date(Date.now() - 40 * 60 * 1e3).toISOString()
  }
];
var INITIAL_PAYMENTS = [
  {
    id: "pay_sub_01",
    tenantId: "tenant_alrowad",
    planId: "plan_growth",
    amountSdg: 18e4,
    paymentMethod: "bankak",
    paymentRef: "BNK-TXN-1099238",
    bankTransferSlipUrl: "/assets/images/sanad_pos_hero_1792173270140.jpg",
    status: "approved",
    submittedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1e3).toISOString(),
    reviewedBy: "\u0625\u062F\u0627\u0631\u0629 \u0645\u0646\u0635\u0629 \u0633\u0646\u062F \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629",
    reviewNote: "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0645\u0637\u0627\u0628\u0642\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0648\u0627\u0644\u0625\u064A\u062F\u0627\u0639 \u0648\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0644\u0645\u062F\u0629 \u0634\u0647\u0631 \u0625\u0636\u0627\u0641\u064A",
    reviewedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "pay_sub_02",
    tenantId: "tenant_nile_boutique",
    planId: "plan_starter",
    amountSdg: 75e3,
    paymentMethod: "bankak",
    paymentRef: "BNK-TXN-2049182",
    status: "pending_review",
    submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_AUDIT_LOGS = [
  {
    id: "aud_1",
    tenantId: "tenant_alrowad",
    actorId: "emp_owner_rowad",
    actorName: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    action: "DISPATCH_TRANSFER",
    entity: "BranchTransfer",
    entityId: "trf_001",
    details: "\u0625\u0631\u0633\u0627\u0644 \u0634\u062D\u0646\u0629 \u0628\u0636\u0627\u0639\u0629 \u0645\u0646 \u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0625\u0644\u0649 \u0641\u0631\u0639 \u0648\u062F \u0645\u062F\u0646\u064A \u0628\u0639\u062F \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629",
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "aud_2",
    tenantId: "tenant_alrowad",
    actorId: "emp_cashier_kht",
    actorName: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647",
    action: "OPEN_SHIFT",
    entity: "CashierShift",
    entityId: "shift_kht_001",
    details: "\u0627\u0641\u062A\u062A\u0627\u062D \u0648\u0631\u062F\u064A\u0629 \u0627\u0644\u0635\u0628\u0627\u062D \u0628\u0631\u0635\u064A\u062F \u0646\u0642\u062F\u064A \u0623\u0648\u0644\u064A \u0642\u062F\u0631\u0647 50,000 \u062C.\u0633",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_ALBANDAR_SHOWROOMS = [
  {
    id: "shw_albandar_motors",
    name: "\u0645\u0639\u0631\u0636 \u0627\u0644\u0628\u0646\u062F\u0631 \u0627\u0644\u062F\u0648\u0644\u064A \u0644\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0645\u0639\u062F\u0627\u062A",
    tradeName: "\u0627\u0644\u0628\u0646\u062F\u0631 \u0645\u0648\u062A\u0648\u0631\u0632 - \u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    category: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    address: "\u0634\u0627\u0631\u0639 \u062F\u064A\u0645 \u0633\u0648\u0627\u0643\u0646 - \u0628\u062C\u0648\u0627\u0631 \u0627\u0644\u0645\u064A\u0646\u0627\u0621 \u0627\u0644\u062C\u0646\u0648\u0628\u064A",
    phone: "+249912300456",
    whatsapp: "+249912300456",
    logo: "/assets/images/albander_hyundai_car_1792184093653.jpg",
    bannerImage: "/assets/images/albander_pickup_truck_1792184123630.jpg",
    verified: true,
    rating: 4.9,
    listingsCount: 28,
    bio: "\u0645\u0639\u0631\u0636 \u0645\u0639\u062A\u0645\u062F \u0644\u0628\u064A\u0639 \u0648\u0634\u0631\u0627\u0621 \u0643\u0627\u0641\u0629 \u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A\u060C \u0627\u0644\u0628\u0643\u0627\u0633\u064A\u060C \u0627\u0644\u0631\u0643\u0634\u0627\u062A \u0648\u0627\u0644\u0634\u0627\u062D\u0646\u0627\u062A \u0648\u0627\u0631\u062F \u0627\u0644\u062E\u0644\u064A\u062C \u0648\u0627\u0644\u0648\u0643\u064A\u0644.",
    bankakAccount: "2847591"
  },
  {
    id: "shw_alrowad",
    name: "\u0645\u0624\u0633\u0633\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629 \u0648\u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F",
    tradeName: "\u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u064A\u0629 \u0648\u0627\u0644\u062C\u0645\u0644\u0629",
    category: "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    city: "\u0639\u0637\u0628\u0631\u0629",
    address: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0643\u0628\u064A\u0631 - \u0645\u062C\u0645\u0639 \u0627\u0644\u0631\u0648\u0627\u062F \u0627\u0644\u062A\u062C\u0627\u0631\u064A",
    phone: "+249912345678",
    whatsapp: "+249912345678",
    logo: "/assets/images/product_sugar_kenana_1792173270044.jpg",
    bannerImage: "/assets/images/sanad_pos_hero_1792173270140.jpg",
    verified: true,
    rating: 4.8,
    listingsCount: 45,
    bio: "\u0648\u0643\u0644\u0627\u0621 \u0643\u0628\u0631\u0649 \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0627\u0644\u063A\u0630\u0627\u0626\u064A\u0629 (\u0643\u0646\u0627\u0646\u0629\u060C \u0635\u0628\u0627\u062D\u060C \u0633\u064A\u0642\u0627\u060C \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646) - \u0628\u064A\u0639 \u062C\u0645\u0644\u0629 \u0648\u062A\u062C\u0632\u0626\u0629 \u0644\u0643\u0627\u0641\u0629 \u0648\u0644\u0627\u064A\u0627\u062A \u0627\u0644\u0633\u0648\u062F\u0627\u0646.",
    bankakAccount: "1982736",
    tenantSlug: "alrowad-co"
  },
  {
    id: "shw_neelain_tech",
    name: "\u0645\u0631\u0643\u0632 \u0627\u0644\u0646\u064A\u0644\u064A\u0646 \u0644\u0644\u062A\u0642\u0646\u064A\u0629 \u0648\u0627\u0644\u0637\u0627\u0642\u0629 \u0627\u0644\u0634\u0645\u0633\u064A\u0629",
    tradeName: "\u0627\u0644\u0646\u064A\u0644\u064A\u0646 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u0643\u0633",
    category: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    city: "\u0643\u0633\u0644\u0627",
    address: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0634\u0639\u0628\u064A - \u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u062F\u0627\u0631\u0633",
    phone: "+249900112233",
    whatsapp: "+249900112233",
    logo: "/assets/images/albander_macbook_laptop_1792184108039.jpg",
    bannerImage: "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80",
    verified: true,
    rating: 4.9,
    listingsCount: 34,
    bio: "\u0623\u062D\u062F\u062B \u0627\u0644\u0647\u0648\u0627\u062A\u0641 \u0627\u0644\u0630\u0643\u064A\u0629\u060C \u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0643\u0645\u0628\u064A\u0648\u062A\u0631\u060C \u0648\u0645\u0646\u0638\u0648\u0645\u0627\u062A \u0627\u0644\u0637\u0627\u0642\u0629 \u0627\u0644\u0634\u0645\u0633\u064A\u0629 \u0627\u0644\u0647\u062C\u064A\u0646\u0629 \u0648\u0627\u0644\u0628\u0637\u0627\u0631\u064A\u0627\u062A \u0639\u0627\u0644\u064A\u0629 \u0627\u0644\u0643\u0641\u0627\u0621\u0629.",
    bankakAccount: "3109482"
  },
  {
    id: "shw_gedaref_crops",
    name: "\u0648\u0643\u0627\u0644\u0629 \u0627\u0644\u0642\u0636\u0627\u0631\u0641 \u0644\u0644\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u0627\u0644\u062B\u0631\u0648\u0629 \u0627\u0644\u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    tradeName: "\u0628\u0648\u0631\u0635\u0629 \u0645\u062D\u0627\u0635\u064A\u0644 \u0627\u0644\u0641\u0634\u0642\u0629",
    category: "\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u062B\u0631\u0648\u0629 \u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    city: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    address: "\u0628\u0648\u0631\u0635\u0629 \u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u0645\u062D\u0627\u0635\u064A\u0644 - \u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    phone: "+249915556677",
    whatsapp: "+249915556677",
    logo: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80",
    bannerImage: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80",
    verified: true,
    rating: 4.7,
    listingsCount: 19,
    bio: "\u062A\u0648\u0631\u064A\u062F \u0648\u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0633\u0645\u0633\u0645 \u0627\u0644\u0623\u0628\u064A\u0636 \u0648\u0627\u0644\u0623\u062D\u0645\u0631\u060C \u0627\u0644\u0635\u0645\u063A \u0627\u0644\u0639\u0631\u0628\u064A\u060C \u0627\u0644\u0641\u0648\u0644 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A \u0648\u0627\u0644\u0645\u0648\u0627\u0634\u064A \u0627\u0644\u062D\u064A\u0629 \u0628\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0628\u0648\u0631\u0635\u0629.",
    bankakAccount: "4452109"
  }
];
var INITIAL_ALBANDAR_LISTINGS = [
  {
    id: "alb_car_01",
    title: "\u0647\u064A\u0648\u0646\u062F\u0627\u064A \u0623\u0641\u0627\u0646\u062A\u064A HD \u0645\u0648\u062F\u064A\u0644 2018 \u062E\u0627\u0644\u064A\u0629 \u0645\u0646 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0648\u0627\u0631\u062F \u0627\u0644\u062E\u0644\u064A\u062C",
    description: "\u0639\u0631\u0628\u064A\u0629 \u0634\u0627\u0630\u0629 \u0648\u0643\u0631\u062A\u060C \u062A\u0631\u062E\u064A\u0635 \u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 \u062C\u0645\u0631\u0643 \u0643\u0627\u0645\u0644\u060C \u0645\u0643\u064A\u0641 \u062B\u0644\u0627\u062C\u0629\u060C \u0642\u064A\u0631 \u0623\u0648\u062A\u0648\u0645\u0627\u062A\u064A\u0643\u060C \u0634\u0627\u0634\u0629 \u0648\u0643\u0627\u0645\u064A\u0631\u0627\u060C \u0643\u0641\u0631\u0627\u062A \u062C\u062F\u064A\u062F\u0629 \u0645\u0639 \u0628\u0637\u0627\u0631\u064A\u0629 \u0632\u064A\u0631\u0648\u060C \u0627\u0644\u0633\u0639\u0631 \u0642\u0627\u0628\u0644 \u0644\u0644\u062A\u0641\u0627\u0648\u0636 \u0627\u0644\u0628\u0633\u064A\u0637 \u0628\u0639\u062F \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629.",
    category: "cars",
    categoryNameAr: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    priceSdg: 185e5,
    priceUsd: 6850,
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
    condition: "\u0645\u0633\u062A\u0639\u0645\u0644 \u0628\u062D\u0627\u0644\u0629 \u0645\u0645\u062A\u0627\u0632\u0629",
    imageUrl: "/assets/images/albander_hyundai_car_1792184093653.jpg",
    sellerName: "\u0645\u0639\u0631\u0636 \u0627\u0644\u0628\u0646\u062F\u0631 \u0644\u0644\u0633\u064A\u0627\u0631\u0627\u062A",
    sellerType: "showroom",
    sellerPhone: "+249912300456",
    sellerWhatsapp: "+249912300456",
    isVerifiedMerchant: true,
    viewsCount: 1420,
    featured: true,
    createdAt: new Date(Date.now() - 3 * 3600 * 1e3).toISOString(),
    locationDetails: "\u062D\u064A \u0627\u0644\u0645\u0637\u0627\u0631 - \u0634\u0627\u0631\u0639 \u062F\u064A\u0645 \u0633\u0648\u0627\u0643\u0646 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    bankakAccount: "2847591"
  },
  {
    id: "alb_car_02",
    title: "\u062A\u0648\u064A\u0648\u062A\u0627 \u0647\u0627\u064A\u0644\u0648\u0643\u0633 \u062F\u0628\u0644 \u0643\u0627\u0628\u064A\u0646\u0629 \u0645\u0648\u062F\u064A\u0644 2022 GLX \u062F\u064A\u0632\u0644 \u0623\u0635\u0644\u064A\u0629",
    description: "\u0628\u0648\u0643\u0633 \u062F\u0628\u0644 \u0643\u0627\u0628 \u0645\u0627 \u0634\u0627\u0621 \u0627\u0644\u0644\u0647 \u0635\u0644\u0627\u0629 \u0627\u0644\u0646\u0628\u064A\u060C \u062F\u0641\u0639 \u0631\u0628\u0627\u0639\u064A 4x4\u060C \u0645\u0643\u0646\u0629 \u0643\u0628\u064A\u0631\u0629 \u062F\u064A\u0632\u0644 \u062A\u064A\u0631\u0628\u0648\u060C \u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0648\u0642\u0648\u062F \u0645\u0645\u062A\u0627\u0632\u060C \u0645\u0641\u062D\u0648\u0635\u0629 \u0648\u0645\u062C\u0645\u0631\u0643\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0641\u064A \u0627\u0644\u0642\u0636\u0627\u0631\u0641 \u062C\u0627\u0647\u0632\u0629 \u0644\u0644\u062A\u062D\u0648\u064A\u0644.",
    category: "cars",
    categoryNameAr: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    priceSdg: 52e6,
    priceUsd: 19250,
    city: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    state: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    condition: "\u0648\u0627\u0631\u062F \u062F\u0628\u064A",
    imageUrl: "/assets/images/albander_pickup_truck_1792184123630.jpg",
    sellerName: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0642\u0636\u0627\u0631\u0641 \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0627\u0644\u0622\u0644\u064A\u0627\u062A",
    sellerType: "merchant",
    sellerPhone: "+249123456789",
    sellerWhatsapp: "+249123456789",
    isVerifiedMerchant: true,
    viewsCount: 980,
    featured: true,
    createdAt: new Date(Date.now() - 7 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0635\u0646\u0627\u0639\u064A\u0629 - \u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    bankakAccount: "1982736"
  },
  {
    id: "alb_elec_01",
    title: "\u0623\u0628\u0644 \u0645\u0627\u0643 \u0628\u0648\u0643 \u0628\u0631\u0648 M3 Pro \u0633\u0639\u0629 512 \u062C\u064A\u062C\u0627\u0628\u0627\u064A\u062A \u0643\u0631\u062A\u0648\u0646\u0629 \u0632\u064A\u0631\u0648",
    description: "Apple MacBook Pro M3 Pro Chip, 18GB Unified Memory, 512GB SSD, Retina XDR Display. \u062C\u0647\u0627\u0632 \u062C\u062F\u064A\u062F \u0644\u0645 \u064A\u064F\u0641\u062A\u062D \u0648\u0627\u0631\u062F \u0627\u0644\u0648\u0643\u064A\u0644\u060C \u0636\u0645\u0627\u0646 \u0633\u0646\u0629 \u0643\u0627\u0645\u0644\u0629\u060C \u0628\u0637\u0627\u0631\u064A\u0629 \u062A\u062F\u0648\u0645 \u062D\u062A\u0649 22 \u0633\u0627\u0639\u0629.",
    category: "electronics",
    categoryNameAr: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    priceSdg: 42e5,
    priceUsd: 1550,
    city: "\u0639\u0637\u0628\u0631\u0629",
    state: "\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644",
    condition: "\u062C\u062F\u064A\u062F \u0628\u0627\u0644\u0643\u0631\u062A\u0648\u0646\u0629",
    imageUrl: "/assets/images/albander_macbook_laptop_1792184108039.jpg",
    sellerName: "\u0645\u062A\u062C\u0631 \u0627\u0644\u0646\u064A\u0644\u064A\u0646 \u0644\u0644\u062A\u0642\u0646\u064A\u0629 \u0648\u0627\u0644\u0623\u062C\u0647\u0632\u0629",
    sellerType: "showroom",
    sellerPhone: "+249900112233",
    sellerWhatsapp: "+249900112233",
    isVerifiedMerchant: true,
    viewsCount: 760,
    featured: true,
    createdAt: new Date(Date.now() - 12 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0643\u0628\u064A\u0631 - \u0639\u0645\u0627\u0631\u0629 \u0627\u0644\u0633\u0644\u0627\u0645",
    bankakAccount: "3109482"
  },
  {
    id: "alb_prop_01",
    title: "\u0634\u0642\u0629 \u0645\u0641\u0631\u0648\u0634\u0629 \u0631\u0627\u0642\u064A\u0629 VIP \u0644\u0644\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0634\u0647\u0631\u064A \u0648\u0627\u0644\u064A\u0648\u0645\u064A \u062D\u064A \u0627\u0644\u0645\u0637\u0627\u0631",
    description: "\u0634\u0642\u0629 \u0633\u0648\u0628\u0631 \u062F\u064A\u0644\u0648\u0643\u0633 3 \u063A\u0631\u0641 \u0648\u0635\u0627\u0644\u0629 \u0648\u0647\u0648\u0644 \u0643\u0628\u064A\u0631\u060C 2 \u062D\u0645\u0627\u0645\u060C \u0645\u0637\u0628\u062E \u0645\u062C\u0647\u0632 \u0628\u0643\u0627\u0641\u0629 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064A\u0629\u060C \u0645\u0643\u064A\u0641\u0627\u062A \u0633\u0628\u0644\u064A\u062A \u0641\u064A \u0643\u0644 \u0627\u0644\u063A\u0631\u0641\u060C \u0645\u0648\u0644\u062F \u0643\u0647\u0631\u0628\u0627\u0626\u064A \u0623\u0648\u062A\u0648\u0645\u0627\u062A\u064A\u0643\u064A \u0648\u0645\u064A\u0627\u0647 \u0645\u062A\u0648\u0641\u0631\u0629 24 \u0633\u0627\u0639\u0629\u060C \u062D\u0631\u0627\u0633\u0629 \u0648\u0645\u0635\u0639\u062F.",
    category: "real_estate",
    categoryNameAr: "\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0623\u0631\u0627\u0636\u064A",
    priceSdg: 95e4,
    priceUsd: 350,
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
    condition: "\u0645\u0641\u0631\u0648\u0634\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644",
    imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0627\u0644\u062F\u0627\u0631 \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0639\u0642\u0627\u0631\u064A\u0629",
    sellerType: "merchant",
    sellerPhone: "+249911223344",
    sellerWhatsapp: "+249911223344",
    isVerifiedMerchant: true,
    viewsCount: 2310,
    featured: true,
    createdAt: new Date(Date.now() - 15 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 - \u062D\u064A \u0627\u0644\u0645\u0637\u0627\u0631 \u062C\u0648\u0627\u0631 \u0635\u0627\u0644\u0629 \u0643\u0628\u0627\u0631 \u0627\u0644\u0632\u0648\u0627\u0631"
  },
  {
    id: "alb_crops_01",
    title: "\u0633\u0645\u0633\u0645 \u0627\u0644\u0642\u0636\u0627\u0631\u0641 \u0627\u0644\u0623\u0628\u064A\u0636 \u062F\u0631\u062C\u0629 \u0623\u0648\u0644\u0649 \u0644\u0644\u062A\u0635\u062F\u064A\u0631 (\u062C\u0648\u0627\u0644 100 \u0643\u062C\u0645)",
    description: "\u0633\u0645\u0633\u0645 \u0623\u0628\u064A\u0636 \u0646\u062E\u0628 \u0623\u0648\u0644 \u063A\u0631\u0628\u0644\u0629 \u0648\u062A\u0639\u0628\u0626\u0629 \u062D\u062F\u064A\u062B\u0629\u060C \u0645\u0648\u0627\u0635\u0641\u0627\u062A \u0642\u064A\u0627\u0633\u064A\u0629 \u0644\u0644\u062A\u0635\u062F\u064A\u0631 \u0648\u0627\u0644\u0645\u0639\u0627\u0635\u0631\u060C \u062E\u0627\u0644\u064A \u0645\u0646 \u0627\u0644\u0634\u0648\u0627\u0626\u0628 \u0628\u0646\u0633\u0628\u0629 99.5%\u060C \u0645\u062A\u0648\u0641\u0631 \u0643\u0645\u064A\u0627\u062A \u0643\u0628\u064A\u0631\u0629 \u0645\u0646 \u0627\u0644\u0645\u062E\u0632\u0646 \u0645\u0628\u0627\u0634\u0631\u0629 \u0644\u0644\u062A\u0633\u0644\u064A\u0645.",
    category: "livestock_crops",
    categoryNameAr: "\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u062B\u0631\u0648\u0629 \u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    priceSdg: 185e3,
    priceUsd: 68,
    city: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    state: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    condition: "\u0625\u0646\u062A\u0627\u062C \u0645\u062D\u0644\u064A \u0646\u062E\u0628 \u0623\u0648\u0644",
    imageUrl: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0648\u0643\u0627\u0644\u0629 \u0645\u062D\u0627\u0635\u064A\u0644 \u0627\u0644\u0641\u0634\u0642\u0629",
    sellerType: "merchant",
    sellerPhone: "+249915556677",
    sellerWhatsapp: "+249915556677",
    isVerifiedMerchant: true,
    viewsCount: 890,
    featured: false,
    createdAt: new Date(Date.now() - 24 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0645\u062E\u0627\u0632\u0646 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0635\u0646\u0627\u0639\u064A\u0629 \u0628\u0627\u0644\u0642\u0636\u0627\u0631\u0641"
  },
  {
    id: "alb_groc_01",
    title: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 \u0639\u0628\u0648\u0629 10 \u0643\u062C\u0645 \u064850 \u0643\u062C\u0645 \u062C\u0645\u0644\u0629 \u0644\u0644\u0645\u062A\u0627\u062C\u0631",
    description: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0623\u0628\u064A\u0636 \u0628\u0644\u0648\u0631\u0627\u062A \u0641\u0627\u062E\u0631\u0629\u060C \u0627\u0644\u0643\u0645\u064A\u0627\u062A \u0645\u062A\u0648\u0641\u0631\u0629 \u0641\u064A \u0643\u0627\u0641\u0629 \u0641\u0631\u0648\u0639\u0646\u0627 \u0645\u0639 \u0625\u0645\u0643\u0627\u0646\u064A\u0629 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0648\u0627\u0644\u0634\u062D\u0646 \u0644\u0643\u0627\u0641\u0629 \u0645\u062F\u0646 \u0648\u0644\u0627\u064A\u0629 \u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631 \u0648\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644\u060C \u062F\u0641\u0639 \u0639\u0628\u0631 \u0628\u0646\u0643\u0643 \u0645\u0628\u0627\u0634\u0631\u0629.",
    category: "groceries",
    categoryNameAr: "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    priceSdg: 31500,
    priceUsd: 12,
    city: "\u0639\u0637\u0628\u0631\u0629",
    state: "\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644",
    condition: "\u062C\u062F\u064A\u062F \u0625\u0646\u062A\u0627\u062C \u0643\u0646\u0627\u0646\u0629",
    imageUrl: "/assets/images/product_sugar_kenana_1792173270044.jpg",
    sellerName: "\u0645\u0624\u0633\u0633\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629 (\u0627\u0644\u0645\u062A\u062C\u0631 \u0627\u0644\u0645\u0639\u062A\u0645\u062F)",
    sellerType: "merchant",
    sellerPhone: "+249912345678",
    sellerWhatsapp: "+249912345678",
    isVerifiedMerchant: true,
    viewsCount: 3120,
    featured: true,
    createdAt: new Date(Date.now() - 8 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0633\u0648\u0642 \u0639\u0637\u0628\u0631\u0629 \u0627\u0644\u0643\u0628\u064A\u0631 - \u0645\u062C\u0645\u0639 \u0627\u0644\u0631\u0648\u0627\u062F",
    bankakAccount: "1982736"
  },
  {
    id: "alb_elec_02",
    title: "\u0633\u0627\u0645\u0633\u0648\u0646\u062C \u062C\u0627\u0644\u0643\u0633\u064A S24 \u0623\u0644\u062A\u0631\u0627 512 \u062C\u064A\u062C\u0627\u0628\u0627\u064A\u062A \u062A\u064A\u062A\u0627\u0646\u064A\u0648\u0645 \u0643\u0631\u062A\u0648\u0646\u0629",
    description: "Samsung Galaxy S24 Ultra 512GB Titanium Grey, \u0634\u0631\u064A\u062D\u062A\u064A\u0646 Nano-SIM + eSIM\u060C \u0642\u0644\u0645 S-Pen \u0645\u062F\u0645\u062C\u060C \u064A\u062F\u0639\u0645 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A Galaxy AI \u0628\u0627\u0644\u0643\u0627\u0645\u0644\u060C \u0645\u0644\u062D\u0642\u0627\u062A \u0623\u0635\u0644\u064A\u0629 \u0643\u0627\u0645\u0644\u0629.",
    category: "electronics",
    categoryNameAr: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    priceSdg: 295e4,
    priceUsd: 1090,
    city: "\u0643\u0633\u0644\u0627",
    state: "\u0643\u0633\u0644\u0627",
    condition: "\u062C\u062F\u064A\u062F \u0643\u0631\u062A\u0648\u0646\u0629",
    imageUrl: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0627\u0644\u0628\u0631\u0646\u0633 \u0644\u0644\u0645\u0648\u0628\u0627\u064A\u0644 \u0648\u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    sellerType: "individual",
    sellerPhone: "+249918765432",
    sellerWhatsapp: "+249918765432",
    isVerifiedMerchant: false,
    viewsCount: 1140,
    featured: false,
    createdAt: new Date(Date.now() - 18 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0643\u0633\u0644\u0627 - \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0634\u0639\u0628\u064A"
  },
  {
    id: "alb_prop_02",
    title: "\u0645\u0646\u0632\u0644 \u0644\u0648\u062F\u0628\u064A\u0631\u0646\u0642 \u0645\u0633\u0644\u062D \u062A\u0634\u0637\u064A\u0628 \u0633\u0648\u0628\u0631 \u062F\u064A\u0644\u0648\u0643\u0633 \u062D\u064A \u0627\u0644\u0646\u0647\u0636\u0629",
    description: "\u0645\u0633\u0627\u062D\u0629 400 \u0645\u062A\u0631 \u0645\u0631\u0628\u0639\u060C \u0645\u0628\u0646\u064A \u0644\u0648\u062F\u0628\u064A\u0631\u0646\u0642 \u064A\u0631\u0643\u0628 \u0637\u0627\u0628\u0642\u064A\u0646 \u0625\u0636\u0627\u0641\u064A\u0629\u060C 4 \u063A\u0631\u0641\u060C \u0635\u0627\u0644\u0648\u0646 \u0643\u0628\u064A\u0631\u060C 3 \u062D\u0645\u0627\u0645\u0627\u062A\u060C \u062D\u0648\u0634 \u0648\u0627\u0633\u0639 \u0633\u064A\u0631\u0627\u0645\u064A\u0643\u060C \u062C\u0627\u0647\u0632 \u0644\u0644\u0633\u0643\u0646 \u0627\u0644\u0641\u0648\u0631\u064A\u060C \u0634\u0647\u0627\u062F\u0629 \u0628\u062D\u062B \u0645\u0644\u0643 \u062D\u0631.",
    category: "real_estate",
    categoryNameAr: "\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0623\u0631\u0627\u0636\u064A",
    priceSdg: 48e6,
    priceUsd: 17800,
    city: "\u0639\u0637\u0628\u0631\u0629",
    state: "\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644",
    condition: "\u062C\u062F\u064A\u062F",
    imageUrl: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0645\u0643\u062A\u0628 \u0627\u0644\u0648\u0641\u0627\u0642 \u0627\u0644\u0639\u0642\u0627\u0631\u064A",
    sellerType: "merchant",
    sellerPhone: "+249922334455",
    sellerWhatsapp: "+249922334455",
    isVerifiedMerchant: true,
    viewsCount: 1890,
    featured: false,
    createdAt: new Date(Date.now() - 36 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0639\u0637\u0628\u0631\u0629 - \u062D\u064A \u0627\u0644\u0646\u0647\u0636\u0629 \u0645\u0631\u0628\u0639 4"
  },
  {
    id: "alb_fash_01",
    title: "\u062B\u064A\u0627\u0628 \u0633\u0648\u062F\u0627\u0646\u064A\u0629 \u062A\u0648\u062A\u0627\u0644 \u0633\u0648\u064A\u0633\u0631\u064A \u062D\u0631\u064A\u0631 \u0643\u0631\u064A\u0628 \u0645\u0639 \u062A\u0637\u0631\u064A\u0632 \u0634\u0643 \u064A\u062F\u0648\u064A",
    description: "\u0623\u0631\u0642\u0649 \u062A\u0634\u0643\u064A\u0644\u0629 \u062B\u064A\u0627\u0628 \u0645\u0646\u0627\u0633\u0628\u0627\u062A \u0648\u0623\u0639\u0631\u0627\u0633\u060C \u0642\u0645\u0627\u0634 \u062A\u0648\u062A\u0627\u0644 \u0633\u0648\u064A\u0633\u0631\u064A \u0623\u0635\u0644\u064A \u0628\u0627\u0631\u062F \u0648\u062B\u0627\u0628\u062A\u060C \u062A\u0637\u0631\u064A\u0632 \u062D\u0631\u064A\u0631 \u0648\u0634\u0643 \u062E\u0631\u0632 \u064A\u062F\u0648\u064A \u0641\u0627\u062E\u0631\u060C \u0623\u0644\u0648\u0627\u0646 \u0632\u0627\u0647\u064A\u0629 \u0648\u0643\u0645\u064A\u0627\u062A \u062D\u0635\u0631\u064A\u0629 \u0644\u0644\u0623\u0646\u0627\u0642\u0629 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A\u0629.",
    category: "fashion",
    categoryNameAr: "\u0623\u0632\u064A\u0627\u0621 \u0648\u0645\u0648\u0636\u0629",
    priceSdg: 45e4,
    priceUsd: 165,
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
    condition: "\u062C\u062F\u064A\u062F \u0623\u0635\u0644\u064A",
    imageUrl: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644\u064A\u0646 \u0644\u0644\u0623\u0632\u064A\u0627\u0621 \u0627\u0644\u0631\u0627\u0642\u064A\u0629",
    sellerType: "merchant",
    sellerPhone: "+249912987654",
    sellerWhatsapp: "+249912987654",
    isVerifiedMerchant: true,
    viewsCount: 650,
    featured: false,
    createdAt: new Date(Date.now() - 14 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 - \u0634\u0627\u0631\u0639 \u0627\u0644\u0628\u0644\u062F\u064A\u0629"
  },
  {
    id: "alb_serv_01",
    title: "\u062E\u062F\u0645\u0627\u062A \u062A\u062E\u0644\u064A\u0635 \u062C\u0645\u0631\u0643\u064A \u0648\u062A\u0631\u062D\u064A\u0644 \u0628\u0636\u0627\u0626\u0639 \u0645\u064A\u0646\u0627\u0621 \u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    description: "\u062A\u062E\u0644\u064A\u0635 \u0648\u0645\u0646\u0627\u0648\u0644\u0629 \u0643\u0627\u0641\u0629 \u0627\u0644\u062D\u0627\u0648\u064A\u0627\u062A \u0648\u0627\u0644\u0628\u0636\u0627\u0626\u0639 \u0628\u0627\u0644\u0645\u064A\u0646\u0627\u0621 \u0627\u0644\u062C\u0646\u0648\u0628\u064A \u0648\u0627\u0644\u0634\u0645\u0627\u0644\u064A\u060C \u0633\u0631\u0639\u0629 \u0641\u064A \u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u062C\u0645\u0631\u0643\u064A\u0629\u060C \u062A\u0623\u0645\u064A\u0646 \u0623\u0633\u0627\u0637\u064A\u0644 \u0634\u0627\u062D\u0646\u0627\u062A \u0644\u0644\u0646\u0642\u0644 \u0648\u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u0644\u0643\u0627\u0641\u0629 \u0627\u0644\u0648\u0644\u0627\u064A\u0627\u062A.",
    category: "services",
    categoryNameAr: "\u062E\u062F\u0645\u0627\u062A \u0648\u0623\u0639\u0645\u0627\u0644",
    priceSdg: 12e4,
    priceUsd: 45,
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
    condition: "\u062E\u062F\u0645\u0629 \u0645\u0639\u062A\u0645\u062F\u0629",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0645\u0643\u062A\u0628 \u0627\u0644\u0628\u0646\u062F\u0631 \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629 \u0648\u0627\u0644\u062A\u062E\u0644\u064A\u0635",
    sellerType: "showroom",
    sellerPhone: "+249911998877",
    sellerWhatsapp: "+249911998877",
    isVerifiedMerchant: true,
    viewsCount: 1350,
    featured: true,
    createdAt: new Date(Date.now() - 20 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 - \u0642\u0631\u0628 \u0631\u0626\u0627\u0633\u0629 \u0647\u064A\u0626\u0629 \u0627\u0644\u0645\u0648\u0627\u0646\u0626 \u0627\u0644\u0628\u062D\u0631\u064A\u0629"
  }
];
var INITIAL_MARKET_BANNERS = [
  {
    id: "bnr_cars",
    title: "\u0623\u0639\u0644\u0646 \u0639\u0646 \u0645\u0639\u0631\u0636 \u0633\u064A\u0627\u0631\u0627\u062A\u0643 \u0647\u0646\u0627",
    subtitle: "\u0643\u0646 \u0645\u0646 \u0623\u0648\u0627\u0626\u0644 \u0627\u0644\u0645\u0639\u0644\u0646\u064A\u0646 \u0641\u064A \u0633\u0648\u0642 \u0633\u0646\u062F",
    badge: "\u2605\u2605\u2605\u2605\u2605",
    imageUrl: "/assets/images/albander_hyundai_car_1792184093653.jpg",
    active: true,
    sortOrder: 1,
    advertiserName: "\u0645\u0639\u0631\u0636 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0639\u062A\u0645\u062F",
    createdAt: "2026-10-01T08:00:00.000Z"
  },
  {
    id: "bnr_appliances",
    title: "\u0639\u0631\u0648\u0636 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064A\u0629 \u0648\u0627\u0644\u0645\u0643\u064A\u0641\u0627\u062A",
    subtitle: "\u0623\u0641\u0636\u0644 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0645\u0639 \u0636\u0645\u0627\u0646 \u0645\u0639\u062A\u0645\u062F \u0648\u062A\u0631\u0643\u064A\u0628 \u0641\u0648\u0631\u064A",
    badge: "\u0636\u0645\u0627\u0646 \u0645\u0639\u062A\u0645\u062F",
    imageUrl: "/assets/aistudio/Screenshot_________________9bd493de.jpg",
    active: true,
    sortOrder: 2,
    advertiserName: "\u0645\u0639\u0631\u0636 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0645\u0646\u0632\u0644\u064A\u0629",
    createdAt: "2026-10-01T08:05:00.000Z"
  },
  {
    id: "bnr_groceries",
    title: "\u062A\u0633\u0648\u0642 \u0645\u0646 \u0627\u0644\u0645\u062A\u0627\u062C\u0631 \u0627\u0644\u0643\u0628\u0631\u0649 \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u0629",
    subtitle: "\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629 \u0648\u063A\u0630\u0627\u0626\u064A\u0629 \u0628\u0627\u0644\u062C\u0645\u0644\u0629 \u0648\u0627\u0644\u062F\u0641\u0639 \u0628\u0628\u0646\u0643\u0643",
    badge: "\u062A\u0648\u0635\u064A\u0644 \u0633\u0631\u064A\u0639",
    imageUrl: "/assets/images/sanad_pos_hero_1792173270140.jpg",
    active: true,
    sortOrder: 3,
    advertiserName: "\u0645\u0646\u0635\u0629 \u0633\u0646\u062F",
    createdAt: "2026-10-01T08:10:00.000Z"
  }
];
var INITIAL_NOTIFICATIONS = [
  {
    id: "ntf_seed_ad",
    app: "admin",
    kind: "new_ad",
    title: "\u0625\u0639\u0644\u0627\u0646 \u062C\u062F\u064A\u062F \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629",
    body: "\u0644\u0627\u0628\u062A\u0648\u0628 \u0648\u0645\u0627\u0643 \u0628\u0648\u0643 \u0645\u0633\u062A\u0639\u0645\u0644 \u0628\u062D\u0627\u0644\u0629 \u0645\u0645\u062A\u0627\u0632\u0629 \u2014 \u0631\u0633\u0648\u0645 \u0627\u0644\u0646\u0634\u0631 \u0645\u062C\u0627\u0646\u064A\u0629.",
    linkTab: "market_ads",
    read: false,
    createdAt: "2026-10-20T08:30:00.000Z"
  },
  {
    id: "ntf_seed_store",
    app: "admin",
    kind: "new_store_request",
    title: "\u0637\u0644\u0628 \u0645\u062A\u062C\u0631 \u062C\u062F\u064A\u062F",
    body: "\u0645\u0637\u0639\u0645 \u0646\u064A\u0644 \u0643\u0633\u0644\u0627 (\u0643\u0633\u0644\u0627) \u2014 \u0641\u0631\u0639\u0627\u0646\u060C \u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 50,000 \u062C.\u0633.",
    linkTab: "tenant_requests",
    read: false,
    createdAt: "2026-10-20T07:10:00.000Z"
  },
  {
    id: "ntf_seed_order",
    app: "merchant",
    kind: "new_order",
    title: "\u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u062C\u062F\u064A\u062F \u0645\u0646 \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062C\u0645\u0647\u0648\u0631",
    body: "\u0637\u0644\u0628 ORD-2026-101 \u0628\u0642\u064A\u0645\u0629 45,000 \u062C.\u0633 \u2014 \u062C\u0627\u0647\u0632 \u0644\u0644\u062A\u062C\u0647\u064A\u0632.",
    linkTab: "storefront",
    read: false,
    createdAt: "2026-10-20T09:05:00.000Z"
  },
  {
    id: "ntf_seed_client",
    app: "client",
    kind: "order_status",
    title: "\u0637\u0644\u0628\u0643 \u0641\u064A \u0627\u0644\u0637\u0631\u064A\u0642",
    body: "\u0637\u0644\u0628\u0643 ORD-2026-101 \u062E\u0631\u062C \u0644\u0644\u062A\u0648\u0635\u064A\u0644\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0633\u062A\u0639\u062F\u0627\u062F \u0644\u0627\u0633\u062A\u0644\u0627\u0645\u0647.",
    linkTab: "track_order",
    read: false,
    createdAt: "2026-10-20T09:40:00.000Z"
  }
];
var INITIAL_TENANT_APPLICATIONS = [
  {
    id: "tapp_demo_pending",
    storeName: "\u0645\u0637\u0639\u0645 \u0646\u064A\u0644 \u0643\u0633\u0644\u0627",
    ownerName: "\u0639\u062B\u0645\u0627\u0646 \u0625\u062F\u0631\u064A\u0633",
    wilaya: "\u0643\u0633\u0644\u0627",
    city: "\u0643\u0633\u0644\u0627",
    phone: "0913224455",
    email: "nile.kassala@example.com",
    branchesCount: 2,
    businessType: "\u0645\u0637\u0627\u0639\u0645 \u0648\u0643\u0627\u0641\u064A\u0647\u0627\u062A",
    notes: "\u0646\u0631\u063A\u0628 \u0641\u064A \u0631\u0628\u0637 \u0641\u0631\u0639\u064A\u0646 \u0648\u0646\u0642\u0637\u0629 \u0628\u064A\u0639 \u0648\u0627\u062D\u062F\u0629 \u0641\u064A \u0627\u0644\u0628\u062F\u0627\u064A\u0629.",
    source: "client",
    status: "pending",
    registrationFeeSdg: 5e4,
    createdAt: "2026-10-15T09:20:00.000Z"
  },
  {
    id: "tapp_demo_approved",
    storeName: "\u0628\u0642\u0627\u0644\u0629 \u0627\u0644\u0628\u0631\u0643\u0629",
    ownerName: "\u0641\u0627\u0637\u0645\u0629 \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0646",
    wilaya: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    city: "\u0623\u0645 \u062F\u0631\u0645\u0627\u0646",
    phone: "0922334455",
    branchesCount: 1,
    businessType: "\u0628\u0642\u0627\u0644\u0627\u062A \u0648\u0645\u0648\u0627\u062F \u063A\u0630\u0627\u0626\u064A\u0629",
    source: "merchant",
    status: "approved",
    registrationFeeSdg: 5e4,
    activationCode: "SND-7K2M-9Q4P",
    codeSentVia: "whatsapp",
    codeSentAt: "2026-10-12T11:05:00.000Z",
    reviewedBy: "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    reviewedAt: "2026-10-12T11:05:00.000Z",
    createdAt: "2026-10-11T08:00:00.000Z"
  }
];
var INITIAL_MARKET_ADS = [
  {
    id: "mkt_ad_aircon",
    title: "\u0645\u0643\u064A\u0641\u0627\u062A \u0622\u064A\u0633 \u0641\u062E\u0627\u0645\u0629 \u0648\u062C\u0648\u062F\u0629",
    category: "\u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    priceSdg: 135e4,
    location: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    phone: "0912345678",
    whatsapp: "0912345678",
    description: "\u0645\u0643\u064A\u0641\u0627\u062A \u0645\u0627\u0621 \u0643\u0631\u062A\u064A\u0646 \u0623\u0635\u0644\u064A\u0629 \u0648\u0645\u0648\u0641\u0631\u0629 \u0644\u0644\u0637\u0627\u0642\u0629 \u0645\u0639 \u0643\u0641\u0627\u0644\u0629 \u0633\u0646\u062A\u064A\u0646 \u0648\u062A\u0631\u0643\u064A\u0628 \u0641\u0648\u0631\u064A.",
    imageUrl: "/assets/images/product_cooking_oil_1792173269992.jpg",
    isVip: true,
    publisherName: "\u0645\u0639\u0631\u0636 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0645\u0639\u062A\u0645\u062F",
    ownerToken: "seed-owner-aircon",
    feeSdg: 5e3,
    status: "approved",
    reviewedBy: "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    reviewedAt: new Date(Date.now() - 3 * 3600 * 1e3).toISOString(),
    createdAt: new Date(Date.now() - 4 * 3600 * 1e3).toISOString()
  },
  {
    id: "mkt_ad_car",
    title: "\u0623\u0639\u0644\u0646 \u0639\u0646 \u0645\u0639\u0631\u0636 \u0633\u064A\u0627\u0631\u0627\u062A\u0643 \u0647\u0646\u0627",
    category: "\u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0645\u0631\u0643\u0628\u0627\u062A",
    priceSdg: 0,
    location: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    phone: "0913009060",
    whatsapp: "0913009060",
    description: "\u0643\u0646 \u0645\u0646 \u0623\u0648\u0627\u0626\u0644 \u0627\u0644\u0645\u0639\u0644\u0646\u064A\u0646 \u0641\u064A \u0627\u0644\u0628\u0646\u062F\u0631 \u0648\u0633\u0646\u062F.",
    imageUrl: "/assets/images/albander_hyundai_car_1792184093653.jpg",
    isVip: false,
    publisherName: "\u0645\u0646\u0635\u0629 \u0633\u0646\u062F",
    ownerToken: "seed-owner-cars",
    feeSdg: 0,
    status: "approved",
    reviewedBy: "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    reviewedAt: new Date(Date.now() - 26 * 3600 * 1e3).toISOString(),
    createdAt: new Date(Date.now() - 30 * 3600 * 1e3).toISOString()
  },
  {
    id: "mkt_ad_laptop",
    title: "\u0644\u0627\u0628\u062A\u0648\u0628 \u0648\u0645\u0627\u0643 \u0628\u0648\u0643 \u0645\u0633\u062A\u0639\u0645\u0644 \u0628\u062D\u0627\u0644\u0629 \u0645\u0645\u062A\u0627\u0632\u0629",
    category: "\u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    priceSdg: 85e4,
    location: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    phone: "0912556677",
    description: "\u0645\u0627\u0643 \u0628\u0648\u0643 \u0628\u0631\u0648 2021\u060C \u0630\u0627\u0643\u0631\u0629 16 \u062C\u064A\u062C\u0627\u060C \u0628\u0637\u0627\u0631\u064A\u0629 \u0623\u0635\u0644\u064A\u0629.",
    imageUrl: "/assets/images/albander_macbook_laptop_1792184108039.jpg",
    isVip: false,
    publisherName: "\u0633\u0627\u0631\u0629 \u062E\u0627\u0644\u062F",
    ownerToken: "seed-owner-laptop",
    feeSdg: 0,
    status: "pending",
    createdAt: new Date(Date.now() - 40 * 60 * 1e3).toISOString()
  }
];
var Database = class {
  constructor() {
    this.tableDefs = [];
    this.ready = null;
    this.dirty = false;
    /** Row-level snapshot of what Postgres already holds. */
    this.baseline = /* @__PURE__ */ new Map();
    this.data = this.getInitialSeedData();
  }
  /* ------------------------------------------------------------------ */
  /*  Postgres lifecycle                                                */
  /* ------------------------------------------------------------------ */
  /** Create the schema (once per process) and make sure seed data exists. */
  async init() {
    if (!isDbEnabled()) {
      console.warn("[DB] DATABASE_URL not set \u2014 running in memory-only mode. Data will NOT persist.");
      return;
    }
    if (!this.ready) {
      this.ready = (async () => {
        const seed = this.getInitialSeedData();
        this.tableDefs = await ensureSchema(seed);
        const loaded = await loadAll(this.tableDefs);
        const hasTenants = (loaded.tenants || []).length > 0;
        if (hasTenants) {
          this.data = { ...this.data, ...loaded };
          const missing = Object.entries(seed).filter(
            ([collection, rows]) => rows.length > 0 && (loaded[collection] || []).length === 0
          );
          for (const [collection, rows] of missing) {
            this.data[collection] = rows;
          }
          if (missing.length > 0) {
            await persistAll(
              this.tableDefs,
              this.data,
              new Set(missing.map(([c]) => c))
            );
            for (const [collection] of missing) {
              loaded[collection] = this.data[collection];
            }
            console.log("[DB] Seeded new collections:", missing.map(([c]) => c).join(", "));
          }
          this.captureBaseline();
          console.log("[DB] Loaded from Postgres:", Object.entries(loaded).map(([k, v]) => `${k}=${v.length}`).join(" "));
        } else {
          this.data = seed;
          await persistAll(this.tableDefs, seed);
          console.log("[DB] Empty database \u2014 seeded initial Sanad data.");
        }
      })();
      this.ready.catch((err) => {
        console.error("[DB] Init failed, continuing with in-memory seed:", err.message);
        this.ready = null;
      });
    }
    await this.ready;
  }
  /** Re-read every table. Called at the start of each request so no instance
   *  ever serves a stale snapshot. */
  async refresh() {
    if (!isDbEnabled() || this.tableDefs.length === 0) return;
    const loaded = await loadAll(this.tableDefs);
    this.data = { ...this.data, ...loaded };
    this.captureBaseline();
  }
  /** Remember exactly which rows Postgres already holds. */
  captureBaseline() {
    this.baseline = buildBaseline(
      this.tableDefs,
      this.data
    );
  }
  /** Flush the in-memory snapshot back to Postgres. Serialised by an advisory
   *  lock so concurrent lambdas cannot overwrite each other. */
  async flush(options = {}) {
    const useLock = options.lock !== false;
    if (!isDbEnabled() || this.tableDefs.length === 0) return;
    if (!this.dirty) return;
    const release = useLock ? await acquireWriteLock() : async () => {
    };
    try {
      const result = await persistDiff(
        this.tableDefs,
        this.data,
        this.baseline
      );
      this.dirty = false;
      if (result.upserts || result.deletes) {
        const partial = buildBaseline(
          this.tableDefs.filter((d) => result.collections.includes(d.collection)),
          this.data
        );
        for (const [collection, rows] of partial) {
          this.baseline.set(collection, rows);
        }
      }
    } finally {
      await release();
    }
  }
  async shutdown() {
    await closePool();
  }
  /* ------------------------------------------------------------------ */
  /*  Market ads (public listings with admin moderation)                 */
  /* ------------------------------------------------------------------ */
  getMarketAds() {
    return this.data.marketAds || [];
  }
  getMarketAd(id) {
    return (this.data.marketAds || []).find((a) => a.id === id);
  }
  /** New ads always enter as `pending` — nothing reaches the market unreviewed. */
  createMarketAd(input) {
    const ad = {
      ...input,
      id: newId("mkt"),
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.marketAds = [ad, ...this.data.marketAds || []];
    this.save();
    return ad;
  }
  reviewMarketAd(id, decision) {
    const ad = this.getMarketAd(id);
    if (!ad) return null;
    ad.status = decision.decision;
    ad.reviewedBy = decision.reviewedBy || "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F";
    ad.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (decision.decision === "rejected") {
      ad.rejectionReason = decision.note || "\u0644\u0645 \u064A\u0633\u062A\u0648\u0641 \u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u0634\u0631\u0648\u0637 \u0627\u0644\u0646\u0634\u0631.";
    } else {
      ad.rejectionReason = void 0;
      if (decision.paymentConfirmed) {
        ad.paymentRef = ad.paymentRef || `PAID-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`;
      }
    }
    this.save();
    return ad;
  }
  /**
   * Deletion rules:
   *  - the publisher must present the token issued to their device
   *  - an admin can delete anything
   */
  /**
   * تعديل إعلان يملكه صاحب الجهاز الذي نشره.
   * لا يغيّر الحالة ولا الرسوم — التصحيح فقط (عنوان/صورة/سعر/وصف).
   */
  updateMarketAd(id, auth, patch) {
    const ad = this.getMarketAd(id);
    if (!ad) return { ok: false, reason: "NOT_FOUND" };
    const isOwner = !!auth.ownerToken && ad.ownerToken === auth.ownerToken;
    if (!isOwner) return { ok: false, reason: "FORBIDDEN" };
    Object.assign(ad, patch);
    ad.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.save();
    return { ok: true, ad };
  }
  deleteMarketAd(id, auth) {
    const ad = this.getMarketAd(id);
    if (!ad) return { ok: false, reason: "NOT_FOUND" };
    const isOwner = !!auth.ownerToken && ad.ownerToken === auth.ownerToken;
    if (!isOwner && !auth.admin) {
      return { ok: false, reason: "FORBIDDEN" };
    }
    this.data.marketAds = (this.data.marketAds || []).filter((a) => a.id !== id);
    this.save();
    return { ok: true };
  }
  /* ------------------------------------------------------------------ */
  /*  Store applications (شops asking to join the platform)              */
  /* ------------------------------------------------------------------ */
  getTenantApplications() {
    return this.data.tenantApplications || [];
  }
  getTenantApplication(id) {
    return (this.data.tenantApplications || []).find((a) => a.id === id);
  }
  /** Applications always start as `pending` — the admin decides. */
  createTenantApplication(input) {
    const application = {
      ...input,
      id: newId("tapp"),
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.tenantApplications = [application, ...this.data.tenantApplications || []];
    this.save();
    return application;
  }
  reviewTenantApplication(id, decision) {
    const application = this.getTenantApplication(id);
    if (!application) return null;
    application.status = decision.decision;
    application.reviewedBy = decision.reviewedBy || "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F";
    application.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (typeof decision.registrationFeeSdg === "number" && decision.registrationFeeSdg >= 0) {
      application.registrationFeeSdg = decision.registrationFeeSdg;
    }
    if (decision.decision === "rejected") {
      application.rejectionReason = decision.note || "\u0644\u0645 \u064A\u0633\u062A\u0648\u0641 \u0637\u0644\u0628 \u0627\u0644\u0645\u062A\u062C\u0631 \u0634\u0631\u0648\u0637 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645.";
      application.activationCode = void 0;
    } else {
      application.rejectionReason = void 0;
      application.activationCode = decision.activationCode || application.activationCode;
      if (decision.codeSentVia) {
        application.codeSentVia = decision.codeSentVia;
        application.codeSentAt = (/* @__PURE__ */ new Date()).toISOString();
      }
    }
    this.save();
    return application;
  }
  markTenantApplicationCodeSent(id, via) {
    const application = this.getTenantApplication(id);
    if (!application || !application.activationCode) return null;
    application.codeSentVia = via;
    application.codeSentAt = (/* @__PURE__ */ new Date()).toISOString();
    this.save();
    return application;
  }
  deleteTenantApplication(id) {
    const before = (this.data.tenantApplications || []).length;
    this.data.tenantApplications = (this.data.tenantApplications || []).filter((a) => a.id !== id);
    const removed = this.data.tenantApplications.length !== before;
    if (removed) this.save();
    return removed;
  }
  /* ------------------------------------------------------------------ */
  /*  Notifications                                                      */
  /* ------------------------------------------------------------------ */
  getNotifications(filter) {
    const all = this.data.notifications || [];
    const rows = all.filter((n) => n.app === filter.app).filter((n) => {
      if (n.recipientToken) return !!filter.ownerToken && n.recipientToken === filter.ownerToken;
      return true;
    }).filter((n) => {
      if (!n.tenantId) {
        if (filter.tenantId && String(n.id).startsWith("ntf_seed_")) return false;
        return true;
      }
      return !filter.tenantId || n.tenantId === filter.tenantId;
    }).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
    return filter.limit ? rows.slice(0, filter.limit) : rows;
  }
  hasNotificationKey(key) {
    return (this.data.notifications || []).some((n) => n.dedupeKey === key);
  }
  createNotification(input) {
    const notification = {
      ...input,
      id: newId("ntf"),
      read: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.notifications = [notification, ...this.data.notifications || []].slice(0, 300);
    this.save();
    return notification;
  }
  markNotificationRead(id) {
    const notification = (this.data.notifications || []).find((n) => n.id === id);
    if (!notification) return false;
    notification.read = true;
    this.save();
    return true;
  }
  markAllNotificationsRead(filter) {
    let changed = 0;
    for (const n of this.data.notifications || []) {
      if (n.app !== filter.app || n.read) continue;
      if (n.recipientToken && n.recipientToken !== filter.ownerToken) continue;
      n.read = true;
      changed++;
    }
    if (changed > 0) this.save();
    return changed;
  }
  deleteNotification(id) {
    const before = (this.data.notifications || []).length;
    this.data.notifications = (this.data.notifications || []).filter((n) => n.id !== id);
    const removed = this.data.notifications.length !== before;
    if (removed) this.save();
    return removed;
  }
  /* Push subscriptions (one row per device per app) */
  savePushSubscription(input) {
    const all = this.data.pushSubscriptions || [];
    const existing = all.find((s) => s.endpoint === input.endpoint && s.app === input.app);
    if (existing) {
      existing.keys = input.keys;
      existing.ownerToken = input.ownerToken;
      existing.lastSeenAt = (/* @__PURE__ */ new Date()).toISOString();
      this.save();
      return existing;
    }
    const record = {
      ...input,
      id: newId("push"),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.pushSubscriptions = [record, ...all].slice(0, 500);
    this.save();
    return record;
  }
  getPushSubscriptions(filter) {
    return (this.data.pushSubscriptions || []).filter((s) => {
      if (filter.app && s.app !== filter.app) return false;
      if (filter.ownerToken && s.ownerToken !== filter.ownerToken) return false;
      return true;
    });
  }
  /** VAPID keys live in the database so every serverless instance uses the same pair. */
  getPushKeys() {
    const row = (this.data.pushKeys || [])[0];
    return row ? { publicKey: row.publicKey, privateKey: row.privateKey } : null;
  }
  savePushKeys(keys) {
    this.data.pushKeys = [
      { id: "push_keys_main", ...keys, createdAt: (/* @__PURE__ */ new Date()).toISOString() }
    ];
    this.save();
  }
  deletePushSubscription(endpoint) {
    const before = (this.data.pushSubscriptions || []).length;
    this.data.pushSubscriptions = (this.data.pushSubscriptions || []).filter(
      (s) => s.endpoint !== endpoint
    );
    const removed = this.data.pushSubscriptions.length !== before;
    if (removed) this.save();
    return removed;
  }
  /* ------------------------------------------------------------------ */
  /*  Market banners                                                     */
  /* ------------------------------------------------------------------ */
  getMarketBanners(onlyActive = false) {
    return (this.data.marketBanners || []).filter((b) => onlyActive ? b.active : true).slice().sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  }
  createMarketBanner(input) {
    const banner = {
      ...input,
      id: newId("bnr"),
      clicks: 0,
      impressions: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.marketBanners = [...this.data.marketBanners || [], banner];
    this.save();
    return banner;
  }
  updateMarketBanner(id, patch) {
    const banner = (this.data.marketBanners || []).find((b) => b.id === id);
    if (!banner) return null;
    Object.assign(banner, patch);
    this.save();
    return banner;
  }
  getMarketBanner(id) {
    return (this.data.marketBanners || []).find((b) => b.id === id) || null;
  }
  /** UTC day key — keeps reports stable across serverless instances. */
  dayKey(d = /* @__PURE__ */ new Date()) {
    return d.toISOString().slice(0, 10);
  }
  bumpDaily(banner, field, count = 1) {
    const day = this.dayKey();
    if (!banner.daily) banner.daily = {};
    const row = banner.daily[day] || { i: 0, c: 0 };
    row[field] += count;
    banner.daily[day] = row;
    if (!banner.statsSince) banner.statsSince = day;
  }
  /** Counts one shopper tap. Cheap write — only the counter fields change. */
  trackMarketBannerClick(id) {
    const banner = (this.data.marketBanners || []).find((b) => b.id === id);
    if (!banner) return null;
    banner.clicks = (banner.clicks || 0) + 1;
    banner.lastClickedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.bumpDaily(banner, "c");
    this.save();
    return banner;
  }
  /** Counts one real on-screen view of a banner. */
  trackMarketBannerImpression(id) {
    const banner = (this.data.marketBanners || []).find((b) => b.id === id);
    if (!banner) return null;
    banner.impressions = (banner.impressions || 0) + 1;
    banner.lastImpressionAt = (/* @__PURE__ */ new Date()).toISOString();
    this.bumpDaily(banner, "i");
    this.save();
    return banner;
  }
  /** Counts a whole rotation in one write (fewer Neon round-trips). */
  trackMarketBannerImpressions(ids) {
    const wanted = new Set(ids);
    let touched = 0;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const banner of this.data.marketBanners || []) {
      if (!wanted.has(banner.id)) continue;
      banner.impressions = (banner.impressions || 0) + 1;
      banner.lastImpressionAt = now;
      this.bumpDaily(banner, "i");
      touched += 1;
    }
    if (touched) this.save();
    return touched;
  }
  /** Zeroes both counters (a fresh campaign report). */
  resetMarketBannerClicks(id) {
    const banner = (this.data.marketBanners || []).find((b) => b.id === id);
    if (!banner) return null;
    banner.clicks = 0;
    banner.impressions = 0;
    banner.lastClickedAt = void 0;
    banner.lastImpressionAt = void 0;
    banner.daily = {};
    banner.statsSince = this.dayKey();
    this.save();
    return banner;
  }
  /**
   * Day-by-day performance for one banner, gaps filled with zeros so a report
   * never has holes. `toDay` is inclusive.
   */
  getMarketBannerReport(id, fromDay, toDay) {
    const banner = (this.data.marketBanners || []).find((b) => b.id === id);
    if (!banner) return null;
    const today = this.dayKey();
    const keys = Object.keys(banner.daily || {}).sort();
    const DAY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
    const to = toDay && DAY.test(toDay) ? toDay : today;
    const from = fromDay && DAY.test(fromDay) ? fromDay : keys[0] || banner.statsSince || to;
    const days = [];
    const cursor = /* @__PURE__ */ new Date(from + "T00:00:00.000Z");
    const end = /* @__PURE__ */ new Date(to + "T00:00:00.000Z");
    for (let guard = 0; cursor <= end && guard < 400; guard++) {
      const key = cursor.toISOString().slice(0, 10);
      const row = (banner.daily || {})[key] || { i: 0, c: 0 };
      days.push({
        date: key,
        impressions: row.i,
        clicks: row.c,
        ctr: row.i ? Number((row.c / row.i * 100).toFixed(1)) : 0
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const impressions = days.reduce((a, d) => a + d.impressions, 0);
    const clicks = days.reduce((a, d) => a + d.clicks, 0);
    return {
      banner,
      from: days[0] ? days[0].date : from,
      to,
      days,
      totals: {
        impressions,
        clicks,
        ctr: impressions ? Number((clicks / impressions * 100).toFixed(1)) : 0
      }
    };
  }
  /** Banners that belong to one merchant (linked tenant, or a name match as fallback). */
  getMarketBannersForTenant(tenantId) {
    const tenant = this.getTenant(tenantId);
    const names = [tenant?.tradeName, tenant?.name].filter((n) => !!n).map((n) => n.trim());
    return (this.data.marketBanners || []).filter(
      (b) => b.advertiserTenantId === tenantId || !b.advertiserTenantId && !!b.advertiserName && names.includes(b.advertiserName.trim())
    ).slice().sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  }
  deleteMarketBanner(id) {
    const before = (this.data.marketBanners || []).length;
    this.data.marketBanners = (this.data.marketBanners || []).filter((b) => b.id !== id);
    const removed = this.data.marketBanners.length !== before;
    if (removed) this.save();
    return removed;
  }
  isDatabaseEnabled() {
    return isDbEnabled();
  }
  tableCount() {
    return this.tableDefs.length;
  }
  /** True when the schema is live and writes are actually reaching Postgres. */
  isPersisting() {
    return isDbEnabled() && this.tableDefs.length > 0 && this.ready !== null;
  }
  getInitialSeedData() {
    return {
      tenants: INITIAL_TENANTS,
      subscriptionPlans: INITIAL_PLANS,
      subscriptionPayments: INITIAL_PAYMENTS,
      branches: INITIAL_BRANCHES,
      employees: INITIAL_EMPLOYEES,
      products: INITIAL_PRODUCTS,
      branchInventories: INITIAL_INVENTORIES,
      stockMovements: [],
      branchTransfers: INITIAL_TRANSFERS,
      cashierShifts: INITIAL_SHIFTS,
      sales: INITIAL_SALES,
      returns: [],
      customers: INITIAL_CUSTOMERS,
      currencies: INITIAL_CURRENCIES,
      currencyRateHistory: [],
      currencyRatesSnapshot: [],
      currencyRateAlerts: [],
      storefrontOrders: INITIAL_STORE_ORDERS,
      expenses: INITIAL_EXPENSES,
      purchases: INITIAL_PURCHASES,
      auditLogs: INITIAL_AUDIT_LOGS,
      albandarListings: INITIAL_ALBANDAR_LISTINGS,
      albandarShowrooms: INITIAL_ALBANDAR_SHOWROOMS,
      recurringExpenses: INITIAL_RECURRING_EXPENSES,
      promotions: INITIAL_PROMOTIONS,
      kitchenTickets: INITIAL_KITCHEN_TICKETS,
      inventoryAlerts: [],
      inventoryAudits: [],
      marketAds: INITIAL_MARKET_ADS,
      tenantApplications: INITIAL_TENANT_APPLICATIONS,
      notifications: INITIAL_NOTIFICATIONS,
      pushSubscriptions: [],
      pushKeys: [],
      ownerApprovals: [],
      marketBanners: INITIAL_MARKET_BANNERS
    };
  }
  /** Mark the snapshot as changed; the request pipeline flushes it. */
  save(_data) {
    this.dirty = true;
  }
  // Get raw schema (safe reference copy)
  getSchema() {
    return this.data;
  }
  commit() {
    this.save();
  }
  /* ------------------------------------------------------------------ */
  /*  Parallel-market currency rates                                     */
  /* ------------------------------------------------------------------ */
  getRatesSnapshot() {
    const row = (this.data.currencyRatesSnapshot || [])[0];
    return row || null;
  }
  /** Alert bookkeeping: one entry per currency per day. */
  getRateAlertLog() {
    return this.data.currencyRateAlerts || [];
  }
  markRateAlerted(code, percent, rate) {
    const data = this.data;
    if (!Array.isArray(data.currencyRateAlerts)) data.currencyRateAlerts = [];
    const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    data.currencyRateAlerts = [
      { id: `${code}_${day}`, code, day, percent, rate },
      ...data.currencyRateAlerts.filter((a) => !(a.code === code && a.day === day))
    ].slice(0, 200);
    this.commit();
  }
  saveRatesSnapshot(snapshot) {
    this.data.currencyRatesSnapshot = [{ id: "latest", ...snapshot }];
    this.commit();
  }
  /**
   * Applies a fresh parallel-market snapshot to every configured currency.
   * The parallel number becomes the trading rate; the bank number is kept
   * alongside it for display. History rows are written so the audit trail
   * still shows who/what moved the rate.
   */
  applyLiveRates(snapshot, actorName = "\u062A\u062D\u062F\u064A\u062B \u062A\u0644\u0642\u0627\u0626\u064A \u2014 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u0632\u064A") {
    let updated = 0;
    const skipped = [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const currency of this.data.currencies) {
      if (currency.isBase) continue;
      const live = snapshot.rates.find((r) => r.code === currency.code);
      if (!live) {
        skipped.push(currency.code);
        continue;
      }
      const trading = live.parallel ?? live.official;
      if (!trading || trading <= 0) {
        skipped.push(currency.code);
        continue;
      }
      const oldRate = currency.rateToSdg;
      const previousParallel = currency.parallelRate;
      const movePercent = previousParallel && previousParallel > 0 ? Number(((trading - previousParallel) / previousParallel * 100).toFixed(2)) : 0;
      currency.rateToSdg = Math.round(trading * 100) / 100;
      currency.lastMovePercent = movePercent;
      if (live.official) currency.officialRate = live.official;
      if (live.parallel) currency.parallelRate = live.parallel;
      currency.rateSource = "parallel";
      currency.lastUpdated = now;
      if (oldRate !== currency.rateToSdg) {
        this.data.currencyRateHistory.unshift({
          id: newId("crh"),
          tenantId: "platform",
          currencyCode: currency.code,
          oldRate,
          newRate: currency.rateToSdg,
          updatedBy: actorName,
          timestamp: now
        });
        updated += 1;
      }
    }
    this.data.currencyRatesSnapshot = [{ id: "latest", ...snapshot }];
    this.commit();
    return { updated, skipped };
  }
  // Tenant helper
  getTenant(tenantId) {
    return this.data.tenants.find((t) => t.id === tenantId);
  }
  getTenantBySlug(slug) {
    return this.data.tenants.find((t) => t.slug === slug);
  }
  findTenantByMerchantCodeHash(hash) {
    if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return void 0;
    return this.data.tenants.find((t) => t.merchantCodeHash === hash);
  }
  /**
   * يخزّن بصمة الكود (للدخول) + بادئته (١٦ خانة) لمطابقة الأكواد المقتطعة.
   * البادئة ليست سراً: ١٦ من ٤٤ خانة لا تكفي لتخمين الكود، لكنها تنقذ التاجر
   * الذي ينسخ نصف الكود لأن الحقل يعرض ٢٤ حرفاً فقط.
   */
  setMerchantCode(tenantId, hash, issuedBy, plainCode) {
    const tenant = this.getTenant(tenantId);
    if (!tenant) return null;
    if (!/^[0-9a-f]{64}$/.test(hash)) return null;
    tenant.merchantCodeHash = hash;
    tenant.merchantCodeIssuedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (issuedBy) tenant.merchantCodeIssuedBy = issuedBy;
    if (plainCode) {
      const compact = String(plainCode).toUpperCase().replace(/[^A-Z0-9]/g, "");
      tenant.merchantCodePrefix = compact.slice(0, 16);
    } else {
      delete tenant.merchantCodePrefix;
    }
    this.save();
    return tenant;
  }
  clearMerchantCode(tenantId) {
    const tenant = this.getTenant(tenantId);
    if (!tenant) return false;
    delete tenant.merchantCodeHash;
    delete tenant.merchantCodeIssuedAt;
    delete tenant.merchantCodeIssuedBy;
    this.save();
    return true;
  }
  // Branch helper
  getBranches(tenantId) {
    return this.data.branches.filter((b) => b.tenantId === tenantId);
  }
  // Products helper
  getProducts(tenantId) {
    return this.data.products.filter((p) => p.tenantId === tenantId);
  }
  // Inventory helper
  getInventory(tenantId, branchId) {
    return this.data.branchInventories.filter((inv) => inv.tenantId === tenantId && (!branchId || inv.branchId === branchId)).map((inv) => {
      const product = this.data.products.find((p) => p.id === inv.productId);
      const branch = this.data.branches.find((b) => b.id === inv.branchId);
      return {
        ...inv,
        product,
        branch
      };
    });
  }
  // Get stock for a specific branch and product
  getProductStock(tenantId, branchId, productId) {
    const inv = this.data.branchInventories.find(
      (i) => i.tenantId === tenantId && i.branchId === branchId && i.productId === productId
    );
    return inv ? inv.quantity : 0;
  }
  // Adjust stock atomically with reason and movement logging
  adjustStock(params) {
    let inv = this.data.branchInventories.find(
      (i) => i.tenantId === params.tenantId && i.branchId === params.branchId && i.productId === params.productId
    );
    const product = this.data.products.find((p) => p.id === params.productId && p.tenantId === params.tenantId);
    const tenant = this.getTenant(params.tenantId);
    const currentQty = inv ? inv.quantity : 0;
    const newQty = currentQty + params.delta;
    if (newQty < 0 && (!tenant || !tenant.settings.allowNegativeStock)) {
      return {
        success: false,
        newBalance: currentQty,
        error: `\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u062D \u063A\u064A\u0631 \u0643\u0627\u0641\u064D (${currentQty}) \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u062E\u0635\u0645 \u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u062F\u0648\u0646 \u0631\u0635\u064A\u062F \u0633\u0627\u0644\u0628.`
      };
    }
    if (!inv) {
      inv = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tenantId: params.tenantId,
        branchId: params.branchId,
        productId: params.productId,
        quantity: newQty,
        minAlertQuantity: product ? product.minStockAlert : 5,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.data.branchInventories.push(inv);
    } else {
      inv.quantity = newQty;
      inv.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    }
    const movement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenantId: params.tenantId,
      branchId: params.branchId,
      productId: params.productId,
      productName: product?.name || "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641",
      type: params.type,
      quantityDelta: params.delta,
      balanceAfter: newQty,
      costPerUnitSdg: product?.purchaseCost || 0,
      totalValueSdg: Math.abs(params.delta) * (product?.purchaseCost || 0),
      referenceId: params.referenceId,
      actorName: params.actorName,
      reason: params.reason,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.stockMovements.unshift(movement);
    if (!this.data.inventoryAlerts) this.data.inventoryAlerts = [];
    const threshold = product ? product.minimumStock !== void 0 ? product.minimumStock : product.minStockAlert : 5;
    const branch = this.data.branches.find((b) => b.id === params.branchId);
    const branchName = branch ? branch.name : "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A";
    if (newQty <= threshold) {
      const existingAlert = this.data.inventoryAlerts.find(
        (a) => a.tenantId === params.tenantId && a.branchId === params.branchId && a.productId === params.productId && a.status !== "dismissed"
      );
      if (existingAlert) {
        existingAlert.currentQuantity = newQty;
        existingAlert.severity = newQty === 0 ? "critical" : "warning";
        existingAlert.status = "unread";
      } else {
        this.data.inventoryAlerts.unshift({
          id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          tenantId: params.tenantId,
          branchId: params.branchId,
          branchName,
          productId: params.productId,
          productName: product?.name || "\u0645\u0646\u062A\u062C",
          sku: product?.sku || "",
          currentQuantity: newQty,
          reorderPoint: threshold,
          severity: newQty === 0 ? "critical" : "warning",
          status: "unread",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    } else {
      this.data.inventoryAlerts = this.data.inventoryAlerts.filter(
        (a) => !(a.tenantId === params.tenantId && a.branchId === params.branchId && a.productId === params.productId)
      );
    }
    this.commit();
    return { success: true, newBalance: newQty };
  }
  // Audit logging helper
  logAudit(entry) {
    const log = {
      ...entry,
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.auditLogs.unshift(log);
    this.commit();
    return log;
  }
  // Albandar Marketplace Helpers
  getAlbandarListings() {
    return this.data.albandarListings || [];
  }
  addAlbandarListing(listing) {
    if (!this.data.albandarListings) {
      this.data.albandarListings = [];
    }
    this.data.albandarListings.unshift(listing);
    this.commit();
    return listing;
  }
  getAlbandarShowrooms() {
    return this.data.albandarShowrooms || [];
  }
  // Customer Management & Loyalty Points
  getCustomers(tenantId, search) {
    let list2 = (this.data.customers || []).filter((c) => c.tenantId === tenantId);
    if (search) {
      const q2 = search.trim().toLowerCase();
      list2 = list2.filter(
        (c) => c.name.toLowerCase().includes(q2) || c.phone.includes(q2) || c.taxNumber && c.taxNumber.includes(q2)
      );
    }
    return list2;
  }
  getCustomer(tenantId, id) {
    return (this.data.customers || []).find((c) => c.id === id && c.tenantId === tenantId);
  }
  addCustomer(customer) {
    if (!this.data.customers) this.data.customers = [];
    this.data.customers.unshift(customer);
    this.commit();
    return customer;
  }
  updateCustomer(tenantId, id, updates) {
    if (!this.data.customers) this.data.customers = [];
    const idx = this.data.customers.findIndex((c) => c.id === id && c.tenantId === tenantId);
    if (idx === -1) return null;
    this.data.customers[idx] = { ...this.data.customers[idx], ...updates };
    this.commit();
    return this.data.customers[idx];
  }
  recordCustomerSale(tenantId, customerId, saleGrandTotalSdg) {
    if (!this.data.customers) this.data.customers = [];
    const cust = this.data.customers.find((c) => c.id === customerId && c.tenantId === tenantId);
    if (cust) {
      const tenant = this.getTenant(tenantId);
      const rate = tenant?.settings?.loyaltyRateSdgPerPoint || 1e3;
      const earnedPoints = Math.max(1, Math.floor(saleGrandTotalSdg / rate));
      cust.loyaltyPoints = (cust.loyaltyPoints || 0) + earnedPoints;
      cust.totalPurchasesSdg = (cust.totalPurchasesSdg || 0) + saleGrandTotalSdg;
      cust.invoicesCount = (cust.invoicesCount || 0) + 1;
      cust.lastPurchaseAt = (/* @__PURE__ */ new Date()).toISOString();
      this.commit();
      return { cust, earnedPoints };
    }
    return null;
  }
  // ==========================================
  // Recurring Expenses (المصروفات الدورية)
  // ==========================================
  getRecurringExpenses(tenantId, branchId) {
    let list2 = (this.data.recurringExpenses || []).filter((r) => r.tenantId === tenantId);
    if (branchId) {
      list2 = list2.filter((r) => r.branchId === branchId);
    }
    return list2;
  }
  addRecurringExpense(item) {
    if (!this.data.recurringExpenses) this.data.recurringExpenses = [];
    this.data.recurringExpenses.unshift(item);
    this.commit();
    return item;
  }
  updateRecurringExpense(tenantId, id, updates) {
    if (!this.data.recurringExpenses) this.data.recurringExpenses = [];
    const idx = this.data.recurringExpenses.findIndex((r) => r.id === id && r.tenantId === tenantId);
    if (idx === -1) return null;
    this.data.recurringExpenses[idx] = { ...this.data.recurringExpenses[idx], ...updates };
    this.commit();
    return this.data.recurringExpenses[idx];
  }
  deleteRecurringExpense(tenantId, id) {
    if (!this.data.recurringExpenses) return false;
    const initialLen = this.data.recurringExpenses.length;
    this.data.recurringExpenses = this.data.recurringExpenses.filter(
      (r) => !(r.id === id && r.tenantId === tenantId)
    );
    if (this.data.recurringExpenses.length !== initialLen) {
      this.commit();
      return true;
    }
    return false;
  }
  postRecurringExpenseNow(tenantId, id, actorName = "\u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0622\u0644\u064A") {
    const rec = (this.data.recurringExpenses || []).find((r) => r.id === id && r.tenantId === tenantId);
    if (!rec) return null;
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const newExpense = {
      id: `exp_rec_${Date.now()}`,
      tenantId: rec.tenantId,
      branchId: rec.branchId,
      branchName: rec.branchName,
      category: rec.category,
      amountSdg: rec.amountSdg,
      description: `[\u0645\u0635\u0631\u0648\u0641 \u062F\u0648\u0631\u064A \u0645\u062C\u062F\u0648\u0644]: ${rec.title}`,
      paidBy: actorName,
      receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!this.data.expenses) this.data.expenses = [];
    this.data.expenses.unshift(newExpense);
    const currDue = new Date(rec.nextDueDate);
    if (rec.frequency === "weekly") {
      currDue.setDate(currDue.getDate() + 7);
    } else if (rec.frequency === "yearly") {
      currDue.setFullYear(currDue.getFullYear() + 1);
    } else {
      currDue.setMonth(currDue.getMonth() + 1);
    }
    rec.lastPostedDate = todayStr;
    rec.nextDueDate = currDue.toISOString().split("T")[0];
    this.commit();
    return { expense: newExpense, recurring: rec };
  }
  // ==========================================
  // Promotions Management (العروض الترويجية)
  // ==========================================
  getPromotions(tenantId) {
    return (this.data.promotions || []).filter((p) => p.tenantId === tenantId);
  }
  addPromotion(promo) {
    if (!this.data.promotions) this.data.promotions = [];
    this.data.promotions.unshift(promo);
    this.commit();
    return promo;
  }
  updatePromotion(tenantId, id, updates) {
    if (!this.data.promotions) this.data.promotions = [];
    const idx = this.data.promotions.findIndex((p) => p.id === id && p.tenantId === tenantId);
    if (idx === -1) return null;
    this.data.promotions[idx] = { ...this.data.promotions[idx], ...updates };
    this.commit();
    return this.data.promotions[idx];
  }
  deletePromotion(tenantId, id) {
    if (!this.data.promotions) return false;
    const initialLen = this.data.promotions.length;
    this.data.promotions = this.data.promotions.filter((p) => !(p.id === id && p.tenantId === tenantId));
    if (this.data.promotions.length !== initialLen) {
      this.commit();
      return true;
    }
    return false;
  }
  // ==========================================
  // Kitchen Display System (KDS)
  // ==========================================
  getKitchenTickets(tenantId, branchId, status) {
    let list2 = (this.data.kitchenTickets || []).filter((t) => t.tenantId === tenantId);
    if (branchId) {
      list2 = list2.filter((t) => t.branchId === branchId);
    }
    if (status && status !== "all") {
      list2 = list2.filter((t) => t.status === status);
    }
    return list2;
  }
  updateKitchenTicketStatus(ticketId, status) {
    if (!this.data.kitchenTickets) this.data.kitchenTickets = [];
    const ticket = this.data.kitchenTickets.find((t) => t.id === ticketId);
    if (!ticket) return null;
    ticket.status = status;
    ticket.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (status === "completed" || status === "ready") {
      ticket.items.forEach((it) => {
        it.status = status;
      });
    }
    this.commit();
    return ticket;
  }
  updateKitchenItemStatus(ticketId, itemId, status) {
    if (!this.data.kitchenTickets) this.data.kitchenTickets = [];
    const ticket = this.data.kitchenTickets.find((t) => t.id === ticketId);
    if (!ticket) return null;
    const it = ticket.items.find((i) => i.id === itemId);
    if (it) {
      it.status = status;
      ticket.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      if (ticket.items.every((i) => i.status === "completed")) {
        ticket.status = "completed";
      } else if (ticket.items.every((i) => i.status === "ready" || i.status === "completed")) {
        ticket.status = "ready";
      } else if (ticket.items.some((i) => i.status === "preparing")) {
        ticket.status = "preparing";
      }
      this.commit();
    }
    return ticket;
  }
  createKitchenTicket(ticket) {
    if (!this.data.kitchenTickets) this.data.kitchenTickets = [];
    this.data.kitchenTickets.unshift(ticket);
    this.commit();
    return ticket;
  }
  // ==========================================
  // Inventory Alerts (نظام تنبيهات حد إعادة الطلب)
  // ==========================================
  getInventoryAlerts(tenantId, branchId) {
    if (!this.data.inventoryAlerts) this.data.inventoryAlerts = [];
    this.syncInventoryAlerts(tenantId);
    return this.data.inventoryAlerts.filter(
      (a) => a.tenantId === tenantId && (!branchId || a.branchId === branchId)
    );
  }
  dismissInventoryAlert(tenantId, alertId) {
    if (!this.data.inventoryAlerts) return false;
    const alert = this.data.inventoryAlerts.find((a) => a.tenantId === tenantId && a.id === alertId);
    if (alert) {
      alert.status = "dismissed";
      this.commit();
      return true;
    }
    return false;
  }
  markInventoryAlertRead(tenantId, alertId) {
    if (!this.data.inventoryAlerts) return false;
    const alert = this.data.inventoryAlerts.find((a) => a.tenantId === tenantId && a.id === alertId);
    if (alert && alert.status === "unread") {
      alert.status = "read";
      this.commit();
      return true;
    }
    return false;
  }
  syncInventoryAlerts(tenantId) {
    if (!this.data.inventoryAlerts) this.data.inventoryAlerts = [];
    const tenantProducts = this.getProducts(tenantId).filter((p) => p.isActive !== false);
    const tenantBranches = this.getBranches(tenantId);
    for (const br of tenantBranches) {
      for (const prod of tenantProducts) {
        const threshold = prod.minimumStock !== void 0 ? prod.minimumStock : prod.minStockAlert || 5;
        const inv = this.data.branchInventories.find(
          (i) => i.tenantId === tenantId && i.branchId === br.id && i.productId === prod.id
        );
        const currentQty = inv ? inv.quantity : 0;
        if (currentQty <= threshold) {
          const existing = this.data.inventoryAlerts.find(
            (a) => a.tenantId === tenantId && a.branchId === br.id && a.productId === prod.id && a.status !== "dismissed"
          );
          if (existing) {
            existing.currentQuantity = currentQty;
            existing.severity = currentQty === 0 ? "critical" : "warning";
          } else {
            this.data.inventoryAlerts.unshift({
              id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              tenantId,
              branchId: br.id,
              branchName: br.name,
              productId: prod.id,
              productName: prod.name,
              sku: prod.sku,
              currentQuantity: currentQty,
              reorderPoint: threshold,
              severity: currentQty === 0 ? "critical" : "warning",
              status: "unread",
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        } else {
          this.data.inventoryAlerts = this.data.inventoryAlerts.filter(
            (a) => !(a.tenantId === tenantId && a.branchId === br.id && a.productId === prod.id)
          );
        }
      }
    }
    this.commit();
    return this.data.inventoryAlerts.filter((a) => a.tenantId === tenantId);
  }
  // ==========================================
  // CSV Products & Inventory Bulk Import (استيراد المنتجات والمخزون)
  // ==========================================
  importProductsCsv(params) {
    const importedProducts = [];
    const errors = [];
    for (let i = 0; i < params.items.length; i++) {
      const item = params.items[i];
      if (!item.name || !item.name.trim()) {
        errors.push(`\u0627\u0644\u0633\u0637\u0631 ${i + 1}: \u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C \u0645\u0641\u0642\u0648\u062F.`);
        continue;
      }
      const price = Number(item.sellingPriceSdg);
      if (isNaN(price) || price <= 0) {
        errors.push(`\u0627\u0644\u0633\u0637\u0631 ${i + 1} (${item.name}): \u0633\u0639\u0631 \u0627\u0644\u0628\u064A\u0639 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.`);
        continue;
      }
      const newProd = {
        id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tenantId: params.tenantId,
        name: item.name.trim(),
        sku: item.sku && item.sku.trim() ? item.sku.trim() : `SKU-${Date.now().toString().slice(-5)}${i}`,
        barcode: item.barcode && item.barcode.trim() ? item.barcode.trim() : Math.floor(1e11 + Math.random() * 9e11).toString(),
        category: item.category && item.category.trim() ? item.category.trim() : "\u0639\u0627\u0645",
        unit: item.unit && item.unit.trim() ? item.unit.trim() : "\u062D\u0628\u0629",
        purchaseCost: Number(item.purchaseCost) || 0,
        costCurrency: item.costCurrency || "SDG",
        sellingPriceSdg: price,
        minStockAlert: Number(item.minStockAlert) || 5,
        minimumStock: Number(item.minStockAlert) || 5,
        isActive: true,
        isTaxExempt: Boolean(item.isTaxExempt),
        customTaxRate: item.customTaxRate !== void 0 && item.customTaxRate !== null ? Number(item.customTaxRate) : void 0,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.data.products.push(newProd);
      importedProducts.push(newProd);
      const initStock = Number(item.initialStock);
      if (!isNaN(initStock) && initStock > 0 && params.branchId) {
        this.adjustStock({
          tenantId: params.tenantId,
          branchId: params.branchId,
          productId: newProd.id,
          delta: initStock,
          type: "purchase_receive",
          reason: "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0631\u0635\u064A\u062F \u0645\u062E\u0632\u0648\u0646 \u0627\u0641\u062A\u062A\u0627\u062D\u064A \u0645\u0646 \u0645\u0644\u0641 CSV",
          actorName: params.actorName
        });
      }
    }
    if (importedProducts.length > 0) {
      this.syncInventoryAlerts(params.tenantId);
      this.commit();
      this.logAudit({
        tenantId: params.tenantId,
        actorId: "system",
        actorName: params.actorName,
        action: "IMPORT_CSV_PRODUCTS",
        entity: "Product",
        entityId: `batch_${Date.now()}`,
        details: `\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u062C\u0645\u0627\u0639\u064A \u0644\u0640 (${importedProducts.length}) \u0645\u0646\u062A\u062C \u0645\u0639 \u0623\u0631\u0635\u062F\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0639\u0628\u0631 \u0645\u0644\u0641 CSV`
      });
    }
    return {
      success: importedProducts.length > 0,
      importedCount: importedProducts.length,
      errors,
      products: importedProducts
    };
  }
  // ==========================================
  // Smart Inventory Audit System (تدقيق وجرد المخزون الذكي)
  // ==========================================
  getInventoryAudits(tenantId, branchId) {
    let audits = (this.data.inventoryAudits || []).filter((a) => a.tenantId === tenantId);
    if (branchId) {
      audits = audits.filter((a) => a.branchId === branchId);
    }
    return audits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  getInventoryAudit(tenantId, auditId) {
    return (this.data.inventoryAudits || []).find(
      (a) => a.tenantId === tenantId && a.id === auditId
    );
  }
  createInventoryAudit(params) {
    const branch = this.data.branches.find((b) => b.id === params.branchId && b.tenantId === params.tenantId);
    const branchName = branch ? branch.name : "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A";
    let prods = this.data.products.filter((p) => p.tenantId === params.tenantId && p.isActive !== false);
    if (params.scope === "category" && params.categoryFilter && params.categoryFilter !== "\u0627\u0644\u0643\u0644") {
      prods = prods.filter((p) => p.category === params.categoryFilter);
    }
    const items = prods.map((prod) => {
      const stock = this.getProductStock(params.tenantId, params.branchId, prod.id);
      return {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        barcode: prod.barcode || "",
        category: prod.category || "\u0639\u0627\u0645",
        unit: prod.unit || "\u062D\u0628\u0629",
        costPrice: prod.purchaseCost || 0,
        sellingPrice: prod.sellingPriceSdg || 0,
        systemQuantity: stock,
        actualQuantity: 0,
        difference: 0 - stock,
        differenceCostValue: (0 - stock) * (prod.purchaseCost || 0),
        status: "uncounted",
        notes: ""
      };
    });
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const seq = (this.data.inventoryAudits?.length || 0) + 1;
    const auditNumber = `AUD-${dateStr}-${String(seq).padStart(3, "0")}`;
    const newAudit = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenantId: params.tenantId,
      branchId: params.branchId,
      branchName,
      auditNumber,
      title: params.title || `\u062C\u0631\u062F \u0645\u062E\u0632\u0648\u0646 \u0630\u0643\u064A - ${branchName}`,
      status: "in_progress",
      startedAt: now.toISOString(),
      auditorId: params.auditorId,
      auditorName: params.auditorName,
      auditorRole: params.auditorRole,
      deviceInfo: params.deviceInfo || "\u0647\u0627\u062A\u0641 \u0645\u062D\u0645\u0648\u0644 \u0630\u0643\u064A",
      scope: params.scope || "all",
      categoryFilter: params.categoryFilter,
      items,
      totalProductsCount: items.length,
      countedProductsCount: 0,
      matchedCount: 0,
      deficitCount: 0,
      surplusCount: 0,
      uncountedCount: items.length,
      totalDeficitValueSdg: 0,
      totalSurplusValueSdg: 0,
      netDiscrepancyCostSdg: 0,
      reconciled: false,
      notes: params.notes,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    if (!this.data.inventoryAudits) {
      this.data.inventoryAudits = [];
    }
    this.data.inventoryAudits.unshift(newAudit);
    this.commit();
    this.logAudit({
      tenantId: params.tenantId,
      actorId: params.auditorId,
      actorName: params.auditorName,
      action: "START_INVENTORY_AUDIT",
      entity: "InventoryAudit",
      entityId: newAudit.id,
      details: `\u0628\u062F\u0621 \u062C\u0644\u0633\u0629 \u062A\u062F\u0642\u064A\u0642 \u0648\u062C\u0631\u062F \u0645\u062E\u0632\u0648\u0646 \u0631\u0642\u0645 (${auditNumber}) \u0644\u0641\u0631\u0639 [${branchName}] \u062A\u0634\u0645\u0644 (${items.length}) \u0635\u0646\u0641`
    });
    return newAudit;
  }
  updateInventoryAudit(tenantId, auditId, updates) {
    if (!this.data.inventoryAudits) return null;
    const index = this.data.inventoryAudits.findIndex(
      (a) => a.tenantId === tenantId && a.id === auditId
    );
    if (index === -1) return null;
    const existing = this.data.inventoryAudits[index];
    const updated = {
      ...existing,
      ...updates,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (updates.items) {
      updated.totalProductsCount = updated.items.length;
      updated.countedProductsCount = updated.items.filter((i) => i.status !== "uncounted").length;
      updated.matchedCount = updated.items.filter((i) => i.status === "matched").length;
      updated.deficitCount = updated.items.filter((i) => i.status === "deficit").length;
      updated.surplusCount = updated.items.filter((i) => i.status === "surplus").length;
      updated.uncountedCount = updated.items.filter((i) => i.status === "uncounted").length;
      let deficitVal = 0;
      let surplusVal = 0;
      let netCost = 0;
      for (const item of updated.items) {
        if (item.status === "uncounted") continue;
        const diff = item.actualQuantity - item.systemQuantity;
        item.difference = diff;
        item.differenceCostValue = diff * item.costPrice;
        if (diff === 0) {
          item.status = "matched";
        } else if (diff < 0) {
          item.status = "deficit";
          deficitVal += Math.abs(item.differenceCostValue);
        } else {
          item.status = "surplus";
          surplusVal += item.differenceCostValue;
        }
        netCost += item.differenceCostValue;
      }
      updated.totalDeficitValueSdg = deficitVal;
      updated.totalSurplusValueSdg = surplusVal;
      updated.netDiscrepancyCostSdg = netCost;
    }
    this.data.inventoryAudits[index] = updated;
    this.commit();
    return updated;
  }
  reconcileInventoryAudit(params) {
    const audit = this.getInventoryAudit(params.tenantId, params.auditId);
    if (!audit) {
      return { success: false, adjustedCount: 0, error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" };
    }
    if (audit.reconciled) {
      return { success: false, adjustedCount: 0, error: "\u062A\u0645\u062A \u062A\u0633\u0648\u064A\u0629 \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629 \u0645\u0633\u0628\u0642\u0627\u064B" };
    }
    let adjustedCount = 0;
    for (const item of audit.items) {
      if (item.status !== "uncounted" && item.difference !== 0) {
        const delta = item.difference;
        const reason = `\u062A\u0633\u0648\u064A\u0629 \u062C\u0631\u062F \u0645\u062E\u0632\u0646\u064A \u0630\u0643\u064A (${audit.auditNumber}): ${item.notes ? item.notes : delta < 0 ? "\u0639\u062C\u0632 \u0641\u0639\u0644\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u062C\u0631\u062F" : "\u0641\u0627\u0626\u0636 \u0641\u0639\u0644\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u062C\u0631\u062F"}`;
        const adjRes = this.adjustStock({
          tenantId: params.tenantId,
          branchId: audit.branchId,
          productId: item.productId,
          delta,
          type: delta < 0 ? "damage_expired" : "adjustment",
          reason,
          actorName: params.actorName,
          referenceId: audit.auditNumber
        });
        if (adjRes.success) {
          adjustedCount++;
        }
      }
    }
    audit.reconciled = true;
    audit.status = "completed";
    audit.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    audit.reconciledAt = (/* @__PURE__ */ new Date()).toISOString();
    audit.reconciledBy = params.actorName;
    audit.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.syncInventoryAlerts(params.tenantId);
    this.commit();
    this.logAudit({
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorName: params.actorName,
      action: "RECONCILE_INVENTORY_AUDIT",
      entity: "InventoryAudit",
      entityId: audit.id,
      details: `\u0627\u0639\u062A\u0645\u0627\u062F \u0648\u062A\u0633\u0648\u064A\u0629 \u062C\u0631\u062F \u0645\u062E\u0632\u0646\u064A \u0631\u0642\u0645 (${audit.auditNumber}) \u0644\u0641\u0631\u0639 [${audit.branchName}]. \u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0623\u0631\u0635\u062F\u0629 (${adjustedCount}) \u0635\u0646\u0641 \u0628\u0635\u0627\u0641\u064A \u0641\u0631\u0648\u0642\u0627\u062A (${audit.netDiscrepancyCostSdg.toLocaleString()} \u062C.\u0633)`
    });
    return { success: true, audit, adjustedCount };
  }
  cancelInventoryAudit(tenantId, auditId) {
    const audit = this.getInventoryAudit(tenantId, auditId);
    if (!audit) {
      return { success: false, error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" };
    }
    if (audit.reconciled) {
      return { success: false, error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0644\u063A\u0627\u0621 \u062C\u0644\u0633\u0629 \u062C\u0631\u062F \u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F\u0647\u0627 \u0648\u062A\u0633\u0648\u064A\u062A\u0647\u0627 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645" };
    }
    audit.status = "cancelled";
    audit.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.commit();
    return { success: true };
  }
};
var db = new Database();

// src/lib/sudaneseUnits.ts
var SUDANESE_UNITS = [
  {
    id: "kg",
    nameAr: "\u0643\u064A\u0644\u0648\u062C\u0631\u0627\u0645",
    aliases: ["\u0643\u064A\u0644\u0648", "\u0643\u064A\u0644\u0648\u062C\u0631\u0627\u0645", "\u0643\u064A\u0644\u0648\u062C\u0631\u0627\u0645\u0627\u062A", "\u0643\u062C\u0645", "\u0643\u062C", "\u0643\u064A\u0644\u0648 \u062C\u0631\u0627\u0645", "kilo", "kg"],
    symbolAr: "\u0643\u062C\u0645",
    type: "weight",
    toBase: 1,
    baseUnitId: "kg",
    equivalentStandard: "1000 \u062C\u0631\u0627\u0645"
  },
  {
    id: "ratl",
    nameAr: "\u0631\u0637\u0644",
    aliases: ["\u0631\u0637\u0644", "\u0631\u0637\u0644\u0647", "\u0631\u0637\u0644\u064A\u0646", "\u0623\u0631\u0637\u0627\u0644", "\u0627\u0631\u0637\u0627\u0644", "\u0631\u0637\u0644 \u0648\u0646\u0635"],
    symbolAr: "\u0631\u0637\u0644",
    type: "weight",
    // العرف السوداني: الرطل = 450 جرام
    toBase: 0.45,
    baseUnitId: "kg",
    equivalentStandard: "450 \u062C\u0631\u0627\u0645 \u062A\u0642\u0631\u064A\u0628\u0627\u064B"
  },
  {
    id: "ouqya",
    nameAr: "\u0623\u0648\u0642\u064A\u0629",
    aliases: ["\u0623\u0648\u0642\u064A\u0629", "\u0648\u0642\u064A\u0629", "\u0623\u0648\u0627\u0642\u064A", "\u0627\u0648\u0642\u064A\u0647", "\u0648\u0642\u064A\u0647", "\u0623\u0648\u0642\u064A\u0627\u062A"],
    symbolAr: "\u0648\u0642\u064A\u0629",
    type: "weight",
    toBase: 0.0375,
    baseUnitId: "kg",
    equivalentStandard: "37.5 \u062C\u0631\u0627\u0645"
  },
  {
    id: "ton",
    nameAr: "\u0637\u0646",
    aliases: ["\u0637\u0646", "\u0637\u0646\u064A\u0646", "\u0623\u0637\u0646\u0627\u0646", "\u0627\u0637\u0646\u0627\u0646"],
    symbolAr: "\u0637\u0646",
    type: "weight",
    toBase: 1e3,
    baseUnitId: "kg",
    equivalentStandard: "1000 \u0643\u062C\u0645"
  },
  {
    id: "liter",
    nameAr: "\u0644\u062A\u0631",
    aliases: ["\u0644\u062A\u0631", "\u0644\u062A\u0631\u0627\u062A", "\u0644\u062A\u0631\u064A\u0646", "liter", "l"],
    symbolAr: "\u0644\u062A\u0631",
    type: "volume",
    toBase: 1,
    baseUnitId: "liter",
    equivalentStandard: "1000 \u0645\u0644"
  },
  {
    id: "jirkana",
    nameAr: "\u062C\u0631\u0643\u0627\u0646\u0629",
    aliases: ["\u062C\u0631\u0643\u0627\u0646\u0629", "\u062C\u0631\u0643\u0627\u0646\u0647", "\u0628\u0627\u063A\u0629", "\u0628\u0627\u0642\u0647", "\u0628\u0627\u063A\u0647", "\u062C\u0631\u0627\u0643\u0646"],
    symbolAr: "\u062C\u0631\u0643\u0627\u0646\u0629",
    type: "volume",
    // الغالب في السوق: جركانة زيت 4 لتر
    toBase: 4,
    baseUnitId: "liter",
    equivalentStandard: "4 \u0644\u062A\u0631 (\u0628\u0627\u063A\u0629 \u0632\u064A\u062A)"
  },
  {
    id: "piece",
    nameAr: "\u062D\u0628\u0629",
    aliases: ["\u062D\u0628\u0629", "\u062D\u0628\u0647", "\u0642\u0637\u0639\u0629", "\u0642\u0637\u0639\u0647", "\u062D\u0628\u0627\u062A", "\u0642\u0637\u0639", "\u0648\u0627\u062D\u062F\u0629", "\u0648\u062D\u062F\u0629"],
    symbolAr: "\u062D\u0628\u0629",
    type: "count",
    toBase: 1,
    baseUnitId: "piece",
    equivalentStandard: "\u0642\u0637\u0639\u0629 \u0648\u0627\u062D\u062F\u0629"
  },
  {
    id: "dasta",
    nameAr: "\u062F\u0633\u062A\u0629",
    aliases: ["\u062F\u0633\u062A\u0629", "\u062F\u0633\u062A\u0647", "\u062F\u0633\u062A\u062A\u064A\u0646", "\u062F\u0633\u062A\u0627\u062A", "\u062F\u0632\u064A\u0646\u0629", "\u062F\u0631\u0632\u0646"],
    symbolAr: "\u062F\u0633\u062A\u0629",
    type: "count",
    toBase: 12,
    baseUnitId: "piece",
    equivalentStandard: "12 \u062D\u0628\u0629"
  },
  {
    id: "kartona",
    nameAr: "\u0643\u0631\u062A\u0648\u0646\u0629",
    aliases: ["\u0643\u0631\u062A\u0648\u0646\u0629", "\u0643\u0631\u062A\u0648\u0646\u0647", "\u0643\u0631\u0627\u062A\u064A\u0646", "\u0628\u0627\u0643\u062A", "\u0628\u0627\u0643\u062A\u064A\u0646", "\u0628\u0627\u0643\u062A\u0627\u062A", "\u0628\u0627\u0631\u0633\u0644"],
    symbolAr: "\u0643\u0631\u062A\u0648\u0646\u0629",
    type: "count",
    // افتراضي متحفظ: 12 حبة — التاجر يقدر يحدد سعراً مخصصاً للكرتونة
    toBase: 12,
    baseUnitId: "piece",
    equivalentStandard: "12 \u062D\u0628\u0629 (\u0627\u0641\u062A\u0631\u0627\u0636\u064A)"
  },
  {
    id: "gawal",
    nameAr: "\u062C\u0648\u0627\u0644",
    aliases: ["\u062C\u0648\u0627\u0644", "\u062C\u0648\u0627\u0644\u064A\u0646", "\u0634\u0643\u0627\u0631\u0629", "\u0634\u0643\u0627\u0631\u0647", "\u0634\u0648\u0627\u0644", "\u0634\u0648\u0627\u0644\u0627\u062A", "\u062C\u0648\u0627\u0644\u064A"],
    symbolAr: "\u062C\u0648\u0627\u0644",
    type: "weight",
    toBase: 50,
    baseUnitId: "kg",
    equivalentStandard: "50 \u0643\u062C\u0645 (\u0633\u0643\u0631/\u062F\u0642\u064A\u0642)"
  },
  {
    id: "rabta",
    nameAr: "\u0631\u0628\u0637\u0629",
    aliases: ["\u0631\u0628\u0637\u0629", "\u0631\u0628\u0637\u0647", "\u0631\u0628\u0637\u0627\u062A", "\u062D\u0632\u0645\u0629", "\u062D\u0632\u0645\u0647"],
    symbolAr: "\u0631\u0628\u0637\u0629",
    type: "count",
    toBase: 1,
    baseUnitId: "piece",
    equivalentStandard: "\u062D\u0632\u0645\u0629 \u0645\u062C\u0645\u0639\u0629"
  },
  {
    id: "kouz",
    nameAr: "\u0643\u0648\u0632",
    aliases: ["\u0643\u0648\u0632", "\u0643\u0648\u0632\u064A\u0646", "\u0645\u0643\u064A\u0627\u0644", "\u0645\u0643\u064A\u0627\u0644\u064A\u0646", "\u0642\u062F\u062D"],
    symbolAr: "\u0643\u0648\u0632",
    type: "volume",
    toBase: 1,
    baseUnitId: "liter",
    equivalentStandard: "\u0645\u0643\u064A\u0627\u0644 \u062A\u0642\u0644\u064A\u062F\u064A \u0644\u0644\u062D\u0628\u0648\u0628"
  }
];
function normalizeArabic(input) {
  return (input || "").replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "\u0627").replace(/ى/g, "\u064A").replace(/ؤ/g, "\u0648").replace(/ئ/g, "\u064A").replace(/ة/g, "\u0647").replace(/\s+/g, " ").trim().toLowerCase();
}
function normalizeDigits(input) {
  const arabic = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669";
  return (input || "").replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));
}
function findUnitInText(text2) {
  const norm = normalizeArabic(normalizeDigits(text2));
  const sorted = [...SUDANESE_UNITS].sort((a, b) => b.nameAr.length - a.nameAr.length);
  for (const unit of sorted) {
    for (const alias of [unit.nameAr, ...unit.aliases]) {
      const needle = normalizeArabic(alias);
      if (!needle) continue;
      if (norm.includes(needle)) return unit;
    }
  }
  return null;
}
function resolveProductBaseUnit(productUnit) {
  const found = findUnitInText(productUnit);
  if (found) return found;
  return SUDANESE_UNITS.find((u) => u.id === "piece");
}
function priceForUnit(basePrice, productUnit, targetUnitId, quantity = 1) {
  const base = resolveProductBaseUnit(productUnit);
  const target = SUDANESE_UNITS.find((u) => u.id === targetUnitId) || base;
  if (base.baseUnitId !== target.baseUnitId) {
    return {
      unitPrice: basePrice,
      quantityInBaseUnits: quantity,
      baseUnit: base,
      ok: false,
      explanation: `\u0627\u0644\u0648\u062D\u062F\u0629 \xAB${target.nameAr}\xBB \u0644\u0627 \u062A\u064F\u0642\u0627\u0633 \u0628\u0646\u0641\u0633 \u0648\u062D\u062F\u0629 \u0627\u0644\u0635\u0646\u0641 \xAB${base.nameAr}\xBB \u2014 \u064A\u062D\u062A\u0627\u062C \u0633\u0639\u0631\u0627\u064B \u0645\u062E\u0635\u0635\u0627\u064B.`
    };
  }
  const pricePerBase = basePrice / base.toBase;
  const raw = pricePerBase * target.toBase;
  const unitPrice = raw >= 100 ? Math.round(raw) : Math.round(raw * 100) / 100;
  return {
    unitPrice,
    quantityInBaseUnits: Math.round(target.toBase * quantity * 1e3) / 1e3,
    baseUnit: base,
    ok: true,
    explanation: target.id === base.id ? `${quantity} ${target.symbolAr} \xD7 ${unitPrice.toLocaleString()} \u062C.\u0633` : `${quantity} ${target.symbolAr} = ${Math.round(target.toBase * quantity * 1e3) / 1e3} ${base.symbolAr} \xD7 \u0627\u0644\u0633\u0639\u0631 \u27F9 ${unitPrice.toLocaleString()} \u062C.\u0633 \u0644\u0644\u0640${target.symbolAr}`
  };
}

// src/lib/sudaneseSpeech.ts
var NUMBER_WORDS = {
  \u0648\u0627\u062D\u062F: 1,
  \u0648\u0627\u062D\u062F\u0647: 1,
  \u0627\u062A\u0646\u064A\u0646: 2,
  \u0627\u062B\u0646\u064A\u0646: 2,
  \u062A\u0646\u064A\u0646: 2,
  \u062A\u0644\u0627\u062A\u0647: 3,
  \u062B\u0644\u0627\u062B\u0647: 3,
  \u062A\u0644\u0627\u062A\u0629: 3,
  \u0627\u0631\u0628\u0639\u0647: 4,
  \u0627\u0631\u0628\u0639\u0629: 4,
  \u062E\u0645\u0633\u0647: 5,
  \u062E\u0645\u0633\u0629: 5,
  \u0633\u062A\u0647: 6,
  \u0633\u062A\u0629: 6,
  \u0633\u0628\u0639\u0647: 7,
  \u0633\u0628\u0639\u0629: 7,
  \u062A\u0645\u0627\u0646\u064A\u0647: 8,
  \u062B\u0645\u0627\u0646\u064A\u0647: 8,
  \u062B\u0645\u0627\u0646\u064A\u0629: 8,
  \u062A\u0633\u0639\u0647: 9,
  \u062A\u0633\u0639\u0629: 9,
  \u0639\u0634\u0631\u0647: 10,
  \u0639\u0634\u0631\u0629: 10,
  \u0627\u062A\u0646\u0627\u0634\u0631: 12,
  \u0627\u062A\u0646\u0639\u0634\u0631: 12,
  \u0639\u0634\u0631\u064A\u0646: 20,
  "\u062E\u0645\u0633\u0647 \u0648\u0639\u0634\u0631\u064A\u0646": 25,
  \u0646\u0635: 0.5,
  \u0646\u0635\u0641: 0.5,
  \u0631\u0628\u0639: 0.25,
  \u062A\u0645\u0646: 0.125,
  "\u062A\u0644\u0627\u062A\u0647 \u062A\u0631\u0628\u0627\u0639": 0.75
};
var FILLER_WORDS = [
  "\u0628\u0639\u062A",
  "\u0628\u0639\u0646\u0627",
  "\u0633\u062C\u0644",
  "\u0627\u0636\u0641",
  "\u0627\u0639\u0645\u0644 \u0641\u0627\u062A\u0648\u0631\u0647",
  "\u0641\u0627\u062A\u0648\u0631\u0647",
  "\u0646\u0632\u0644 \u0644\u064A",
  "\u062C\u064A\u0628 \u0644\u064A",
  "\u0647\u0627\u062A",
  "\u0639\u0627\u064A\u0632",
  "\u0639\u0627\u0648\u0632",
  "\u0645\u0646 \u0641\u0636\u0644\u0643",
  "\u0644\u0648 \u0633\u0645\u062D\u062A",
  "\u0643\u0645\u0627\u0646",
  "\u0628\u0633",
  "\u0645\u0639\u0627\u064A",
  "\u0644\u0644\u0639\u0645\u064A\u0644",
  "\u0644\u0644\u0632\u0648\u0644"
];
var NON_PRODUCT_WORDS = [
  "\u0643\u0627\u0634",
  "\u0646\u0642\u062F\u0627",
  "\u0628\u0646\u0643\u0643",
  "\u0641\u0648\u0631\u064A",
  "\u0628\u0646\u0643 \u0641\u064A\u0635\u0644",
  "\u0628\u0646\u0643 \u0627\u0644\u062E\u0631\u0637\u0648\u0645",
  "\u062E\u0635\u0645",
  "\u0627\u062C\u0644",
  "\u062F\u064A\u0646",
  "\u0639\u0644\u064A \u0627\u0644\u062D\u0633\u0627\u0628",
  "\u0639\u0644\u0649 \u0627\u0644\u062D\u0633\u0627\u0628",
  "\u062A\u062D\u0648\u064A\u0644"
];
function cleanClause(clause) {
  let out = ` ${normalizeArabic(clause)} `;
  for (const filler of FILLER_WORDS) {
    out = out.replace(new RegExp(`(^|\\s)${normalizeArabic(filler)}(\\s|$)`, "g"), " ");
  }
  return out.replace(/\s+/g, " ").trim();
}
function nameTokens(name) {
  return normalizeArabic(name).split(/[\s/|,.\-()]+/).map((t) => t.replace(/^ال/, "")).filter((t) => t.length >= 3);
}
function matchProduct(clause, products) {
  const norm = normalizeArabic(normalizeDigits(clause));
  for (const p of products) {
    if (p.barcode && norm.includes(normalizeArabic(p.barcode))) return { product: p, confidence: 0.99 };
    if (p.sku && norm.includes(normalizeArabic(p.sku))) return { product: p, confidence: 0.97 };
  }
  let best = null;
  let bestScore = 0;
  let bestHits = 0;
  for (const p of products) {
    const tokens = nameTokens(p.name);
    if (!tokens.length) continue;
    let hits = 0;
    for (const t of tokens) if (norm.includes(t)) hits += 1;
    if (!hits) continue;
    let score = hits / tokens.length;
    if (norm.includes(normalizeArabic(p.name))) score = 1.2;
    if (nameTokens(p.category || "").some((t) => norm.includes(t))) score += 0.05;
    if (score > bestScore || score === bestScore && hits > bestHits) {
      bestScore = score;
      bestHits = hits;
      best = p;
    }
  }
  if (best && bestScore >= 0.3) {
    return { product: best, confidence: Math.min(0.96, 0.55 + Math.min(bestScore, 1) * 0.4) };
  }
  return { product: null, confidence: 0 };
}
function parseQuantity(clause) {
  const norm = normalizeArabic(normalizeDigits(clause));
  const digit = norm.match(/(\d+(?:\.\d+)?)/);
  if (digit) return { quantity: parseFloat(digit[1]), explicit: true };
  if (/ونص|و نص/.test(norm) && findUnitInText(norm)) return { quantity: 1.5, explicit: true };
  const words = Object.entries(NUMBER_WORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [word, value] of words) {
    if (norm.includes(normalizeArabic(word))) return { quantity: value, explicit: true };
  }
  if (/ونص|و نص/.test(norm)) return { quantity: 1.5, explicit: true };
  return { quantity: 1, explicit: false };
}
function parseSudaneseSale(text2, products) {
  const raw = normalizeDigits(text2 || "").trim();
  const normalizedText = normalizeArabic(raw);
  let paymentMethod = "cash";
  if (/بنكك|بنك الخرطوم|تحويل بنكي|ابلكيشن بنكك/.test(normalizedText)) paymentMethod = "bankak";
  else if (/فوري|بنك فيصل/.test(normalizedText)) paymentMethod = "fawry";
  else if (/اجل|دين|علي الحساب|على الحساب|شكك|شيك/.test(normalizedText)) paymentMethod = "credit";
  const customerMatch = normalizedText.match(/(?:للعميل|للزول|للأستاذ|للاستاذ|لعم|لـ|ل)\s+([^\s,،]+)/);
  const customerName = customerMatch && customerMatch[1] && customerMatch[1].length > 1 ? customerMatch[1] : null;
  let discountAmount = 0;
  let discountPercent = 0;
  const percentMatch = normalizedText.match(/خصم\s*(\d+(?:\.\d+)?)\s*(?:%|في الميه|بالميه|بالمئه)/);
  const amountMatch = normalizedText.match(/خصم\s*(\d+(?:\.\d+)?)/);
  if (percentMatch) discountPercent = parseFloat(percentMatch[1]);
  else if (amountMatch) discountAmount = parseFloat(amountMatch[1]);
  const guarded = normalizedText.replace(/خصم\s*\d+(?:\.\d+)?\s*(?:%|في الميه|بالميه|بالمئه)?/g, " ").replace(/\s*و\s*نص(ف)?/g, " \xA7\u0646\u0635");
  const clauses = guarded.split(/,|،|\s+ثم\s+|\s+و\s+|\s+و(?=[^\s])/g).map((c) => c.replace(/§نص/g, "\u0648\u0646\u0635").trim()).filter(Boolean);
  const mergedClauses = [];
  for (const part of clauses) {
    const isFraction = /^(نص|نصف|ربع|تمن|تلاته ترباع)$/.test(normalizeArabic(part));
    if (isFraction && mergedClauses.length) {
      mergedClauses[mergedClauses.length - 1] = `${mergedClauses[mergedClauses.length - 1]} \u0648\u0646\u0635`;
    } else {
      mergedClauses.push(part);
    }
  }
  const lines = [];
  const clarifications = [];
  for (const clause of mergedClauses) {
    const cleaned = cleanClause(clause);
    if (!cleaned || cleaned.length < 2) continue;
    if (NON_PRODUCT_WORDS.some((w) => cleaned.includes(normalizeArabic(w))) && cleaned.length <= 14) continue;
    if (/داك|داكا|ديك|الحاجه دي|الشي دا|خمسه من داك/.test(cleaned)) {
      clarifications.push({
        phrase: clause,
        reason: "\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641 \u0645\u0628\u0647\u0645 \u2014 \u0642\u0644 \u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641 \u0646\u0641\u0633\u0647.",
        suggestions: products.slice(0, 4)
      });
      continue;
    }
    const { product, confidence } = matchProduct(cleaned, products);
    if (!product) {
      if (cleaned.length > 2) {
        clarifications.push({
          phrase: clause,
          reason: "\u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0645\u062E\u0632\u0648\u0646\u0643 \u0623\u0648 \u0627\u0644\u0627\u0633\u0645 \u063A\u064A\u0631 \u0648\u0627\u0636\u062D.",
          suggestions: products.slice(0, 4)
        });
      }
      continue;
    }
    const { quantity } = parseQuantity(cleaned);
    const spokenUnit = findUnitInText(cleaned);
    const baseUnit = resolveProductBaseUnit(product.unit);
    const unit = spokenUnit || baseUnit;
    const priced = priceForUnit(product.sellingPriceSdg, product.unit, unit.id, quantity);
    if (!priced.ok) {
      clarifications.push({
        phrase: clause,
        reason: `\u0627\u0644\u0635\u0646\u0641 \xAB${product.name}\xBB \u0645\u0633\u0639\u0651\u0631 \u0628\u0640${baseUnit.nameAr}\u060C \u0641\u0645\u0627 \u064A\u0646\u0641\u0639 \u0646\u0628\u064A\u0639\u0647 \u0628\u0640${unit.nameAr} \u0628\u062F\u0648\u0646 \u0633\u0639\u0631 \u0645\u062E\u0635\u0635.`,
        suggestions: [product]
      });
      continue;
    }
    lines.push({
      product,
      spokenName: cleaned,
      quantity,
      unitId: unit.id,
      unitName: unit.symbolAr,
      unitPrice: priced.unitPrice,
      confidence,
      note: priced.explanation
    });
  }
  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const summary = lines.length ? `\u062A\u0645 \u0627\u0644\u062A\u0639\u0631\u0641 \u0639\u0644\u0649 ${lines.length} \u0635\u0646\u0641 \u0628\u0625\u062C\u0645\u0627\u0644\u064A ${Math.round(total).toLocaleString()} \u062C.\u0633${discountAmount || discountPercent ? ` (\u062E\u0635\u0645 ${discountAmount || `${discountPercent}%`})` : ""}` : "\u0645\u0627 \u062A\u0639\u0631\u0651\u0641\u0646\u0627 \u0639\u0644\u0649 \u0623\u064A \u0635\u0646\u0641 \u2014 \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0623\u0648 \u0627\u062E\u062A\u0631 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u064A\u062F\u0648\u064A\u0627\u064B.";
  return {
    lines,
    clarifications,
    paymentMethod,
    discountAmount,
    discountPercent,
    customerName,
    summary,
    normalizedText
  };
}

// src/server/rates.ts
var SOURCE_URL = "https://www.alsoug.com/currency";
var SOURCE_NAME = "\u0633\u0648\u0642 \u0627\u0644\u0633\u0648\u062F\u0627\u0646 (alsoug.com)";
var CODE_BY_LABEL = [
  { match: /دولار\s*الامريكي|دولار\s*الأمريكي|USD/i, code: "USD" },
  { match: /درهم\s*الاماراتي|درهم\s*الإماراتي|AED/i, code: "AED" },
  { match: /يورو|EUR/i, code: "EUR" },
  { match: /ريال\s*السعودي|SAR/i, code: "SAR" },
  { match: /جنيه\s*المصري|EGP/i, code: "EGP" },
  { match: /ريال\s*القطري|QAR/i, code: "QAR" },
  { match: /جنيه\s*الاسترليني|GBP/i, code: "GBP" }
];
var toNumber = (raw) => {
  let s = String(raw || "").trim();
  if (!s) return null;
  if (/,\d{1,2}$/.test(s) && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};
var extractTableRows = (html) => {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while (m = rowRe.exec(html)) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (c) => c[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim()
    );
    if (cells.length >= 2) rows.push(cells.join("|"));
  }
  return rows;
};
var parseAlsougRates = (html) => {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of extractTableRows(html)) {
    const cells = row.split("|");
    const label = cells[0] || "";
    const hit = CODE_BY_LABEL.find((c) => c.match.test(label));
    if (!hit || seen.has(hit.code)) continue;
    const numbers = cells.slice(1).map((c) => (c.match(/[\d][\d.,]*/g) || []).map(toNumber).filter((n) => n !== null)).filter((arr) => arr.length > 0);
    const official = numbers[0]?.[0] ?? null;
    const parallel = numbers[1]?.[0] ?? null;
    const ok = (n) => n !== null && n >= 1 && n < 1e6 ? n : null;
    if (ok(official) === null && ok(parallel) === null) continue;
    out.push({ code: hit.code, official: ok(official), parallel: ok(parallel) });
    seen.add(hit.code);
  }
  return out;
};
var AR_MONTHS = {
  \u064A\u0646\u0627\u064A\u0631: 0,
  \u0641\u0628\u0631\u0627\u064A\u0631: 1,
  \u0645\u0627\u0631\u0633: 2,
  \u0627\u0628\u0631\u064A\u0644: 3,
  \u0623\u0628\u0631\u064A\u0644: 3,
  \u0645\u0627\u064A\u0648: 4,
  \u064A\u0648\u0646\u064A\u0648: 5,
  \u064A\u0648\u0644\u064A\u0648: 6,
  \u0627\u063A\u0633\u0637\u0633: 7,
  \u0623\u063A\u0633\u0637\u0633: 7,
  \u0633\u0628\u062A\u0645\u0628\u0631: 8,
  \u0627\u0643\u062A\u0648\u0628\u0631: 9,
  \u0623\u0643\u062A\u0648\u0628\u0631: 9,
  \u0646\u0648\u0641\u0645\u0628\u0631: 10,
  \u062F\u064A\u0633\u0645\u0628\u0631: 11
};
var parseArabicPublishedAt = (text2) => {
  const m = text2.match(
    /(\d{1,2})\s+([\u0600-\u06FF]{3,10})\s*[،,]?\s*(\d{4})\s*(?:-|—|\|)?\s*(\d{1,2})[:.](\d{2})?\s*(صباح|مساء|ص|م)?/
  );
  if (!m) return void 0;
  const day = Number(m[1]);
  const month = AR_MONTHS[m[2].replace(/[^\u0621-\u064A]/g, "")];
  const year = Number(m[3]);
  if (month === void 0 || !day || !year) return void 0;
  let hour = Number(m[4] || 0);
  const minute = Number(m[5] || 0);
  const meridiem = m[6] || "";
  if ((meridiem === "\u0645\u0633\u0627\u0621" || meridiem === "\u0645") && hour < 12) hour += 12;
  if ((meridiem === "\u0635\u0628\u0627\u062D" || meridiem === "\u0635") && hour === 12) hour = 0;
  const utc = Date.UTC(year, month, day, hour - 2, minute);
  return new Date(utc).toISOString();
};
var htmlToText = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
var AR_LABEL_TO_CODE = [
  // NB: all groups are non-capturing — the captured number must stay at index 1
  /* «الدولار» وحدها كافية — المقال يكتب «سعر شراء الدولار» بلا صفة */
  { re: /(?:الدولار|دولار)(?:\s*(?:الأمريكي|الامريكي|الاميركي|الأميركي))?/i, code: "USD" },
  { re: /الريال\s*السعودي/i, code: "SAR" },
  { re: /الدرهم\s*(?:الإماراتي|الاماراتي)/i, code: "AED" },
  { re: /اليورو/i, code: "EUR" },
  { re: /(?:الجنيه|الجنية)\s*(?:المصري|المصرى)/i, code: "EGP" },
  { re: /الريال\s*القطري/i, code: "QAR" },
  { re: /(?:الجنيه|الجنية)\s*(?:الإسترليني|الاسترليني|الاسترلينى)/i, code: "GBP" },
  { re: /الريال\s*العماني/i, code: "OMR" },
  { re: /الدينار\s*الكويتي/i, code: "KWD" }
];
var buySellFor = (scope, label) => {
  const NUM = "([0-9][0-9,]{2,}(?:\\.[0-9]+)?)";
  const num = (x) => toNumber(x);
  const ok = (n) => n !== null && n >= 100 && n < 15e5;
  const sentences = scope.split(/[!؟\n]+|\.\s+/).map((x) => x.trim()).filter(Boolean);
  const trimComparison = (t) => t.split(/مقارنة|مقابل مستويات|التي بلغت|الأربعاء|السبت|أمس|سابق/)[0].trim();
  const current = sentences.map(trimComparison).filter(Boolean);
  const pools = [current, sentences];
  const attempts = [
    // «ارتفاع سعر شراء الدولار إلى 10300 جنيه، مقابل 10500 جنيه للبيع»
    (t) => {
      const m = t.match(
        new RegExp(
          `\u0634\u0631\u0627\u0621\\s*${label.source}[^.]{0,80}?${NUM}[^.]{0,120}?${NUM}\\s*(?:\u062C\u0646\u064A\u0647[\u0627\u064B]?)?\\s*\u0644\u0644\u0628\u064A\u0639`,
          "i"
        )
      );
      const a = num(m?.[1]);
      const b = num(m?.[2]);
      return ok(a) && ok(b) ? { buy: Math.min(a, b), sell: Math.max(a, b) } : null;
    },
    // «2745.64 جنيه للشراء و2798.96 جنيه للبيع» داخل جملة تخص العملة
    (t) => {
      if (!label.test(t)) return null;
      const m = t.match(
        new RegExp(`${NUM}\\s*(?:\u062C\u0646\u064A\u0647[\u0627\u064B]?)?\\s*\u0644\u0644\u0634\u0631\u0627\u0621\\s*\u0648\\s*${NUM}\\s*(?:\u062C\u0646\u064A\u0647[\u0627\u064B]?)?\\s*\u0644\u0644\u0628\u064A\u0639`, "i")
      );
      const a = num(m?.[1]);
      const b = num(m?.[2]);
      return ok(a) && ok(b) ? { buy: Math.min(a, b), sell: Math.max(a, b) } : null;
    },
    // «ارتفاع سعر بيع الدولار إلى 10500 جنيه» — سعر البيع وحده
    (t) => {
      if (!label.test(t)) return null;
      const m = t.match(
        new RegExp(`\u0628\u064A\u0639\\s*${label.source}[^.]{0,60}?(?:\u0625\u0644\u0649|\u0627\u0644\u0649)?\\s*${NUM}`, "i")
      );
      const sell = num(m?.[1]);
      return ok(sell) ? { buy: sell, sell } : null;
    },
    // «الدولار الأمريكي 10500 جنيه» — آخر ملاذ
    (t) => {
      if (!label.test(t)) return null;
      const m = t.match(new RegExp(`${label.source}\\s*(?:\u062C\u0646\u064A\u0647[\u0627\u064B]?)?\\s*${NUM}`, "i"));
      const v = num(m?.[1]);
      return ok(v) ? { buy: v, sell: v } : null;
    }
  ];
  for (const attempt of attempts) {
    for (const pool2 of pools) {
      for (const t of pool2) {
        const r = attempt(t);
        if (r) return r;
      }
    }
  }
  return null;
};
var parseSudanAkhbarArticle = (html) => {
  const text2 = htmlToText(html);
  const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const blockStart = text2.search(/متوسط\s*(اسعار|أسعار)\s*العملات/i);
  const scope = blockStart >= 0 ? text2.slice(blockStart) : text2;
  const rates = [];
  const seen = /* @__PURE__ */ new Set();
  const NUM = "([0-9][0-9,]{2,}(?:\\.[0-9]+)?)";
  const patternsFor = (source) => [
    {
      // «10200 جنيه للشراء و10393.1747 جنيه للبيع» → the sell price
      re: new RegExp(
        source + `\\s*(?:\u062C\u0646\u064A\u0647[\u0627\u064B]?)?\\s*${NUM}\\s*(?:\u062C\u0646\u064A\u0647[\u0627\u064B]?)?\\s*\u0644\u0644\u0634\u0631\u0627\u0621\\s*\u0648\\s*${NUM}\\s*(?:\u062C\u0646\u064A\u0647[\u0627\u064B]?)?\\s*\u0644\u0644\u0628\u064A\u0639`,
        "i"
      ),
      pick: 2
    },
    {
      // «10200 و10393 للبيع»
      re: new RegExp(
        source + `\\s*(?:\u062C\u0646\u064A\u0647[\u0627\u064B]?)?\\s*${NUM}\\s*(?:\u062C\u0646\u064A\u0647[\u0627\u064B]?)?\\s*\u0648\\s*${NUM}\\s*(?:\u062C\u0646\u064A\u0647[\u0627\u064B]?)?\\s*\u0644\u0644\u0628\u064A\u0639`,
        "i"
      ),
      pick: 2
    },
    {
      // «10393.1747 ( ارتفاع سعر متوسط )» → the market average table
      re: new RegExp(source + `\\s*${NUM}\\s*\\(\\s*(?:\u0627\u0631\u062A\u0641\u0627\u0639|\u0627\u0646\u062E\u0641\u0627\u0636)`),
      pick: 1
    },
    {
      // «13662.3000 جنيهاً للبيع»
      re: new RegExp(source + `\\s*${NUM}\\s*(?:\u062C\u0646\u064A\u0647[\u0627\u064B]?)?\\s*\u0644\u0644\u0628\u064A\u0639`),
      pick: 1
    },
    {
      // plain «الدولار الامريكي 10200 جنيها»
      re: new RegExp(source + `\\s*${NUM}`),
      pick: 1
    }
  ];
  for (const { re, code } of AR_LABEL_TO_CODE) {
    if (seen.has(code)) continue;
    let value = null;
    const bs = buySellFor(text2, re) || buySellFor(scope, re);
    if (bs) {
      rates.push({ code, official: null, parallel: bs.sell, buy: bs.buy, sell: bs.sell });
      seen.add(code);
      continue;
    }
    for (const { re: candidate, pick } of patternsFor(re.source)) {
      const m = scope.match(candidate) || text2.match(candidate);
      if (!m) continue;
      const parsedValue = toNumber(m[pick] ?? m[1]);
      if (parsedValue === null || parsedValue < 100 || parsedValue >= 15e5) continue;
      value = parsedValue;
      break;
    }
    if (value === null) continue;
    rates.push({ code, official: null, parallel: value });
    seen.add(code);
  }
  const publishedAt = parseArabicPublishedAt(text2.slice(0, Math.max(400, text2.indexOf("\u0645\u0635\u062F\u0631 \u0627\u0644\u062E\u0628\u0631") + 200))) || parseArabicPublishedAt(text2);
  return { rates, publishedAt, title: title || void 0 };
};
var BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ar,en-US;q=0.7,en;q=0.6",
  Referer: "https://www.google.com/",
  "Cache-Control": "no-cache"
};
var SUDANAKHBAR_HOME = "https://www.sudanakhbar.com/business-news/currency-rates-prices";
var READER = (url) => `https://r.jina.ai/${url}`;
var fetchViaReader = async (url, timeoutMs = 14e3) => {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs);
    const res = await fetch(READER(url), {
      signal: c.signal,
      headers: { Accept: "text/plain", "X-Return-Format": "text" }
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const text2 = await res.text();
    return text2.length > 200 ? text2 : null;
  } catch {
    return null;
  }
};
var fetchSudanAkhbarViaReader = async (diag = []) => {
  for (const q2 of ["\u0633\u0639\u0631 \u0627\u0644\u062F\u0648\u0644\u0627\u0631", "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u0632\u064A"]) {
    const raw = await fetchViaReader(
      `https://www.sudanakhbar.com/wp-json/wp/v2/posts?search=${encodeURIComponent(q2)}&per_page=5&_fields=id,date_gmt,link,title,content`
    );
    if (!raw) {
      diag.push({ method: `reader:wp-json:${q2}`, ok: false, detail: "proxy unavailable" });
      continue;
    }
    try {
      const start = raw.indexOf("[");
      const posts = JSON.parse(raw.slice(start));
      const picked = pickArticleFromPosts(posts, `reader:wp-json:${q2}`, diag);
      if (picked) return picked;
    } catch {
      diag.push({ method: `reader:wp-json:${q2}`, ok: false, detail: "unparseable json" });
    }
  }
  const listing = await fetchViaReader(SUDANAKHBAR_HOME);
  if (!listing) {
    diag.push({ method: "reader:listing", ok: false, detail: "proxy unavailable" });
    return null;
  }
  const linkRe = /(https:\/\/www\.sudanakhbar\.com\/\d{6,})/g;
  const seen = /* @__PURE__ */ new Set();
  const candidates = [];
  let m;
  while ((m = linkRe.exec(listing)) && candidates.length < 6) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      candidates.push(m[1]);
    }
  }
  const compact = listing.replace(/\s+/g, " ");
  const ranked = candidates.sort((a, b) => {
    const near = (u) => {
      const i = compact.indexOf(u);
      const window = i >= 0 ? compact.slice(i, i + 260) : "";
      return /السوق السوداء|الموازي|سعر الدولار/.test(window) ? 0 : 1;
    };
    return near(a) - near(b);
  });
  for (const url of ranked.slice(0, 3)) {
    const article = await fetchViaReader(url);
    if (!article) {
      diag.push({ method: "reader:article", ok: false, detail: url });
      continue;
    }
    const parsed = parseSudanAkhbarArticle(article);
    if (parsed.rates.length < 3) {
      diag.push({ method: "reader:article", ok: false, detail: "no rate table" });
      continue;
    }
    diag.push({ method: "reader:article", ok: true, detail: `${parsed.rates.length} rates` });
    return { rates: parsed.rates, publishedAt: parsed.publishedAt, title: parsed.title, url };
  }
  return null;
};
var pickArticleFromPosts = (posts, method, diag) => {
  for (const post of posts) {
    const title = String(post?.title?.rendered || "").replace(/<[^>]+>/g, " ").trim();
    const html = String(post?.content?.rendered || "");
    const parsed = parseSudanAkhbarArticle(html);
    if (parsed.rates.length < 3) continue;
    const publishedAt = post?.date_gmt ? (/* @__PURE__ */ new Date(`${post.date_gmt}Z`)).toISOString() : parsed.publishedAt;
    diag.push({ method, ok: true, detail: `${parsed.rates.length} rates \xB7 ${post?.link || ""}` });
    return { rates: parsed.rates, publishedAt, title: title || void 0, url: post?.link };
  }
  diag.push({ method, ok: false, detail: "no post with a rate table" });
  return null;
};
var fetchSudanAkhbarViaApi = async (diag) => {
  const queries = ["\u0633\u0639\u0631 \u0627\u0644\u062F\u0648\u0644\u0627\u0631", "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u0632\u064A", "\u0627\u0644\u0639\u0645\u0644\u0627\u062A"];
  for (const q2 of queries) {
    try {
      const url = `https://www.sudanakhbar.com/wp-json/wp/v2/posts?search=${encodeURIComponent(q2)}&per_page=5&_fields=id,date,date_gmt,link,title,content`;
      let posts = null;
      for (const attempt of [1, 2]) {
        try {
          const c = new AbortController();
          const t = setTimeout(() => c.abort(), 8e3);
          const res = await fetch(url, { signal: c.signal, headers: BROWSER_HEADERS });
          clearTimeout(t);
          if (res.ok) {
            posts = await res.json().catch(() => null);
            if (Array.isArray(posts) && posts.length) break;
          } else {
            diag.push({ method: `wp-json:${q2}#${attempt}`, ok: false, detail: `HTTP ${res.status}` });
          }
        } catch (err) {
          diag.push({ method: `wp-json:${q2}#${attempt}`, ok: false, detail: err.name });
        }
        if (attempt === 1) await new Promise((r) => setTimeout(r, 400));
      }
      if (!posts || !posts.length) {
        const raw = await fetchViaReader(url, 12e3);
        if (raw) {
          const a = raw.indexOf("[");
          const b = raw.lastIndexOf("]");
          if (a >= 0 && b > a) {
            try {
              posts = JSON.parse(raw.slice(a, b + 1));
            } catch {
              posts = null;
            }
          }
        }
      }
      if (!posts || !posts.length) {
        diag.push({ method: `wp-json:${q2}`, ok: false, detail: "empty list" });
        continue;
      }
      if (!Array.isArray(posts) || !posts.length) {
        diag.push({ method: `wp-json:${q2}`, ok: false, detail: "empty list" });
        continue;
      }
      const marketScore = (p) => {
        const t = String(p?.title?.rendered || "");
        if (/السوق\s*(الموازي|السوداء)/.test(t)) return 0;
        if (/الدولار|العملات/.test(t)) return 1;
        return 2;
      };
      const sorted = [...posts].sort(
        (a, b) => marketScore(a) - marketScore(b) || Date.parse(b?.date_gmt || 0) - Date.parse(a?.date_gmt || 0)
      );
      const currencyPosts = sorted.filter((p) => {
        const t = String(p?.title?.rendered || "");
        const isCurrency = /(العملات|الدولار|السوق\s*(الموازي|السوداء)|اسعار|أسعار)/.test(t);
        const isBankOnly = /بنوك|مصارف/.test(t) && !/الموازي|السوداء/.test(t);
        return isCurrency && !isBankOnly;
      });
      const picked = pickArticleFromPosts(currencyPosts.length ? currencyPosts : sorted, `wp-json:${q2}`, diag) || null;
      if (picked) return picked;
    } catch (err) {
      diag.push({ method: `wp-json:${q2}`, ok: false, detail: err.name });
    }
  }
  return null;
};
var ARTICLE_TTL_MS = 5 * 60 * 1e3;
var articleCache = null;
var fetchSudanAkhbarArticle = async (diag = []) => {
  if (articleCache && Date.now() - articleCache.at < ARTICLE_TTL_MS) {
    if (articleCache.value) diag.push({ method: "cache", ok: true, detail: "article cached" });
    return articleCache.value;
  }
  const store = (value) => {
    articleCache = { at: Date.now(), value };
    return value;
  };
  const viaApi = await fetchSudanAkhbarViaApi(diag);
  if (viaApi) return store(viaApi);
  try {
    const c1 = new AbortController();
    const t1 = setTimeout(() => c1.abort(), 9e3);
    const listing = await fetch(SUDANAKHBAR_HOME, { signal: c1.signal, headers: BROWSER_HEADERS });
    clearTimeout(t1);
    if (!listing.ok) {
      diag.push({ method: "listing", ok: false, detail: `HTTP ${listing.status}` });
      return store(await fetchSudanAkhbarViaReader(diag));
    }
    const html = await listing.text();
    const linkRe = /href="(https:\/\/www\.sudanakhbar\.com\/\d{6,})"[^>]*>([^<]{10,200})</g;
    const candidates = [];
    let m;
    while (m = linkRe.exec(html)) {
      if (/السوق السوداء|الموازي|سعر الدولار|العملات/.test(m[2])) {
        candidates.push({ url: m[1], title: m[2].trim() });
        if (candidates.length >= 3) break;
      }
    }
    if (!candidates.length) {
      diag.push({ method: "listing", ok: false, detail: "no matching article links" });
      return store(await fetchSudanAkhbarViaReader(diag));
    }
    for (const candidate of candidates) {
      const c2 = new AbortController();
      const t2 = setTimeout(() => c2.abort(), 9e3);
      const article = await fetch(candidate.url, { signal: c2.signal, headers: BROWSER_HEADERS });
      clearTimeout(t2);
      if (!article.ok) {
        diag.push({ method: "article", ok: false, detail: `HTTP ${article.status}` });
        continue;
      }
      const parsed = parseSudanAkhbarArticle(await article.text());
      if (parsed.rates.length < 3) {
        diag.push({ method: "article", ok: false, detail: "no rate table" });
        continue;
      }
      diag.push({ method: "article", ok: true, detail: `${parsed.rates.length} rates` });
      return store({
        rates: parsed.rates,
        publishedAt: parsed.publishedAt,
        title: parsed.title || candidate.title,
        url: candidate.url
      });
    }
    return store(await fetchSudanAkhbarViaReader(diag));
  } catch (err) {
    diag.push({ method: "listing", ok: false, detail: err.name });
    return store(null);
  }
};
var fetchSudanAkhbarRates = async () => {
  const article = await fetchSudanAkhbarArticle();
  return article ? article.rates.filter((r) => r.parallel !== null && r.parallel >= 100) : [];
};
var fetchLiveRates = async () => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9e3);
    const res = await fetch(SOURCE_URL, { signal: controller.signal, headers: BROWSER_HEADERS });
    clearTimeout(timer);
    if (res.ok) {
      const html = await res.text();
      const rates = parseAlsougRates(html);
      if (rates.length) {
        return {
          rates,
          source: SOURCE_NAME,
          sourceUrl: SOURCE_URL,
          fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
          stale: false
        };
      }
    }
  } catch {
  }
  const backup = await fetchSudanAkhbarRates();
  if (backup.length) {
    return {
      rates: backup,
      source: BACKUP_SOURCE_NAME,
      sourceUrl: SUDANAKHBAR_HOME,
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
      stale: false
    };
  }
  return null;
};
var fetchSudanAkhbarSnapshot = async (diag = []) => {
  const article = await fetchSudanAkhbarArticle(diag);
  if (!article?.rates.length) return null;
  return {
    rates: article.rates.filter((r) => r.parallel !== null && r.parallel >= 100),
    source: BACKUP_SOURCE_NAME,
    sourceUrl: article.url || SUDANAKHBAR_HOME,
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    stale: false,
    sourceUpdatedAt: article.publishedAt,
    sourceTitle: article.title
  };
};
var fetchAlsougSnapshot = async () => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9e3);
    const res = await fetch(SOURCE_URL, { signal: controller.signal, headers: BROWSER_HEADERS });
    clearTimeout(timer);
    if (!res.ok) return null;
    const rates = parseAlsougRates(await res.text());
    if (!rates.length) return null;
    return {
      rates,
      source: SOURCE_NAME,
      sourceUrl: SOURCE_URL,
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
      stale: false
    };
  } catch {
    return null;
  }
};
var cleanHtml = (t) => String(t || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#8217;|&rsquo;/g, "\u2019").replace(/\s+/g, " ").trim();
var fetchSudanAkhbarNews = async (limit = 6) => {
  const endpoints = [
    `https://www.sudanakhbar.com/wp-json/wp/v2/posts?per_page=${limit}&_fields=id,date_gmt,link,title`,
    `https://www.sudanakhbar.com/wp-json/wp/v2/posts?categories=1&per_page=${limit}&_fields=id,date_gmt,link,title`
  ];
  for (const url of endpoints) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 6e3);
      const res = await fetch(url, { signal: c.signal, headers: BROWSER_HEADERS });
      clearTimeout(t);
      if (!res.ok) continue;
      const json = await res.json();
      const items = (Array.isArray(json) ? json : []).map((p) => ({
        title: cleanHtml(p?.title?.rendered || ""),
        url: p?.link,
        publishedAt: p?.date_gmt ? `${p.date_gmt}Z` : void 0
      })).filter((x) => x.title.length > 12);
      if (items.length) return items.slice(0, limit);
    } catch {
    }
  }
  try {
    const raw = await fetchViaReader(
      `https://www.sudanakhbar.com/wp-json/wp/v2/posts?per_page=${limit}&_fields=id,date_gmt,link,title`,
      12e3
    );
    if (raw) {
      const start = raw.indexOf("[");
      const end = raw.lastIndexOf("]");
      if (start >= 0 && end > start) {
        const json = JSON.parse(raw.slice(start, end + 1));
        const items = (Array.isArray(json) ? json : []).map((p) => ({
          title: cleanHtml(p?.title?.rendered || p?.title || ""),
          url: p?.link,
          publishedAt: p?.date_gmt ? `${p.date_gmt}Z` : void 0
        })).filter((x) => x.title.length > 12);
        if (items.length) return items.slice(0, limit);
      }
    }
  } catch {
  }
  return [];
};
var fetchAllSources = async (diag = []) => {
  const [primary, backup] = await Promise.all([
    fetchAlsougSnapshot().catch(() => null),
    fetchSudanAkhbarSnapshot(diag).catch(() => null)
  ]);
  return [primary, backup].filter(Boolean);
};
var MAX_AGE_HOURS = 36;
var ageHours = (iso) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 36e5;
};
var isStale = (iso) => {
  const h = ageHours(iso);
  return h === null ? true : h > MAX_AGE_HOURS;
};
var BACKUP_SOURCE_NAME = "\u0627\u062E\u0628\u0627\u0631 \u0627\u0644\u0633\u0648\u062F\u0627\u0646 (sudanakhbar.com)";
var RATES_SOURCE = {
  primary: { url: SOURCE_URL, name: SOURCE_NAME },
  backup: { url: SUDANAKHBAR_HOME, name: BACKUP_SOURCE_NAME }
};

// src/server/rateAnswer.ts
var AR_NAMES = {
  USD: "\u0627\u0644\u062F\u0648\u0644\u0627\u0631 \u0627\u0644\u0623\u0645\u0631\u064A\u0643\u064A",
  SAR: "\u0627\u0644\u0631\u064A\u0627\u0644 \u0627\u0644\u0633\u0639\u0648\u062F\u064A",
  AED: "\u0627\u0644\u062F\u0631\u0647\u0645 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A\u064A",
  EUR: "\u0627\u0644\u064A\u0648\u0631\u0648",
  EGP: "\u0627\u0644\u062C\u0646\u064A\u0647 \u0627\u0644\u0645\u0635\u0631\u064A",
  QAR: "\u0627\u0644\u0631\u064A\u0627\u0644 \u0627\u0644\u0642\u0637\u0631\u064A",
  TRY: "\u0627\u0644\u0644\u064A\u0631\u0629 \u0627\u0644\u062A\u0631\u0643\u064A\u0629",
  GBP: "\u0627\u0644\u062C\u0646\u064A\u0647 \u0627\u0644\u0625\u0633\u062A\u0631\u0644\u064A\u0646\u064A",
  OMR: "\u0627\u0644\u0631\u064A\u0627\u0644 \u0627\u0644\u0639\u0645\u0627\u0646\u064A",
  KWD: "\u0627\u0644\u062F\u064A\u0646\u0627\u0631 \u0627\u0644\u0643\u0648\u064A\u062A\u064A"
};
var CODE_ORDER = ["USD", "SAR", "AED", "EUR", "EGP", "QAR", "GBP", "OMR", "KWD", "TRY"];
var money = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
var sortRates = (rates) => [...rates].sort(
  (a, b) => (CODE_ORDER.indexOf(a.code) + 1 || 99) - (CODE_ORDER.indexOf(b.code) + 1 || 99)
);
var describeSourceDate = (iso, now = Date.now()) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tz = { timeZone: "Africa/Khartoum" };
  const time = d.toLocaleTimeString("ar-SD", { hour: "2-digit", minute: "2-digit", ...tz });
  const day = d.toLocaleDateString("ar-SD", { day: "numeric", month: "long", ...tz });
  const fmtDay = (x) => x.toLocaleDateString("en-CA", { timeZone: "Africa/Khartoum" });
  const sameDay = fmtDay(new Date(now)) === fmtDay(d);
  return `${day} ${time} (${sameDay ? "\u0627\u0644\u064A\u0648\u0645" : describeAgeAr(iso, now)})`;
};
var SOURCE_ALIASES = [
  { name: "alsoug", re: /alsoug|سوق\s*السودان|البديل/i },
  { name: "sudanakhbar", re: /أخبار\s*السودان|اخبار\s*السودان|سودان\s*أخبار|sudanakhbar/i }
];
var describeAgeAr = (iso, now = Date.now()) => {
  if (!iso) return "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641";
  const mins = Math.max(0, Math.round((now - t) / 6e4));
  const d = (n) => n.toLocaleString("ar-EG");
  if (mins < 1) return "\u0627\u0644\u0622\u0646";
  if (mins < 60) return `\u0642\u0628\u0644 ${d(mins)} \u062F\u0642\u064A\u0642\u0629`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours < 24) {
    const base = hours === 1 ? "\u0642\u0628\u0644 \u0633\u0627\u0639\u0629" : hours === 2 ? "\u0642\u0628\u0644 \u0633\u0627\u0639\u062A\u064A\u0646" : `\u0642\u0628\u0644 ${d(hours)} \u0633\u0627\u0639\u0627\u062A`;
    return rest ? `${base} \u0648${d(rest)} \u062F\u0642\u064A\u0642\u0629` : base;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return "\u0642\u0628\u0644 \u064A\u0648\u0645";
  if (days === 2) return "\u0642\u0628\u0644 \u064A\u0648\u0645\u064A\u0646";
  return `\u0642\u0628\u0644 ${d(days)} \u0623\u064A\u0627\u0645`;
};
var isRateQuery = (msg) => /سعر|أسعار|اسعار|سوق\s*(الموازي|الأسود|السوداء)|دولار|ريال|درهم|يورو|جنيه\s*مصري|ليرة|عملة|عملات|صرف|تحويل|بنكك\s*سعر/i.test(
  msg
) || asksForSources(msg);
var asksForSources = (msg) => {
  if (SOURCE_ALIASES.some((s) => s.re.test(msg))) return true;
  return /المصدرين|المصادر|قارن|مقارنة|كل\s*المصادر|الموقعين|التقارير/i.test(msg);
};
var sourcesWanted = (msg) => {
  if (SOURCE_ALIASES[1].re.test(msg) && !SOURCE_ALIASES[0].re.test(msg)) return "backup";
  if (asksForSources(msg)) return "both";
  return "primary-first";
};
var priceLines = (snapshot) => sortRates((snapshot.rates || []).filter((r) => r.parallel || r.official)).map((r) => {
  const any = r;
  const buy = typeof any.buy === "number" ? any.buy : null;
  const sell = r.parallel ?? r.official;
  const bank = r.official ? ` (\u0627\u0644\u0628\u0646\u0643: ${money(r.official)})` : "";
  const both = buy !== null && Math.abs(buy - sell) >= 0.01 ? `\u0634 ${money(buy)} \xB7 \u0628 ${money(sell)}` : money(sell);
  return `\u2022 ${AR_NAMES[r.code] || r.code}: ${both} \u062C.\u0633${bank}`;
});
var formatRatesAnswer = (snapshot, opts = {}) => {
  if (!snapshot?.rates?.length) return null;
  const lines = priceLines(snapshot);
  const when = snapshot.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleString("ar-SD", { timeZone: "Africa/Khartoum" }) : "";
  const age = describeAgeAr(snapshot.fetchedAt);
  const note = opts.changed === false ? `\u0645\u0644\u0627\u062D\u0638\u0629 \u0645\u0647\u0645\u0629: \u0642\u0627\u0631\u0646\u062A \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0628\u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u2014 \u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0645\u0627 \u0627\u062A\u063A\u064A\u0651\u0631\u062A\u060C \u064A\u0639\u0646\u064A \u0627\u0644\u0633\u0648\u0642 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631 \u0645\u0627 \u062A\u062D\u0631\u0651\u0643 \u0645\u0646 ${describeAgeAr(
    opts.previousAt
  )}.` : opts.changed === true ? "\u0641\u064A\u0647 \u062A\u062D\u0631\u0651\u0643 \u0641\u064A \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0645\u0642\u0627\u0631\u0646\u0629 \u0628\u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629." : "";
  const sourceDate = snapshot.sourceUpdatedAt ? `
\u0646\u064F\u0634\u0631\u062A \u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631: ${describeSourceDate(snapshot.sourceUpdatedAt)}.` : "";
  return `\u062D\u0628\u0627\u0628\u0643 \u{1F44B} \u062F\u064A \u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u0632\u064A (\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0623\u0633\u0648\u062F) \u0645\u0646 \u0622\u062E\u0631 \u0642\u0631\u0627\u0621\u0629 \u062D\u0642\u064A\u0642\u064A\u0629:
${lines.join("\n")}

\u0627\u0644\u0645\u0635\u062F\u0631: ${snapshot.source} \u2014 \u062A\u0645 \u0633\u062D\u0628 \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0645\u0646 \u0627\u0644\u0645\u0648\u0642\u0639: ${age}${when ? ` (${when})` : ""}.${sourceDate}
` + (note ? `${note}
` : "") + `\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0631\u0633\u0645\u064A \u0644\u0644\u0628\u0646\u0643 \u0623\u0642\u0644 \u0645\u0646 \u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u0632\u064A\u060C \u0648\u0627\u0644\u062A\u0639\u0627\u0645\u0644 \u0641\u064A \u0627\u0644\u0633\u0648\u062F\u0627\u0646 \u0628\u064A\u0645\u0634\u064A \u0628\u0633\u0639\u0631 \u0627\u0644\u0633\u0648\u0642.`;
};
var formatMultiSourceAnswer = (sources, opts = {}) => {
  if (!sources.length) {
    return "\u064A\u0627 \u062D\u0628\u064A\u0628\u0646\u0627\u060C \u062C\u0631\u0651\u0628\u062A \u0623\u0641\u062A\u062D \u0627\u0644\u0645\u0635\u062F\u0631\u064A\u0646 (\u0633\u0648\u0642 \u0627\u0644\u0633\u0648\u062F\u0627\u0646 \u0648\u0623\u062E\u0628\u0627\u0631 \u0627\u0644\u0633\u0648\u062F\u0627\u0646) \u0647\u0633\u064A \u0648\u0645\u0627 \u0631\u062C\u0651\u0639\u0648\u0627 \u062C\u062F\u0648\u0644 \u0623\u0633\u0639\u0627\u0631 \u0635\u0627\u0644\u062D. \u062F\u064A \u0645\u0634\u0643\u0644\u0629 \u0641\u064A \u0627\u0644\u0645\u0648\u0627\u0642\u0639 \u0646\u0641\u0633\u0647\u0627 \u0645\u0634 \u0641\u064A \u0627\u0644\u0645\u0646\u0635\u0629 \u2014 \u0628\u0646\u0639\u064A\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0643\u0644 \u0634\u0648\u064A\u0629\u060C \u0648\u062A\u0642\u062F\u0631 \u062A\u0634\u0648\u0641 \u0622\u062E\u0631 \u0642\u0631\u0627\u0621\u0629 \u0645\u062D\u0641\u0648\u0638\u0629 \u0645\u0646 \u0634\u0627\u0634\u0629 \xAB\u0627\u0644\u0639\u0645\u0644\u0627\u062A \u0648\u0627\u0644\u0635\u0631\u0641\xBB.";
  }
  const blocks = sources.map((s) => {
    const lines = priceLines(s);
    const published = s.sourceUpdatedAt ? ` \xB7 \u0646\u064F\u0634\u0631 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631: ${describeSourceDate(s.sourceUpdatedAt)}` : "";
    return `\u2014 ${s.source} \u2014
` + (lines.length ? lines.join("\n") : "\u2022 \u0645\u0627 \u0644\u0642\u064A\u062A \u062C\u062F\u0648\u0644 \u0623\u0633\u0639\u0627\u0631 \u0641\u064A \u0627\u0644\u0635\u0641\u062D\u0629 \u0627\u0644\u0622\u0646") + `
\u0633\u062D\u0628 \u0627\u0644\u0642\u0631\u0627\u0621\u0629: ${describeAgeAr(s.fetchedAt)}${published}`;
  });
  const hasBuySell = sources.some(
    (s) => (s.rates || []).some((r) => typeof r.buy === "number" && Math.abs(r.buy - (r.parallel ?? 0)) >= 0.01)
  );
  const legend = hasBuySell ? "(\u0634 = \u0633\u0639\u0631 \u0627\u0644\u0634\u0631\u0627\u0621 \u0645\u0646 \u0627\u0644\u062A\u0627\u062C\u0631 \xB7 \u0628 = \u0633\u0639\u0631 \u0627\u0644\u0628\u064A\u0639)\n" : "";
  const perSource = sources.map((s) => ({
    name: s.source,
    map: new Map(s.rates.filter((r) => r.parallel).map((r) => [r.code, r.parallel]))
  }));
  const comparisons = [];
  if (perSource.length >= 2) {
    for (const code of perSource[0].map.keys()) {
      const values = perSource.map((s) => ({ name: s.name, value: s.map.get(code) })).filter((v) => typeof v.value === "number");
      if (values.length < 2) continue;
      const min = Math.min(...values.map((v) => v.value));
      const max = Math.max(...values.map((v) => v.value));
      if (min === max) {
        comparisons.push(`\u2022 ${AR_NAMES[code] || code}: \u0627\u0644\u0645\u0635\u062F\u0631\u064A\u0646 \u0645\u062A\u0637\u0627\u0628\u0642\u064A\u0646 (${money(min)} \u062C.\u0633)`);
      } else {
        const gap = ((max - min) / min * 100).toFixed(1);
        comparisons.push(
          `\u2022 ${AR_NAMES[code] || code}: \u0641\u0631\u0642 ${gap}% \u0628\u064A\u0646 ${money(min)} \u0648${money(max)} \u062C.\u0633`
        );
      }
    }
  }
  return `\u062D\u0628\u0627\u0628\u0643 \u064A\u0627 \u063A\u0627\u0644\u064A \u{1F44B} \u0641\u062A\u062D\u062A \u0627\u0644\u0645\u0635\u062F\u0631\u064A\u0646 \u0648\u0633\u062D\u0628\u062A \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0645\u0646\u0647\u0645 \u0647\u0633\u064A (\u0645\u0634 \u0645\u0646 \u0627\u0644\u0630\u0627\u0643\u0631\u0629):

${blocks.join("\n\n")}

` + (comparisons.length ? `\u0645\u0642\u0627\u0631\u0646\u0629 \u0633\u0631\u064A\u0639\u0629:
${comparisons.join("\n")}

` : "") + (opts.storedAt ? `\u0622\u062E\u0631 \u0642\u0631\u0627\u0621\u0629 \u0645\u062D\u0641\u0648\u0638\u0629 \u0641\u064A \u0627\u0644\u0645\u0646\u0635\u0629 \u0643\u0627\u0646\u062A ${describeAgeAr(opts.storedAt)} \u2014 \u0648\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0641\u0648\u0642 \u0647\u064A \u0627\u0644\u0623\u062D\u062F\u062B.
` : "\n") + legend + `\u0646\u0635\u064A\u062D\u0629: \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0628\u062A\u062A\u063A\u064A\u0651\u0631 \u0641\u064A \u0646\u0641\u0633 \u0627\u0644\u064A\u0648\u0645\u060C \u0641\u0623\u0643\u0651\u062F \u0645\u0639 \u0627\u0644\u062A\u0627\u062C\u0631 \u0648\u0642\u062A \u0627\u0644\u062A\u0646\u0641\u064A\u0630.`;
};

// src/server/notifications.ts
import webpush from "web-push";
init_telegram();
init_ntfy();
var CONTACT = process.env.VAPID_CONTACT || "mailto:admin@sanad.sd";
var configured = false;
function initPush() {
  const envPublic = process.env.VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;
  if (envPublic && envPrivate) {
    webpush.setVapidDetails(CONTACT, envPublic, envPrivate);
    configured = true;
    return { publicKey: envPublic, privateKey: envPrivate };
  }
  const stored = db.getPushKeys();
  if (stored) {
    webpush.setVapidDetails(CONTACT, stored.publicKey, stored.privateKey);
    configured = true;
    return stored;
  }
  try {
    const generated = webpush.generateVAPIDKeys();
    db.savePushKeys(generated);
    webpush.setVapidDetails(CONTACT, generated.publicKey, generated.privateKey);
    configured = true;
    return generated;
  } catch (err) {
    console.warn("[push] VAPID initialisation failed:", err);
    return null;
  }
}
function getPublicKey() {
  const keys = initPush();
  return keys ? keys.publicKey : null;
}
async function notify(input) {
  const notification = db.createNotification({
    dedupeKey: input.dedupeKey,
    app: input.app,
    kind: input.kind,
    title: input.title,
    body: input.body,
    linkTab: input.linkTab,
    recipientToken: input.recipientToken,
    tenantId: input.tenantId
  });
  await sendPush(input, notification).catch((err) => {
    console.warn("[push] send failed:", err?.message || err);
  });
  if (input.telegram !== false && telegramEnabledFor(input.kind)) {
    await sendTelegram(`*${input.title}*

${input.body}`).catch((err) => {
      console.warn("[telegram] send failed:", err?.message || err);
    });
  }
  if (input.ntfy !== false && ntfyEnabledFor(input.kind)) {
    await sendNtfy(input.title, input.body).catch((err) => {
      console.warn("[ntfy] send failed:", err?.message || err);
    });
  }
  return notification;
}
async function sendPush(input, notification) {
  if (!configured && !initPush()) return;
  const subscriptions = db.getPushSubscriptions({ app: input.app }).filter((s) => {
    if (notification.recipientToken) return s.ownerToken === notification.recipientToken;
    return true;
  });
  if (subscriptions.length === 0) return;
  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    icon: "/icons/sanad-icon-192.png",
    badge: "/icons/sanad-favicon-96.png",
    url: buildUrl(input.app, input.linkTab, input.pushData),
    tag: notification.id,
    kind: input.kind,
    ...input.pushData || {}
  });
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          db.deletePushSubscription(sub.endpoint);
        } else {
          console.warn("[push] delivery error:", err?.statusCode, err?.message);
        }
      }
    })
  );
}
function buildUrl(app, linkTab, extra) {
  if (extra?.url) return String(extra.url);
  const base = `/?app=${app}`;
  return linkTab ? `${base}&tab=${encodeURIComponent(linkTab)}` : base;
}
async function notifyLowStock(tenantId, opts = {}) {
  const alerts = db.syncInventoryAlerts(tenantId);
  const relevant = opts.branchId ? alerts.filter((a) => a.branchId === opts.branchId) : alerts;
  const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  let sent = 0;
  const fresh = [];
  for (const alert of relevant) {
    const key = `low_stock:${alert.productId}:${alert.branchId}:${day}`;
    if (db.hasNotificationKey(key)) continue;
    const title = alert.currentQuantity === 0 ? "\u0646\u0641\u0627\u062F \u0635\u0646\u0641 \u0645\u0646 \u0627\u0644\u0645\u062E\u0632\u0648\u0646" : "\u0646\u0642\u0635 \u0641\u064A \u0627\u0644\u0645\u062E\u0632\u0648\u0646";
    const body = `${alert.productName} \u2014 \u0627\u0644\u0645\u062A\u0628\u0642\u064A ${alert.currentQuantity} \u0641\u0642\u0637 \u0641\u064A ${alert.branchName} (\u062D\u062F \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0637\u0644\u0628 ${alert.reorderPoint}).`;
    await notify({
      app: "merchant",
      kind: "low_stock",
      title,
      body,
      linkTab: "inventory",
      tenantId,
      dedupeKey: key,
      ntfy: false
    });
    fresh.push(body);
    sent++;
  }
  if (fresh.length > 0 && opts.push === true && ntfyEnabledFor("low_stock")) {
    const head = fresh.slice(0, 4).join("\n\u2022 ");
    const rest = fresh.length > 4 ? `
\u2022 \u0648${fresh.length - 4} \u0635\u0646\u0641\u0627\u064B \u0622\u062E\u0631 \u0641\u064A \u062A\u0628\u0648\u064A\u0628 \u0627\u0644\u0645\u062E\u0632\u0648\u0646` : "";
    await sendNtfy(
      fresh.some((l) => l.includes("\u0627\u0644\u0645\u062A\u0628\u0642\u064A 0 ")) ? "\u0646\u0641\u0627\u062F \u0623\u0635\u0646\u0627\u0641 \u0645\u0646 \u0627\u0644\u0645\u062E\u0632\u0648\u0646" : "\u0646\u0642\u0635 \u0641\u064A \u0627\u0644\u0645\u062E\u0632\u0648\u0646",
      `\u2022 ${head}${rest}`,
      { priority: 4, tags: "warning" }
    ).catch(() => {
    });
  }
  return sent;
}
async function notifySubscriptionExpiry() {
  const tenants = db.getSchema().tenants;
  const now = Date.now();
  let sent = 0;
  for (const tenant of tenants) {
    const expires = new Date(tenant.subscriptionExpiresAt).getTime();
    if (!Number.isFinite(expires)) continue;
    const daysLeft = Math.ceil((expires - now) / (24 * 60 * 60 * 1e3));
    let stage = null;
    if (daysLeft <= 0) stage = "expired";
    else if (daysLeft === 1) stage = "d1";
    else if (daysLeft === 3) stage = "d3";
    else if (daysLeft === 7) stage = "d7";
    if (!stage) continue;
    const key = `subscription:${tenant.id}:${stage}:${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`;
    if (db.hasNotificationKey(key)) continue;
    await notify({
      app: "merchant",
      kind: "subscription",
      title: stage === "expired" ? "\u0627\u0646\u062A\u0647\u0649 \u0627\u0634\u062A\u0631\u0627\u0643\u0643 \u0641\u064A \u0645\u0646\u0635\u0629 \u0633\u0646\u062F" : `\u0627\u0634\u062A\u0631\u0627\u0643\u0643 \u064A\u0646\u062A\u0647\u064A \u0628\u0639\u062F ${daysLeft} ${daysLeft === 1 ? "\u064A\u0648\u0645" : "\u0623\u064A\u0627\u0645"}`,
      body: stage === "expired" ? `\u0627\u0634\u062A\u0631\u0627\u0643 \xAB${tenant.tradeName || tenant.name}\xBB \u0645\u0646\u062A\u0647\u064D. \u062C\u062F\u0651\u062F \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0644\u062A\u062C\u0646\u0628 \u0625\u064A\u0642\u0627\u0641 \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 \u0648\u0627\u0644\u0645\u062A\u062C\u0631.` : `\xAB${tenant.tradeName || tenant.name}\xBB \u2014 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621 ${new Date(tenant.subscriptionExpiresAt).toLocaleDateString("ar-EG")}. \u062C\u062F\u0651\u062F \u0627\u0644\u0622\u0646 \u0648\u062A\u062C\u0646\u0628 \u0627\u0644\u062A\u0648\u0642\u0641.`,
      linkTab: "subscription",
      tenantId: tenant.id,
      dedupeKey: key
    });
    if (stage === "expired") {
      const adminKey = `subscription-admin:${tenant.id}:${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`;
      if (!db.hasNotificationKey(adminKey)) {
        await notify({
          app: "admin",
          kind: "subscription",
          title: "\u0627\u0634\u062A\u0631\u0627\u0643 \u062A\u0627\u062C\u0631 \u0645\u0646\u062A\u0647\u064D",
          body: `\xAB${tenant.tradeName || tenant.name}\xBB \u2014 ${tenant.city} \u2022 \u064A\u062D\u062A\u0627\u062C \u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u062C\u062F\u064A\u062F.`,
          linkTab: "payments_queue",
          tenantId: tenant.id,
          dedupeKey: adminKey
        });
      }
    }
    sent++;
  }
  return sent;
}
async function runNotificationScan(opts = {}) {
  let lowStock = 0;
  const seen = /* @__PURE__ */ new Set();
  for (const tenant of db.getSchema().tenants) {
    if (seen.has(tenant.id)) continue;
    seen.add(tenant.id);
    try {
      lowStock += await notifyLowStock(tenant.id, { push: opts.push === true });
    } catch (err) {
      console.warn("[notify] low stock scan failed:", err);
    }
  }
  let subscriptions = 0;
  try {
    subscriptions = await notifySubscriptionExpiry();
  } catch (err) {
    console.warn("[notify] subscription scan failed:", err);
  }
  return { lowStock, subscriptions };
}

// src/server/rateAlerts.ts
init_telegram();
var THRESHOLD_PERCENT = 3;
var PHONE = (process.env.WHATSAPP_ALERT_PHONE || "").replace(/[^\d]/g, "");
var CALLMEBOT_KEY = process.env.WHATSAPP_CALLMEBOT_KEY || "";
var API_URL2 = process.env.WHATSAPP_API_URL || "https://api.callmebot.com/whatsapp.php";
var QUOTA_MARKERS = ["full", "limit", "quota", "not allowed", "blocked", "invalid apikey"];
var sendWhatsApp = async (text2) => {
  if (!PHONE || !CALLMEBOT_KEY) return { ok: false, reason: "NOT_CONFIGURED" };
  try {
    const url = `${API_URL2}?phone=${encodeURIComponent(PHONE)}&text=${encodeURIComponent(text2)}&apikey=${encodeURIComponent(CALLMEBOT_KEY)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8e3);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const body = (await res.text().catch(() => "")).toLowerCase();
    if (QUOTA_MARKERS.some((m) => body.includes(m))) return { ok: false, reason: "PROVIDER_FULL" };
    if (!res.ok) return { ok: false, reason: `HTTP_${res.status}` };
    return { ok: true, reason: "" };
  } catch (err) {
    return { ok: false, reason: err.name === "AbortError" ? "TIMEOUT" : "NETWORK" };
  }
};
var fmt = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
var checkRateMoves = async (moves = detectMoves()) => {
  const result = {
    triggered: [],
    inApp: 0,
    whatsapp: { sent: 0, skipped: !PHONE || !CALLMEBOT_KEY ? "NOT_CONFIGURED" : "" },
    telegram: { sent: 0, skipped: telegramConfigured() ? "" : "NOT_CONFIGURED" }
  };
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  for (const move of moves) {
    const already = db.getRateAlertLog().some((a) => a.code === move.code && a.day === today);
    if (already) continue;
    result.triggered.push(move);
    const direction = move.percent > 0 ? "\u0627\u0631\u062A\u0641\u0639" : "\u0627\u0646\u062E\u0641\u0636";
    const title = `${move.name} ${direction} ${Math.abs(move.percent)}% \u0641\u064A \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u0632\u064A`;
    const body = `\u0633\u0639\u0631 ${move.name} (${move.code}) ${direction} \u0645\u0646 ${fmt(move.previous)} \u0625\u0644\u0649 ${fmt(move.current)} \u062C.\u0633 \u2014 \u062A\u063A\u064A\u0651\u0631 ${move.percent > 0 ? "+" : ""}${move.percent}%. \u0631\u0627\u062C\u0639 \u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0628\u064A\u0639 \u0648\u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0642\u0628\u0644 \u0627\u0644\u062A\u0639\u0627\u0645\u0644 \u0627\u0644\u0642\u0627\u062F\u0645.`;
    try {
      await notify({
        app: "merchant",
        kind: "system",
        title,
        body,
        linkTab: "currencies",
        dedupeKey: `rate_move_${move.code}_${today}`,
        telegram: false
      });
      await notify({
        app: "admin",
        kind: "system",
        title,
        body,
        linkTab: "currencies",
        dedupeKey: `rate_move_admin_${move.code}_${today}`,
        telegram: false
      });
      result.inApp += 2;
    } catch (err) {
      console.warn("[rate-alert] in-app failed:", err.message);
    }
    if (PHONE && CALLMEBOT_KEY) {
      const verdict = await sendWhatsApp(`\u{1F4C9} *\u0645\u0646\u0635\u0629 \u0633\u0646\u062F* \u2014 \u062A\u0646\u0628\u064A\u0647 \u0633\u0639\u0631

${body}`);
      if (verdict.ok) result.whatsapp.sent += 1;
      else if (!result.whatsapp.skipped) result.whatsapp.skipped = verdict.reason;
    }
    if (telegramConfigured()) {
      const arrow = move.percent > 0 ? "\u{1F4C8}" : "\u{1F4C9}";
      const verdict = await sendTelegram(
        `${arrow} *\u062A\u0646\u0628\u064A\u0647 \u0633\u0639\u0631 \u2014 \u0645\u0646\u0635\u0629 \u0633\u0646\u062F*

*${move.name}* (${move.code})
\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u0632\u064A: ${fmt(move.current)} \u062C.\u0633
\u0627\u0644\u0633\u0627\u0628\u0642: ${fmt(move.previous)} \u062C.\u0633
\u0627\u0644\u062A\u063A\u064A\u0651\u0631: ${move.percent > 0 ? "+" : ""}${move.percent}%`
      );
      if (verdict.sent) result.telegram.sent += verdict.sent;
      else if (!result.telegram.skipped) result.telegram.skipped = verdict.skipped;
    }
    db.markRateAlerted(move.code, move.percent, move.current);
  }
  return result;
};
function detectMoves() {
  const moves = [];
  for (const c of db.getSchema().currencies) {
    if (c.isBase) continue;
    const pct = c.lastMovePercent;
    if (typeof pct !== "number" || !Number.isFinite(pct)) continue;
    if (Math.abs(pct) < THRESHOLD_PERCENT) continue;
    const previous = c.parallelRate ? c.parallelRate / (1 + pct / 100) : c.rateToSdg;
    moves.push({
      code: c.code,
      name: c.name,
      previous: Math.round(previous * 100) / 100,
      current: c.rateToSdg,
      percent: pct
    });
  }
  return moves;
}
var whatsappConfigured = () => !!PHONE && !!CALLMEBOT_KEY;
var whatsappProviderHost = () => {
  try {
    return new URL(API_URL2).host;
  } catch {
    return "invalid-url";
  }
};

// src/server/routes.ts
init_telegram();
init_ntfy();

// src/server/media.ts
init_pg();

// src/server/mp4.ts
var CONTAINERS = /* @__PURE__ */ new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf", "mvex"]);
function readBoxes(buf, start, end) {
  const boxes = [];
  let i = start;
  while (i + 8 <= end) {
    let size = buf.readUInt32BE(i);
    const type = buf.toString("latin1", i + 4, i + 8);
    let headerSize = 8;
    if (size === 1) {
      if (i + 16 > end) return null;
      const big = buf.readBigUInt64BE(i + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(big);
      headerSize = 16;
    } else if (size === 0) {
      size = end - i;
    }
    if (size < headerSize || i + size > end) return null;
    boxes.push({ type, start: i, size, headerSize });
    i += size;
  }
  if (i !== end) return null;
  return boxes;
}
function findBox(boxes, type) {
  return boxes.find((b) => b.type === type);
}
function isFastStart(buf) {
  if (buf.length < 16) return false;
  const top = readBoxes(buf, 0, buf.length);
  if (!top) return false;
  const moov = findBox(top, "moov");
  const mdat = findBox(top, "mdat");
  if (!moov) return false;
  if (!mdat) return true;
  return moov.start < mdat.start;
}
function looksLikeMp4(buf) {
  return buf.length >= 12 && buf.toString("latin1", 4, 8) === "ftyp";
}
function fastStart(buf) {
  if (!looksLikeMp4(buf)) return null;
  const top = readBoxes(buf, 0, buf.length);
  if (!top) return null;
  const moov = findBox(top, "moov");
  const mdats = top.filter((b) => b.type === "mdat");
  if (!moov) return null;
  if (mdats.length > 1) return null;
  const mdat = mdats[0];
  if (!mdat) return null;
  if (moov.start < mdat.start) return buf;
  const newMoovStart = top.filter((b) => b !== moov && b !== mdat && b.start < mdat.start).reduce((sum, b) => sum + b.size, 0);
  const delta = newMoovStart + moov.size - mdat.start;
  if (delta === 0) return buf;
  const moovCopy = Buffer.from(buf.subarray(moov.start, moov.start + moov.size));
  const patched = patchChunkOffsets(moovCopy, delta);
  if (!patched) return null;
  const parts = [];
  for (const box of top) {
    if (box === moov) continue;
    if (box === mdat) parts.push(patched);
    parts.push(buf.subarray(box.start, box.start + box.size));
  }
  const out = Buffer.concat(parts);
  if (out.length !== buf.length) return null;
  return out;
}
function patchChunkOffsets(moov, delta) {
  let ok = true;
  const walk = (start, end) => {
    const boxes = readBoxes(moov, start, end);
    if (!boxes) {
      ok = false;
      return;
    }
    for (const box of boxes) {
      const bodyStart = box.start + box.headerSize;
      const bodyEnd = box.start + box.size;
      if (box.type === "stco" || box.type === "co64") {
        const entrySize = box.type === "stco" ? 4 : 8;
        if (bodyStart + 8 > bodyEnd) {
          ok = false;
          return;
        }
        const count = moov.readUInt32BE(bodyStart + 4);
        const entriesStart = bodyStart + 8;
        if (entriesStart + count * entrySize > bodyEnd) {
          ok = false;
          return;
        }
        for (let i = 0; i < count; i++) {
          const at = entriesStart + i * entrySize;
          if (entrySize === 4) {
            const value = moov.readUInt32BE(at) + delta;
            if (value < 0 || value > 4294967295) {
              ok = false;
              return;
            }
            moov.writeUInt32BE(value, at);
          } else {
            const value = moov.readBigUInt64BE(at);
            const next = value + BigInt(delta);
            if (next < 0n || next > BigInt("18446744073709551615")) {
              ok = false;
              return;
            }
            moov.writeBigUInt64BE(next, at);
          }
        }
      } else if (CONTAINERS.has(box.type)) {
        walk(bodyStart, bodyEnd);
        if (!ok) return;
      }
    }
  };
  walk(0, moov.length);
  return ok ? moov : null;
}

// src/server/media.ts
init_storage();
var TABLE = "sanad_media";
var MAX_RAW_BYTES = 3 * 1024 * 1024;
var MAX_VIDEO_BYTES = 40 * 1024 * 1024;
var MAX_IMAGE_MAX_BYTES = 6 * 1024 * 1024;
var CHUNK_BYTES = 21e5;
var CHUNK_TABLE = "sanad_media_chunks";
function base64Bytes(b64) {
  let padding = 0;
  if (b64.endsWith("==")) padding = 2;
  else if (b64.endsWith("=")) padding = 1;
  return Math.floor(b64.length * 3 / 4) - padding;
}
var ready = null;
function ensureMediaTable() {
  if (!ready) {
    ready = transaction(async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${TABLE} (
          id          text PRIMARY KEY,
          kind        text NOT NULL,
          mime        text NOT NULL,
          bytes       integer NOT NULL,
          owner_phone text,
          data        text NOT NULL,
          created_at  timestamptz NOT NULL DEFAULT now()
        )
      `);
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_${TABLE}_created ON ${TABLE} (created_at)`
      );
      await client.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS url text`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${CHUNK_TABLE} (
          upload_id  text NOT NULL,
          idx        integer NOT NULL,
          mime       text NOT NULL,
          owner_phone text,
          data       text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (upload_id, idx)
        )
      `);
    }).catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
function mediaRowFor(base64, blobUrl) {
  return blobUrl ? { data: "", url: blobUrl } : { data: base64, url: null };
}
var ALLOWED_PREFIXES = {
  image: ["data:image/jpeg", "data:image/png", "data:image/webp", "data:image/gif"],
  video: ["data:video/mp4", "data:video/webm", "data:video/quicktime"]
};
async function saveMedia(input) {
  await ensureMediaTable();
  const { dataUrl, kind } = input;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new HttpError(400, "BAD_DATA_URL", "\u0635\u064A\u063A\u0629 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629.");
  }
  const comma = dataUrl.indexOf(",");
  if (comma === -1) {
    throw new HttpError(400, "BAD_DATA_URL", "\u0635\u064A\u063A\u0629 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629.");
  }
  const header = dataUrl.slice(5, comma);
  const isBase64 = header.includes(";base64");
  if (!isBase64) {
    throw new HttpError(400, "BAD_DATA_URL", "\u064A\u062C\u0628 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0645\u0644\u0641 \u0628\u062A\u0631\u0645\u064A\u0632 base64.");
  }
  const mime = header.split(";")[0].toLowerCase();
  const allowed = ALLOWED_PREFIXES[kind] || [];
  if (!allowed.some((prefix) => dataUrl.toLowerCase().startsWith(prefix))) {
    throw new HttpError(
      415,
      "UNSUPPORTED_TYPE",
      kind === "video" ? "\u0635\u064A\u063A\u0629 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629. \u0627\u0633\u062A\u062E\u062F\u0645 MP4 \u0623\u0648 WebM." : "\u0635\u064A\u063A\u0629 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629. \u0627\u0633\u062A\u062E\u062F\u0645 JPG \u0623\u0648 PNG \u0623\u0648 WebP."
    );
  }
  const base64 = dataUrl.slice(comma + 1);
  const bytes = base64Bytes(base64);
  if (bytes > MAX_RAW_BYTES) {
    throw new HttpError(
      413,
      "TOO_LARGE",
      `\u062D\u062C\u0645 \u0627\u0644\u0645\u0644\u0641 ${(bytes / 1024 / 1024).toFixed(1)} \u0645\u064A\u062C\u0627\u060C \u0648\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0637\u0644\u0628 \u0627\u0644\u0648\u0627\u062D\u062F ${MAX_RAW_BYTES / 1024 / 1024} \u0645\u064A\u062C\u0627. \u0627\u0644\u0641\u064A\u062F\u064A\u0648\u0647\u0627\u062A \u0627\u0644\u0643\u0628\u064A\u0631\u0629 \u062A\u064F\u0631\u0641\u0639 \u0639\u0644\u0649 \u0623\u062C\u0632\u0627\u0621.`
    );
  }
  const id = newId(kind === "video" ? "vid" : "img");
  let blobUrl = null;
  if (blobEnabled()) {
    try {
      blobUrl = await putMedia(id, Buffer.from(base64, "base64"), mime, kind);
    } catch (err) {
      console.error("[media] blob upload failed, falling back to database:", err);
    }
  }
  const row = mediaRowFor(base64, blobUrl);
  await query(
    `INSERT INTO ${TABLE} (id, kind, mime, bytes, owner_phone, data, url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, kind, mime, bytes, input.ownerPhone || null, row.data, row.url]
  );
  return { id, url: `/api/media/${id}`, mime, bytes, kind };
}
function ceilingFor(kind) {
  return kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_MAX_BYTES;
}
async function saveChunk(input) {
  await ensureMediaTable();
  const uploadId = String(input.uploadId || "");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(uploadId)) {
    throw new HttpError(400, "BAD_UPLOAD_ID", "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0631\u0641\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D.");
  }
  const index = Number(input.index);
  if (!Number.isInteger(index) || index < 0 || index > 500) {
    throw new HttpError(400, "BAD_CHUNK_INDEX", "\u0631\u0642\u0645 \u0627\u0644\u062C\u0632\u0621 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D.");
  }
  const dataUrl = String(input.dataUrl || "");
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma === -1) {
    throw new HttpError(400, "BAD_DATA_URL", "\u0635\u064A\u063A\u0629 \u0627\u0644\u062C\u0632\u0621 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629.");
  }
  const base64 = dataUrl.slice(comma + 1);
  const bytes = base64Bytes(base64);
  if (bytes > CHUNK_BYTES * 1.1) {
    throw new HttpError(413, "CHUNK_TOO_LARGE", "\u0627\u0644\u062C\u0632\u0621 \u0627\u0644\u0645\u0631\u0633\u0644 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0645\u0633\u0645\u0648\u062D.");
  }
  const mime = (input.mime || dataUrl.slice(5, comma).split(";")[0] || "video/mp4").toLowerCase();
  await query(
    `INSERT INTO ${CHUNK_TABLE} (upload_id, idx, mime, owner_phone, data)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (upload_id, idx) DO UPDATE SET data = EXCLUDED.data`,
    [uploadId, index, mime, input.ownerPhone || null, base64]
  );
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM ${CHUNK_TABLE} WHERE upload_id = $1`,
    [uploadId]
  );
  return { received: Number(rows[0]?.n) || 0, bytes };
}
async function completeChunked(uploadId, totalChunks, kind) {
  await ensureMediaTable();
  const { rows } = await query(
    `SELECT idx, mime, data FROM ${CHUNK_TABLE} WHERE upload_id = $1 ORDER BY idx ASC`,
    [uploadId]
  );
  if (rows.length === 0) {
    throw new HttpError(404, "UPLOAD_NOT_FOUND", "\u0644\u0645 \u064A\u0635\u0644 \u0623\u064A \u062C\u0632\u0621 \u0645\u0646 \u0627\u0644\u0645\u0644\u0641\u060C \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.");
  }
  const expected = Number(totalChunks) || rows.length;
  if (rows.length !== expected) {
    throw new HttpError(409, "UPLOAD_INCOMPLETE", `\u0648\u0635\u0644 ${rows.length} \u062C\u0632\u0621 \u0645\u0646 ${expected}\u060C \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.`);
  }
  for (let i = 0; i < rows.length; i++) {
    if (Number(rows[i].idx) !== i) {
      throw new HttpError(409, "UPLOAD_GAP", "\u0641\u064A \u062C\u0632\u0621 \u0646\u0627\u0642\u0635 \u0645\u0646 \u0627\u0644\u0645\u0644\u0641\u060C \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.");
    }
  }
  const mime = String(rows[0].mime || (kind === "video" ? "video/mp4" : "image/jpeg"));
  const base64 = rows.map((r) => String(r.data)).join("");
  const bytes = base64Bytes(base64);
  if (bytes > ceilingFor(kind)) {
    await query(`DELETE FROM ${CHUNK_TABLE} WHERE upload_id = $1`, [uploadId]);
    throw new HttpError(
      413,
      "TOO_LARGE",
      `\u062D\u062C\u0645 \u0627\u0644\u0645\u0644\u0641 ${(bytes / 1024 / 1024).toFixed(1)} \u0645\u064A\u062C\u0627\u060C \u0648\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 ${ceilingFor(kind) / 1024 / 1024} \u0645\u064A\u062C\u0627.`
    );
  }
  const id = newId(kind === "video" ? "vid" : "img");
  let blobUrl = null;
  if (blobEnabled()) {
    try {
      blobUrl = await putMedia(id, Buffer.from(base64, "base64"), mime, kind);
    } catch (err) {
      console.error("[media] blob upload failed, falling back to database:", err);
    }
  }
  const row = mediaRowFor(base64, blobUrl);
  await query(
    `INSERT INTO ${TABLE} (id, kind, mime, bytes, owner_phone, data, url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, kind, mime, bytes, rows[0].owner_phone ?? null, row.data, row.url]
  );
  await query(`DELETE FROM ${CHUNK_TABLE} WHERE upload_id = $1`, [uploadId]);
  await query(`DELETE FROM ${CHUNK_TABLE} WHERE created_at < now() - interval '1 day'`).catch(() => {
  });
  return { id, url: `/api/media/${id}`, mime, bytes, kind };
}
var MEDIA_CACHE_MAX_BYTES = 120 * 1024 * 1024;
var MEDIA_CACHE_MAX_ITEM = 45 * 1024 * 1024;
var mediaCache = /* @__PURE__ */ new Map();
var mediaCacheBytes = 0;
function cacheGet(id) {
  const hit = mediaCache.get(id);
  if (!hit) return null;
  mediaCache.delete(id);
  mediaCache.set(id, hit);
  return hit;
}
function cachePut(id, value) {
  if (value.data.length > MEDIA_CACHE_MAX_ITEM) return;
  const existing = mediaCache.get(id);
  if (existing) {
    mediaCacheBytes -= existing.data.length;
    mediaCache.delete(id);
  }
  mediaCache.set(id, value);
  mediaCacheBytes += value.data.length;
  while (mediaCacheBytes > MEDIA_CACHE_MAX_BYTES && mediaCache.size > 1) {
    const oldestKey = mediaCache.keys().next().value;
    if (!oldestKey) break;
    const oldest = mediaCache.get(oldestKey);
    mediaCache.delete(oldestKey);
    mediaCacheBytes -= oldest?.data.length ?? 0;
  }
}
async function getMedia(id) {
  const cached = cacheGet(id);
  if (cached) return { ...cached, url: null };
  await ensureMediaTable();
  const { rows } = await query(
    `SELECT mime, data, bytes, url FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  const url = row.url || null;
  const value = {
    mime: row.mime,
    bytes: Number(row.bytes) || 0,
    // Blob-backed rows carry no bytes; the route redirects instead.
    data: url ? Buffer.alloc(0) : Buffer.from(row.data, "base64"),
    url
  };
  if (!url) cachePut(id, value);
  return value;
}
var streamCache = /* @__PURE__ */ new Map();
var streamCacheBytes = 0;
var STREAM_CACHE_MAX_BYTES = 120 * 1024 * 1024;
var STREAM_CACHE_MAX_ITEM = 45 * 1024 * 1024;
function prepareForStreaming(id, mime, data) {
  if (!/^video\//.test(mime) || !looksLikeMp4(data) || isFastStart(data)) return data;
  const hit = streamCache.get(id);
  if (hit && hit.length === data.length) return hit;
  const fixed = fastStart(data);
  if (!fixed || fixed === data || fixed.length > STREAM_CACHE_MAX_ITEM) {
    return fixed ?? data;
  }
  streamCache.set(id, fixed);
  streamCacheBytes += fixed.length;
  while (streamCacheBytes > STREAM_CACHE_MAX_BYTES && streamCache.size > 1) {
    const oldest = streamCache.keys().next().value;
    if (!oldest) break;
    const dropped = streamCache.get(oldest);
    streamCache.delete(oldest);
    streamCacheBytes -= dropped?.length ?? 0;
  }
  return fixed;
}
function buildMediaResponse(data, mime, rangeHeader) {
  const total = data.length;
  const headers = {
    "Content-Type": mime,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes"
  };
  if (!/^(image|text)\//.test(mime)) headers["Content-Disposition"] = "inline";
  const partial = (start2, end2) => ({
    status: 206,
    headers: {
      ...headers,
      "Content-Range": `bytes ${start2}-${end2}/${total}`,
      "Content-Length": String(end2 - start2 + 1)
    },
    body: data.subarray(start2, end2 + 1)
  });
  const unsatisfiable = () => ({
    status: 416,
    headers: { ...headers, "Content-Range": `bytes */${total}` },
    body: null
  });
  if (!rangeHeader) {
    return { status: 200, headers: { ...headers, "Content-Length": String(total) }, body: data };
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
  if (!match) return unsatisfiable();
  let start = match[1] === "" ? NaN : Number(match[1]);
  let end = match[2] === "" ? NaN : Number(match[2]);
  if (Number.isNaN(start) && Number.isNaN(end)) return unsatisfiable();
  if (Number.isNaN(start)) {
    start = Math.max(0, total - end);
    end = total - 1;
  } else if (Number.isNaN(end) || end >= total) {
    end = total - 1;
  }
  if (start > end || start >= total) return unsatisfiable();
  return partial(start, end);
}
async function deleteMedia(id) {
  await ensureMediaTable();
  const { rowCount } = await query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
var HttpError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};

// src/server/routes.ts
init_storage();
init_watchdog();
init_alerts();

// src/server/backup.ts
init_pg();
init_storage();
import { gzipSync } from "node:zlib";
import { put as put2, list, del } from "@vercel/blob";
var MAX_BACKUP_BYTES = 32 * 1024 * 1024;
var KEEP_BACKUPS = 7;
var stamp = (d) => d.toISOString().replace(/[:T]/g, "-").slice(0, 16);
function backupName(at = /* @__PURE__ */ new Date()) {
  return `backups/sanad-${stamp(at)}.json.gz`;
}
function buildBackupPayload(tables, at = /* @__PURE__ */ new Date()) {
  let rows = 0;
  for (const list2 of Object.values(tables)) rows += list2.length;
  return {
    json: JSON.stringify({ tool: "sanad-backup", version: 1, createdAt: at.toISOString(), rows, tables }),
    rows
  };
}
async function runBackup(at = /* @__PURE__ */ new Date()) {
  if (storageMode() !== "blob") {
    return { ok: false, skipped: "NO_BLOB_STORE", error: "\u062A\u062E\u0632\u064A\u0646 Blob \u063A\u064A\u0631 \u0645\u0631\u0628\u0648\u0637 \u2014 \u0627\u0644\u0646\u0633\u062E\u0629 \u0645\u0627 \u0627\u062A\u062D\u0641\u0638\u062A\u0634." };
  }
  try {
    const { rows: tableRows } = await query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_name LIKE 'sanad%'
        ORDER BY table_name`
    );
    const tables = {};
    let bytesSoFar = 0;
    let rowCount = 0;
    for (const { table_name: table } of tableRows) {
      const name2 = String(table);
      const { rows } = await query(`SELECT * FROM "${name2}"`);
      tables[name2] = rows;
      rowCount += rows.length;
      bytesSoFar += JSON.stringify(rows).length;
      if (bytesSoFar > MAX_BACKUP_BYTES) {
        return {
          ok: false,
          error: `\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0623\u0643\u0628\u0631 \u0645\u0646 ${MAX_BACKUP_BYTES / 1024 / 1024} \u0645\u064A\u062C\u0627 \u2014 \u0627\u0644\u0646\u0633\u062E\u0629 \u0645\u062D\u062A\u0627\u062C\u0629 \u062A\u0642\u0633\u064A\u0645.`,
          tables: Object.keys(tables).length,
          rows: rowCount
        };
      }
    }
    const payload = buildBackupPayload(tables, at);
    const gz = gzipSync(Buffer.from(payload.json, "utf8"), { level: 9 });
    const name = backupName(at);
    const uploaded = await put2(name, gz, {
      access: "public",
      contentType: "application/gzip",
      addRandomSuffix: false
    });
    let pruned = 0;
    try {
      const existing = await list({ prefix: "backups/" });
      const old = existing.blobs.filter((b) => b.pathname !== name).sort((a, b) => a.uploadedAt > b.uploadedAt ? -1 : 1).slice(KEEP_BACKUPS - 1);
      if (old.length) {
        await del(old.map((b) => b.url));
        pruned = old.length;
      }
    } catch {
    }
    return {
      ok: true,
      url: uploaded.url,
      name,
      tables: Object.keys(tables).length,
      rows: payload.rows,
      bytes: gz.length,
      pruned
    };
  } catch (err) {
    return { ok: false, error: err.message.slice(0, 200) };
  }
}

// src/server/ownerApproval.ts
import crypto from "node:crypto";
var TTL_MS = 2 * 60 * 60 * 1e3;
var SENSITIVE_PERMISSIONS = ["manage_staff", "edit_prices", "view_profits", "view_cogs"];
function requiresOwnerApproval(role, permissions) {
  if (role === "owner" || role === "super_admin") {
    return { required: true, reason: "\u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u062C\u062F\u064A\u062F \u0628\u062F\u0648\u0631 \xAB\u0627\u0644\u0645\u0627\u0644\u0643 / \u0627\u0644\u0645\u062F\u064A\u0631\xBB \u2014 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0643\u0627\u0645\u0644\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u062A\u062C\u0631." };
  }
  const sensitive = permissions.filter((p) => SENSITIVE_PERMISSIONS.includes(p));
  if (sensitive.length > 0) {
    const labels = {
      manage_staff: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646",
      edit_prices: "\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0623\u0633\u0639\u0627\u0631",
      view_profits: "\u0635\u0627\u0641\u064A \u0627\u0644\u0623\u0631\u0628\u0627\u062D",
      view_cogs: "\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0634\u0631\u0627\u0621"
    };
    return {
      required: true,
      reason: `\u0627\u0644\u0637\u0644\u0628 \u064A\u0645\u0646\u062D \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u062D\u0633\u0627\u0633\u0629: ${sensitive.map((p) => labels[p] || p).join(" \xB7 ")}`
    };
  }
  return { required: false, reason: "" };
}
function readAll() {
  const bag = db.getSchema();
  if (!Array.isArray(bag.ownerApprovals)) bag.ownerApprovals = [];
  return bag.ownerApprovals;
}
function writeAll(rows) {
  db.getSchema().ownerApprovals = rows.slice(0, 500);
  db.commit();
}
function createApprovalRequest(input) {
  const rows = readAll();
  const dup = rows.find(
    (r) => r.tenantId === input.tenantId && r.status === "pending" && r.requestedById === input.requestedById && r.employeeName === input.employeeName && r.employeeRole === input.employeeRole
  );
  if (dup && new Date(dup.expiresAt).getTime() > Date.now()) return dup;
  const now = Date.now();
  const record = {
    id: `apr_${crypto.randomBytes(6).toString("hex")}`,
    tenantId: input.tenantId,
    requestedBy: input.requestedBy,
    requestedById: input.requestedById,
    employeeName: input.employeeName,
    employeeRole: input.employeeRole,
    permissions: input.permissions.slice(0, 30),
    reason: input.reason,
    status: "pending",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString()
  };
  writeAll([record, ...rows]);
  db.logAudit({
    tenantId: input.tenantId,
    actorId: input.requestedById,
    actorName: input.requestedBy,
    action: "REQUEST_EMPLOYEE_APPROVAL",
    entity: "Employee",
    entityId: record.id,
    details: `\u0637\u0644\u0628 \u062A\u0635\u0631\u064A\u062D \u0645\u0627\u0644\u0643 \u0644\u0625\u0636\u0627\u0641\u0629 \xAB${input.employeeName}\xBB \u2014 ${input.reason}`
  });
  return record;
}
function getApproval(tenantId, id) {
  return readAll().find((r) => r.tenantId === tenantId && r.id === id) || null;
}
function listPending(tenantId) {
  return readAll().filter((r) => r.tenantId === tenantId && r.status === "pending");
}
function approve(tenantId, id, approvedBy) {
  const rows = readAll();
  const rec = rows.find((r) => r.tenantId === tenantId && r.id === id);
  if (!rec || rec.status !== "pending") return null;
  if (new Date(rec.expiresAt).getTime() < Date.now()) return null;
  rec.status = "approved";
  rec.approvedAt = (/* @__PURE__ */ new Date()).toISOString();
  rec.approvedBy = approvedBy;
  writeAll(rows);
  db.logAudit({
    tenantId,
    actorId: "owner",
    actorName: approvedBy,
    action: "APPROVE_EMPLOYEE",
    entity: "Employee",
    entityId: rec.id,
    details: `\u0635\u0627\u062F\u0642 \u0627\u0644\u0645\u0627\u0644\u0643 \u0639\u0644\u0649 \u0625\u0636\u0627\u0641\u0629 \xAB${rec.employeeName}\xBB`
  });
  return rec;
}
function reject(tenantId, id, rejectedBy) {
  const rows = readAll();
  const rec = rows.find((r) => r.tenantId === tenantId && r.id === id);
  if (!rec || rec.status !== "pending") return null;
  rec.status = "rejected";
  rec.approvedAt = (/* @__PURE__ */ new Date()).toISOString();
  rec.approvedBy = rejectedBy;
  writeAll(rows);
  db.logAudit({
    tenantId,
    actorId: "owner",
    actorName: rejectedBy,
    action: "REJECT_EMPLOYEE",
    entity: "Employee",
    entityId: rec.id,
    details: `\u0631\u0641\u0636 \u0627\u0644\u0645\u0627\u0644\u0643 \u0625\u0636\u0627\u0641\u0629 \xAB${rec.employeeName}\xBB`
  });
  return rec;
}
function consumeApproval(tenantId, id) {
  const rows = readAll();
  const rec = rows.find((r) => r.tenantId === tenantId && r.id === id);
  if (!rec) return { ok: false, error: "\u0637\u0644\u0628 \u0627\u0644\u062A\u0635\u0631\u064A\u062D \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." };
  if (new Date(rec.expiresAt).getTime() < Date.now()) return { ok: false, error: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0637\u0644\u0628 \u0627\u0644\u062A\u0635\u0631\u064A\u062D \u2014 \u0627\u0637\u0644\u0628 \u062A\u0635\u0631\u064A\u062D\u0627\u064B \u062C\u062F\u064A\u062F\u0627\u064B \u0645\u0646 \u0627\u0644\u0645\u0627\u0644\u0643." };
  if (rec.status === "pending") return { ok: false, error: "\u0644\u0645 \u064A\u0648\u0627\u0641\u0642 \u0627\u0644\u0645\u0627\u0644\u0643 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628 \u0628\u0639\u062F." };
  if (rec.status === "rejected") return { ok: false, error: "\u0631\u0641\u0636 \u0627\u0644\u0645\u0627\u0644\u0643 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628." };
  if (rec.status === "used") return { ok: false, error: "\u0647\u0630\u0627 \u0627\u0644\u062A\u0635\u0631\u064A\u062D \u0627\u0633\u062A\u064F\u062E\u062F\u0645 \u0645\u0646 \u0642\u0628\u0644 \u2014 \u0627\u0637\u0644\u0628 \u062A\u0635\u0631\u064A\u062D\u0627\u064B \u062C\u062F\u064A\u062F\u0627\u064B." };
  rec.status = "used";
  rec.usedAt = (/* @__PURE__ */ new Date()).toISOString();
  writeAll(rows);
  return { ok: true, record: rec };
}

// src/server/securitySessions.ts
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
function safeEqual(a, b) {
  const first = createHash("sha256").update(a, "utf8").digest();
  const second = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(first, second);
}
function validSigningSecret(secret) {
  return typeof secret === "string" && secret.length >= 32 && secret.length <= 1024;
}
function passwordMatches(input, configured2) {
  if (typeof input !== "string" || input.length > 1024 || !configured2 || configured2.length > 1024) return false;
  return safeEqual(input, configured2);
}
var MERCHANT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newMerchantCode() {
  const block = () => Array.from({ length: 4 }, () => MERCHANT_CODE_ALPHABET[Math.floor(Math.random() * MERCHANT_CODE_ALPHABET.length)]).join("");
  return `SND-${block()}-${block()}-${block()}`;
}
function merchantCodeHash(input) {
  if (typeof input !== "string" || input.length > 80) return null;
  const normalized = input.toUpperCase().replace(/[\s-]/g, "");
  if (/^SND[A-HJ-NP-Z2-9]{8,16}$/.test(normalized)) {
    return createHash("sha256").update(`sanad-merchant-code-v2:${normalized}`, "utf8").digest("hex");
  }
  if (/^SND[0-9A-F]{40}$/.test(normalized)) {
    return createHash("sha256").update(`sanad-merchant-code-v1:${normalized}`, "utf8").digest("hex");
  }
  return null;
}
function adminRevision(password) {
  return createHash("sha256").update(`sanad-admin-password-v1:${password}`, "utf8").digest("hex");
}
function signature(payload, secret) {
  return createHmac("sha256", secret).update(`sanad-session-v1.${payload}`).digest("base64url");
}
function signSession(input, secret, now = Date.now()) {
  if (!validSigningSecret(secret)) throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  if (!/^[0-9a-f]{64}$/.test(input.revision)) throw new Error("INVALID_REVISION");
  if ((input.role === "merchant" || input.role === "staff") && (typeof input.tenantId !== "string" || !input.tenantId || input.tenantId.length > 200)) throw new Error("TENANT_REQUIRED");
  if (input.role === "admin" && input.tenantId !== void 0) throw new Error("INVALID_ADMIN_TENANT");
  if (input.role === "staff" && (typeof input.employeeId !== "string" || !input.employeeId || input.employeeId.length > 200)) throw new Error("EMPLOYEE_REQUIRED");
  const maxAge = input.role === "admin" ? 12 * 60 * 60 * 1e3 : 14 * 24 * 60 * 60 * 1e3;
  const claims = {
    v: 1,
    role: input.role,
    ...input.role === "merchant" || input.role === "staff" ? { tenantId: input.tenantId } : {},
    ...input.role === "staff" ? { employeeId: input.employeeId } : {},
    revision: input.revision,
    issuedAt: now,
    expiresAt: now + maxAge,
    nonce: randomBytes(16).toString("hex")
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}
function verifySession(token2, secret, role, now = Date.now()) {
  if (!validSigningSecret(secret) || typeof token2 !== "string" || token2.length > 4096) return null;
  const pieces = token2.split(".");
  if (pieces.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(pieces[0]) || !/^[A-Za-z0-9_-]{43}$/.test(pieces[1])) return null;
  if (!safeEqual(pieces[1], signature(pieces[0], secret))) return null;
  try {
    const value = JSON.parse(Buffer.from(pieces[0], "base64url").toString("utf8"));
    if (!value || typeof value !== "object") return null;
    const claims = value;
    if (claims.v !== 1 || claims.role !== role || !Number.isSafeInteger(claims.issuedAt) || !Number.isSafeInteger(claims.expiresAt) || claims.issuedAt > now || claims.expiresAt <= now || claims.expiresAt <= claims.issuedAt || !/^[0-9a-f]{64}$/.test(claims.revision) || !/^[0-9a-f]{32}$/.test(claims.nonce)) return null;
    if ((claims.role === "merchant" || claims.role === "staff") && (typeof claims.tenantId !== "string" || !claims.tenantId || claims.tenantId.length > 200)) return null;
    if (claims.role === "admin" && claims.tenantId !== void 0) return null;
    if (claims.role === "staff" && (typeof claims.employeeId !== "string" || !claims.employeeId || claims.employeeId.length > 200)) return null;
    const maxAge = role === "admin" ? 12 * 60 * 60 * 1e3 : 14 * 24 * 60 * 60 * 1e3;
    if (claims.expiresAt - claims.issuedAt > maxAge) return null;
    return claims;
  } catch {
    return null;
  }
}
function sessionRevisionMatches(claims, expected) {
  return typeof expected === "string" && /^[0-9a-f]{64}$/.test(expected) && safeEqual(claims.revision, expected);
}

// src/server/auth.ts
function getSecret() {
  return process.env.SANAD_AUTH_SECRET;
}
function getAdminPassword() {
  return process.env.SANAD_ADMIN_PASSWORD;
}
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}
function bearerToken(req) {
  const h = req.headers.authorization || "";
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return void 0;
}
function extractToken(req, names) {
  const cookies = parseCookies(req.headers.cookie);
  for (const n of names) {
    if (cookies[n]) return cookies[n];
  }
  const bearer = bearerToken(req);
  if (bearer) return bearer;
  const alt = req.headers["x-admin-token"] || req.headers["x-merchant-token"];
  if (alt) return alt;
  return void 0;
}
function cookieOpts(maxAgeSec) {
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  return `HttpOnly; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${isProd ? "; Secure" : ""}`;
}
function setCookie(res, name, value, maxAgeSec) {
  const serialized = `${name}=${encodeURIComponent(value)}; ${cookieOpts(maxAgeSec)}`;
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", serialized);
  } else if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, serialized]);
  } else {
    res.setHeader("Set-Cookie", [existing, serialized]);
  }
}
function clearCookie(res, name) {
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  const serialized = `${name}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProd ? "; Secure" : ""}`;
  const existing = res.getHeader("Set-Cookie");
  if (!existing) res.setHeader("Set-Cookie", serialized);
  else if (Array.isArray(existing)) res.setHeader("Set-Cookie", [...existing, serialized]);
  else res.setHeader("Set-Cookie", [existing, serialized]);
}
function authSecretConfigured() {
  return validSigningSecret(getSecret());
}
function adminAuthMiddleware(req, res, next) {
  const secret = getSecret();
  const password = getAdminPassword();
  if (!validSigningSecret(secret) || !password) {
    if (process.env.NODE_ENV !== "production" && !process.env.VERCEL && !validSigningSecret(secret)) {
      req.adminName = "\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629 (\u0645\u0624\u0642\u062A \u2014 \u0628\u0644\u0627 \u062D\u0645\u0627\u064A\u0629)";
      return next();
    }
    return res.status(500).json({ error: "AUTH_NOT_CONFIGURED", message: "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0623\u0645\u0627\u0646 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645." });
  }
  const token2 = extractToken(req, ["sanad_admin_token", "sanad_admin"]);
  if (!token2) return res.status(401).json({ error: "UNAUTHORIZED", message: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0623\u0648\u0644\u0627\u064B." });
  const claims = verifySession(token2, secret, "admin");
  if (!claims) return res.status(401).json({ error: "UNAUTHORIZED", message: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062C\u0644\u0633\u0629\u060C \u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B." });
  const expected = adminRevision(password);
  if (!sessionRevisionMatches(claims, expected)) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u062A\u063A\u064A\u0651\u0631\u062A\u060C \u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B." });
  }
  req.adminName = "\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629";
  req.adminRevision = expected;
  req.adminClaims = claims;
  next();
}
function merchantAuthMiddleware(req, res, next) {
  const secret = getSecret();
  if (!validSigningSecret(secret)) {
    const fallbackId = req.headers["x-tenant-id"] || "tenant_alrowad";
    const fallbackTenant = db.getTenant(fallbackId);
    if (!fallbackTenant) return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645" });
    const authReq2 = req;
    authReq2.tenantId = fallbackId;
    const rawActorName2 = req.headers["x-actor-name"] || "";
    let decodedActorName = fallbackTenant.ownerName || fallbackTenant.tradeName || "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631";
    if (rawActorName2) {
      try {
        decodedActorName = decodeURIComponent(rawActorName2);
      } catch {
        decodedActorName = rawActorName2;
      }
    }
    authReq2.actorName = decodedActorName;
    authReq2.actorRole = req.headers["x-actor-role"] || "owner";
    authReq2.actorId = req.headers["x-actor-id"] || "emp_owner_" + fallbackId;
    authReq2.authRole = "merchant";
    return next();
  }
  const token2 = extractToken(req, ["sanad_merchant_token", "sanad_merchant"]);
  if (!token2) return res.status(401).json({ error: "UNAUTHORIZED", message: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u062A\u062C\u0631 \u0623\u0648\u0644\u0627\u064B." });
  const claims = verifySession(token2, secret, "merchant");
  if (!claims || !claims.tenantId) return res.status(401).json({ error: "UNAUTHORIZED", message: "\u062C\u0644\u0633\u0629 \u0627\u0644\u0645\u062A\u062C\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629." });
  const tenant = db.getTenant(claims.tenantId);
  if (!tenant) return res.status(401).json({ error: "TENANT_NOT_FOUND", message: "\u0627\u0644\u0645\u062A\u062C\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  if (tenant.status === "suspended") return res.status(403).json({ error: "TENANT_SUSPENDED", message: "\u0627\u0644\u0645\u062A\u062C\u0631 \u0645\u0648\u0642\u0648\u0641." });
  const storedHash = tenant.merchantCodeHash;
  if (!storedHash || !/^[0-9a-f]{64}$/.test(storedHash)) {
    return res.status(401).json({ error: "CODE_NOT_ISSUED", message: "\u0644\u0645 \u064A\u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0631\u0645\u0632 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631 \u0628\u0639\u062F." });
  }
  if (!sessionRevisionMatches(claims, storedHash)) {
    return res.status(401).json({ error: "CODE_ROTATED", message: "\u0631\u0645\u0632 \u0627\u0644\u0645\u062A\u062C\u0631 \u062A\u063A\u064A\u0651\u0631\u060C \u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B." });
  }
  const authReq = req;
  authReq.tenantId = tenant.id;
  const staffToken = extractToken(req, ["sanad_staff_token"]);
  if (staffToken) {
    const staffClaims = verifySession(staffToken, secret, "staff");
    if (!staffClaims || staffClaims.tenantId !== tenant.id) {
      return res.status(401).json({ error: "STAFF_SESSION_INVALID", message: "\u062C\u0644\u0633\u0629 \u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629\u060C \u0623\u062F\u062E\u0644 \u0631\u0645\u0632\u0643 \u0645\u062C\u062F\u062F\u0627\u064B." });
    }
    const staffEmployee = (db.getSchema().employees || []).find((e) => e.id === staffClaims.employeeId && e.tenantId === tenant.id);
    if (!staffEmployee || staffEmployee.isActive === false) {
      return res.status(403).json({ error: "STAFF_REVOKED", message: "\u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0631\u0627\u062C\u0639 \u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631." });
    }
    authReq.actorId = staffEmployee.id;
    authReq.actorName = staffEmployee.name;
    authReq.actorRole = staffEmployee.role;
    authReq.authRole = "merchant";
    req.merchantClaims = claims;
    req.staffSession = true;
    return next();
  }
  const rawActorId = req.headers["x-actor-id"] || "emp_owner_" + tenant.id;
  const rawActorName = req.headers["x-actor-name"] || "";
  let decodedName = tenant.ownerName || tenant.tradeName || "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631";
  if (rawActorName) {
    try {
      decodedName = decodeURIComponent(rawActorName);
    } catch {
      decodedName = rawActorName;
    }
  }
  const rawRole = req.headers["x-actor-role"] || "owner";
  const employees = db.getSchema().employees || [];
  const employee = employees.find((e) => e.id === rawActorId);
  if (employee) {
    if (employee.tenantId !== tenant.id) {
      return res.status(403).json({ error: "FORBIDDEN_ACTOR", message: "\u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0627 \u064A\u062A\u0628\u0639 \u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631." });
    }
    authReq.actorId = employee.id;
    authReq.actorName = employee.name;
    authReq.actorRole = employee.role;
  } else {
    authReq.actorId = `emp_owner_${tenant.id}`;
    authReq.actorName = decodedName;
    authReq.actorRole = rawRole || "owner";
  }
  authReq.authRole = "merchant";
  req.merchantClaims = claims;
  next();
}
function issueAdminSession(password, res) {
  const secret = getSecret();
  const configured2 = getAdminPassword();
  if (!validSigningSecret(secret) || !configured2) return null;
  if (!passwordMatches(password, configured2)) return null;
  const revision = adminRevision(configured2);
  const token2 = signSession({ role: "admin", revision }, secret);
  setCookie(res, "sanad_admin_token", token2, 12 * 60 * 60);
  return token2;
}
function destroyAdminSession(res) {
  clearCookie(res, "sanad_admin_token");
}
function issueMerchantSession(tenantId, codeHash, res) {
  const secret = getSecret();
  if (!validSigningSecret(secret)) return null;
  const tenant = db.getTenant(tenantId);
  if (!tenant) return null;
  const stored = tenant.merchantCodeHash;
  if (stored !== codeHash) return null;
  const token2 = signSession({ role: "merchant", tenantId, revision: codeHash }, secret);
  setCookie(res, "sanad_merchant_token", token2, 14 * 24 * 60 * 60);
  return token2;
}
function destroyMerchantSession(res) {
  clearCookie(res, "sanad_merchant_token");
  clearCookie(res, "sanad_staff_token");
}
function issueStaffSession(tenantId, revision, employeeId, res) {
  const secret = getSecret();
  if (!validSigningSecret(secret)) return null;
  try {
    const token2 = signSession({ role: "staff", tenantId, employeeId, revision }, secret);
    setCookie(res, "sanad_staff_token", token2, 12 * 60 * 60);
    return token2;
  } catch {
    return null;
  }
}
function destroyStaffSession(res) {
  clearCookie(res, "sanad_staff_token");
}
function listStaffForLogin(tenantId) {
  return (db.getSchema().employees || []).filter((e) => e.tenantId === tenantId && e.isActive !== false && e.role !== "super_admin").map((e) => ({ id: e.id, name: e.name, role: e.role }));
}
function staffPinMatches(tenantId, employeeId, pin) {
  const pinClean = String(pin ?? "").replace(/\D/g, "").slice(0, 6);
  if (pinClean.length < 4) return { error: "INVALID_PIN" };
  const employee = (db.getSchema().employees || []).find((e) => e.id === employeeId && e.tenantId === tenantId);
  if (!employee || employee.isActive === false) return { error: "EMPLOYEE_NOT_FOUND" };
  const actual = String(employee.pin || "");
  if (!actual) return { error: "INVALID_PIN" };
  return actual === pinClean ? { employee } : { error: "INVALID_PIN" };
}

// src/server/routes.ts
import crypto2 from "node:crypto";
var apiRouter = Router();
apiRouter.get("/barcode-lookup/:barcode", barcodeLookupHandler);
function tryMerchantTenantId(req) {
  const secret = process.env.SANAD_AUTH_SECRET;
  if (!validSigningSecret(secret)) return null;
  const cookieHeader = req.headers.cookie;
  let token2;
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const k = part.slice(0, eq).trim();
      if (k === "sanad_merchant_token") token2 = decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  if (!token2) {
    const h = req.headers.authorization || "";
    if (h.toLowerCase().startsWith("bearer ")) token2 = h.slice(7).trim();
  }
  if (!token2) token2 = req.headers["x-merchant-token"] || void 0;
  if (!token2) return null;
  const claims = verifySession(token2, secret, "merchant");
  if (!claims || !claims.tenantId) return null;
  const tenant = db.getTenant(claims.tenantId);
  if (!tenant) return null;
  const stored = tenant.merchantCodeHash;
  if (!stored || claims.revision !== stored) return null;
  return claims.tenantId;
}
apiRouter.get("/auth/status", (req, res) => {
  res.json({
    authSecretConfigured: authSecretConfigured(),
    adminPasswordConfigured: !!process.env.SANAD_ADMIN_PASSWORD
  });
});
apiRouter.post("/auth/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (!validSigningSecret(process.env.SANAD_AUTH_SECRET)) {
    return res.status(500).json({ error: "AUTH_NOT_CONFIGURED", message: "\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u062C\u0644\u0633\u0627\u062A \u063A\u064A\u0631 \u0645\u064F\u0647\u064A\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645." });
  }
  if (!process.env.SANAD_ADMIN_PASSWORD) {
    return res.status(500).json({ error: "ADMIN_NOT_CONFIGURED", message: "\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u063A\u064A\u0631 \u0645\u064F\u0647\u064A\u0623\u0629." });
  }
  const token2 = issueAdminSession(String(password || ""), res);
  if (!token2) return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." });
  res.json({ success: true, token: token2 });
});
apiRouter.post("/auth/admin/logout", (req, res) => {
  destroyAdminSession(res);
  res.json({ success: true });
});
apiRouter.get("/auth/admin/me", adminAuthMiddleware, (req, res) => {
  res.json({ authenticated: true, role: "admin" });
});
apiRouter.post("/auth/merchant/login", (req, res) => {
  const { code, slug, tenantId } = req.body || {};
  const rawCode = String(code || "").trim();
  if (!validSigningSecret(process.env.SANAD_AUTH_SECRET)) {
    return res.status(500).json({ error: "AUTH_NOT_CONFIGURED", message: "\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u062C\u0644\u0633\u0627\u062A \u063A\u064A\u0631 \u0645\u064F\u0647\u064A\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645." });
  }
  const hash = merchantCodeHash(rawCode);
  let legacyByPrefix = null;
  if (!hash) {
    const app = db.getTenantApplications().find((a) => (a.activationCode || "").toUpperCase() === rawCode.toUpperCase());
    if (app) {
      if (app.status !== "approved") {
        return res.status(400).json({ error: "NOT_APPROVED", message: "\u0637\u0644\u0628\u0643 \u0644\u0645 \u064A\u064F\u0639\u062A\u0645\u062F \u0628\u0639\u062F \u2014 \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F \u0639\u0628\u0631 \u0648\u0627\u062A\u0633\u0627\u0628." });
      }
      const linked = (app.tenantId ? db.getTenant(app.tenantId) : null) || db.getSchema().tenants.find((t) => t.phone === app.phone) || null;
      if (!linked) {
        return res.status(409).json({
          error: "NOT_ACTIVATED",
          message: "\u0643\u0648\u062F\u0643 \u0645\u0639\u062A\u0645\u062F \u0644\u0643\u0646 \u0627\u0644\u0645\u062A\u062C\u0631 \u0644\u0645 \u064A\u064F\u0646\u0634\u0623 \u0628\u0639\u062F \u2014 \u0627\u0636\u063A\u0637 \xAB\u062A\u0641\u0639\u064A\u0644 \u0645\u062A\u062C\u0631 \u0628\u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644\xBB \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0634\u0627\u0634\u0629."
        });
      }
      const appHash = merchantCodeHash(rawCode);
      if (appHash) db.setMerchantCode(linked.id, appHash, "self_activation", rawCode);
      db.commit();
      if (linked.status === "suspended") return res.status(403).json({ error: "TENANT_SUSPENDED", message: "\u0627\u0644\u0645\u062A\u062C\u0631 \u0645\u0648\u0642\u0648\u0641." });
      const appToken = issueMerchantSession(linked.id, String(linked.merchantCodeHash), res);
      if (!appToken) return res.status(500).json({ error: "ISSUE_FAILED", message: "\u062A\u0639\u0630\u0651\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0629." });
      db.logAudit({ tenantId: linked.id, actorId: "owner", actorName: app.ownerName || "\u0635\u0627\u062D\u0628 \u0627\u0644\u0645\u062A\u062C\u0631", action: "MERCHANT_LOGIN", entity: "Tenant", entityId: linked.id, details: "\u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u062A\u062C\u0631 \u0628\u0643\u0648\u062F \u0627\u0644\u062A\u0641\u0639\u064A\u0644 (\u0643\u0648\u062F \u0648\u0627\u062D\u062F)" });
      return res.json({
        success: true,
        token: appToken,
        tenant: { id: linked.id, name: linked.name, tradeName: linked.tradeName, slug: linked.slug, city: linked.city }
      });
    }
    const typed = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (typed.startsWith("SND") && typed.length >= 20) {
      const byPrefix = db.getSchema().tenants.filter(
        (t) => /^[0-9a-f]{64}$/.test(String(t.merchantCodeHash || "")) && String(t.merchantCodePrefix || "").toUpperCase().startsWith(typed.slice(0, 16))
      );
      if (byPrefix.length === 1) legacyByPrefix = byPrefix[0];
    }
    if (!legacyByPrefix) {
      return res.status(401).json({ error: "INVALID_CODE", message: "\u0643\u0648\u062F \u0627\u0644\u0645\u062A\u062C\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D. \u062A\u0623\u0643\u062F \u0645\u0646 \u0646\u0633\u062E\u0647 \u0643\u0645\u0627 \u0648\u0635\u0644\u0643 \u0645\u0646 \u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F." });
    }
  }
  let tenant = hash ? db.findTenantByMerchantCodeHash(hash) : legacyByPrefix || void 0;
  const hint = String(slug || tenantId || "").trim();
  if (hint) {
    const hinted = db.getTenant(hint) || db.getTenantBySlug(hint);
    if (!hinted) return res.status(404).json({ error: "TENANT_NOT_FOUND", message: "\u0627\u0644\u0645\u062A\u062C\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    if (hinted.id !== tenant?.id) {
      if (tenant) return res.status(401).json({ error: "CODE_TENANT_MISMATCH", message: "\u0627\u0644\u0631\u0645\u0632 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631." });
      const stored = hinted.merchantCodeHash;
      if (stored !== hash) return res.status(401).json({ error: "INVALID_CODE", message: "\u0627\u0644\u0631\u0645\u0632 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631." });
      tenant = hinted;
    }
  }
  if (!tenant) {
    const app = db.getTenantApplications().find((a) => (a.activationCode || "").toUpperCase() === rawCode.toUpperCase());
    if (app) {
      if (app.status !== "approved") {
        return res.status(400).json({ error: "NOT_APPROVED", message: "\u0637\u0644\u0628\u0643 \u0644\u0645 \u064A\u064F\u0639\u062A\u0645\u062F \u0628\u0639\u062F \u2014 \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F \u0639\u0628\u0631 \u0648\u0627\u062A\u0633\u0627\u0628." });
      }
      return res.status(409).json({
        error: "NOT_ACTIVATED",
        message: "\u0643\u0648\u062F\u0643 \u0635\u062D\u064A\u062D \u0648\u0645\u0639\u062A\u0645\u062F\u060C \u0644\u0643\u0646 \u0627\u0644\u0645\u062A\u062C\u0631 \u0644\u0645 \u064A\u064F\u0646\u0634\u0623 \u0628\u0639\u062F. \u0627\u0636\u063A\u0637 \xAB\u062A\u0641\u0639\u064A\u0644 \u0645\u062A\u062C\u0631 \u0628\u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644\xBB \u0641\u064A \u0646\u0641\u0633 \u0627\u0644\u0634\u0627\u0634\u0629 \u0648\u0627\u0643\u062A\u0628 \u0646\u0641\u0633 \u0627\u0644\u0643\u0648\u062F \u2014 \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0641\u0642\u0637."
      });
    }
    return res.status(401).json({ error: "INVALID_CODE", message: "\u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u2014 \u062A\u0623\u0643\u062F \u0645\u0646 \u0646\u0633\u062E\u0647 \u0643\u0645\u0627 \u0648\u0635\u0644\u0643 \u0645\u0646 \u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F." });
  }
  if (tenant.status === "suspended") return res.status(403).json({ error: "TENANT_SUSPENDED", message: "\u0627\u0644\u0645\u062A\u062C\u0631 \u0645\u0648\u0642\u0648\u0641." });
  const token2 = issueMerchantSession(tenant.id, hash, res);
  if (!token2) return res.status(500).json({ error: "ISSUE_FAILED", message: "\u062A\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0629." });
  res.json({ success: true, token: token2, tenant: { id: tenant.id, name: tenant.name, tradeName: tenant.tradeName, slug: tenant.slug, city: tenant.city } });
});
apiRouter.post("/auth/merchant/logout", (req, res) => {
  destroyMerchantSession(res);
  res.json({ success: true });
});
apiRouter.get("/auth/staff/list", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  res.json({ success: true, employees: listStaffForLogin(authReq.tenantId) });
});
apiRouter.get("/auth/staff/me", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const employee = (db.getSchema().employees || []).find((e) => e.id === authReq.actorId);
  res.json({
    success: true,
    authenticated: true,
    staffSession: !!req.staffSession,
    employee: employee ? { id: employee.id, name: employee.name, role: employee.role } : { id: authReq.actorId, name: authReq.actorName, role: authReq.actorRole }
  });
});
apiRouter.post("/auth/staff/login", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { employeeId, pin } = req.body || {};
  const result = staffPinMatches(authReq.tenantId, String(employeeId || ""), pin);
  if (result.error === "EMPLOYEE_NOT_FOUND") {
    return res.status(404).json({ error: "EMPLOYEE_NOT_FOUND", message: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631." });
  }
  if (result.error === "INVALID_PIN") {
    return res.status(401).json({ error: "INVALID_PIN", message: "\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0633\u0631\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u2014 \u062C\u0631\u0651\u0628 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0623\u0648 \u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0627\u0644\u0643." });
  }
  const tenant = db.getTenant(authReq.tenantId);
  const revision = String(tenant?.merchantCodeHash || "");
  const token2 = issueStaffSession(authReq.tenantId, revision, result.employee.id, res);
  if (!token2) return res.status(500).json({ error: "ISSUE_FAILED", message: "\u062A\u0639\u0630\u0651\u0631 \u0625\u0646\u0634\u0627\u0621 \u062C\u0644\u0633\u0629 \u0627\u0644\u0645\u0648\u0638\u0641." });
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: result.employee.id,
    actorName: result.employee.name,
    action: "STAFF_LOGIN",
    entity: "Employee",
    entityId: result.employee.id,
    details: `\u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u0648\u0638\u0641 ${result.employee.name} \u0628\u0631\u0645\u0632\u0647 \u0627\u0644\u0633\u0631\u064A`
  });
  res.json({
    success: true,
    token: token2,
    employee: { id: result.employee.id, name: result.employee.name, role: result.employee.role, permissions: result.employee.permissions || [] }
  });
});
apiRouter.post("/auth/staff/logout", (_req, res) => {
  destroyStaffSession(res);
  res.json({ success: true });
});
apiRouter.get("/auth/merchant/me", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const tenant = db.getTenant(authReq.tenantId);
  if (!tenant) return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  const { merchantCodeHash: _h, ...safe } = tenant;
  res.json({ authenticated: true, role: "merchant", tenant: safe });
});
apiRouter.get("/market/stores", (req, res) => {
  const schema = db.getSchema();
  const tenants = schema.tenants.filter((t) => t.status !== "suspended").map((t) => ({
    id: t.id,
    name: t.name,
    tradeName: t.tradeName,
    slug: t.slug,
    status: t.status,
    city: t.city,
    logo: t.logo,
    category: t.category || ""
  }));
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json({ tenants });
});
apiRouter.get("/tenants/list", adminAuthMiddleware, (req, res) => {
  const schema = db.getSchema();
  res.json({
    tenants: schema.tenants.filter((t) => t.status !== "suspended").map((t) => ({
      id: t.id,
      name: t.name,
      tradeName: t.tradeName,
      slug: t.slug,
      status: t.status,
      planId: t.subscriptionPlanId,
      city: t.city,
      phone: t.phone,
      address: t.address,
      logo: t.logo
    }))
  });
});
apiRouter.get("/tenants/current", merchantAuthMiddleware, (req, res) => {
  const tenant = db.getTenant(req.tenantId);
  if (!tenant) return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  const { merchantCodeHash: _h, ...safe } = tenant;
  res.json({ tenant: safe });
});
apiRouter.put("/tenants/current", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const tenant = db.getTenant(authReq.tenantId);
  if (!tenant) return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  const { name, tradeName, phone, city, address, settings } = req.body;
  if (name) tenant.name = name;
  if (tradeName) tenant.tradeName = tradeName;
  if (phone) tenant.phone = phone;
  if (city) tenant.city = city;
  if (address) tenant.address = address;
  if (settings) {
    tenant.settings = { ...tenant.settings, ...settings };
  }
  db.commit();
  db.logAudit({
    tenantId: tenant.id,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "UPDATE_TENANT_SETTINGS",
    entity: "Tenant",
    entityId: tenant.id,
    details: "\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0648\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0648\u0627\u0644\u0637\u0628\u0627\u0639\u0629"
  });
  const { merchantCodeHash: _hm, ...safeUpd } = tenant;
  res.json({ success: true, tenant: safeUpd });
});
apiRouter.get("/branches", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const branches = db.getBranches(authReq.tenantId);
  res.json({ branches });
});
apiRouter.post("/branches", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const tenant = db.getTenant(authReq.tenantId);
  const plan = db.getSchema().subscriptionPlans.find((p) => p.id === tenant?.subscriptionPlanId);
  const currentBranches = db.getBranches(authReq.tenantId);
  if (plan && currentBranches.length >= plan.maxBranches) {
    return res.status(400).json({
      error: `\u0648\u0635\u0644\u062A \u0644\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0644\u0644\u0641\u0631\u0648\u0639 \u0641\u064A \u0628\u0627\u0642\u062A\u0643 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 (${plan.maxBranches} \u0641\u0631\u0639). \u064A\u0631\u062C\u0649 \u062A\u0631\u0642\u064A\u0629 \u0627\u0644\u0628\u0627\u0642\u0629 \u0644\u0625\u0636\u0627\u0641\u0629 \u0641\u0631\u0648\u0639 \u062C\u062F\u064A\u062F\u0629.`
    });
  }
  const { name, code, city, address, phone, isMain } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0641\u0631\u0639 \u0648\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u062A\u0639\u0631\u064A\u0641\u064A \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
  }
  const newBranch = {
    id: newId("branch"),
    tenantId: authReq.tenantId,
    name,
    code,
    city: city || tenant?.city || "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: address || "",
    phone: phone || "",
    isMain: Boolean(isMain),
    isActive: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().branches.push(newBranch);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_BRANCH",
    entity: "Branch",
    entityId: newBranch.id,
    details: `\u0625\u0646\u0634\u0627\u0621 \u0641\u0631\u0639 \u062C\u062F\u064A\u062F: ${name} (${code})`
  });
  res.json({ success: true, branch: newBranch });
});
apiRouter.get("/employees", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const employees = db.getSchema().employees.filter((e) => e.tenantId === authReq.tenantId);
  res.json({ employees });
});
function resolveOwnerEmployee(tenantId, actorId) {
  const employees = db.getSchema().employees || [];
  if (actorId) {
    const byId = employees.find((e) => e.id === actorId && e.tenantId === tenantId);
    if (byId) return byId;
  }
  return employees.find((e) => e.tenantId === tenantId && e.role === "owner") || null;
}
var requireOwnerActor = (req, res, next) => {
  const actor = req;
  const owner = resolveOwnerEmployee(actor.tenantId, actor.actorId);
  const role = owner?.role || actor.actorRole;
  if (role !== "owner" && role !== "super_admin") {
    return res.status(403).json({ error: "OWNER_ONLY", message: "\u0627\u0644\u062A\u0635\u0631\u064A\u062D \u064A\u062D\u062A\u0627\u062C \u0631\u0645\u0632 \u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631 \u0646\u0641\u0633\u0647." });
  }
  req.ownerEmployee = owner;
  next();
};
apiRouter.post("/employees/approval-check", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { role, permissions } = req.body || {};
  const actorIsOwner = (resolveOwnerEmployee(authReq.tenantId, authReq.actorId)?.role || authReq.actorRole) === "owner";
  if (actorIsOwner) return res.json({ success: true, required: false, reason: "", actorIsOwner: true });
  const gate = requiresOwnerApproval(String(role || ""), Array.isArray(permissions) ? permissions.map(String) : []);
  res.json({ success: true, ...gate, actorIsOwner: false });
});
apiRouter.get("/employees/approvals", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  res.json({ success: true, approvals: listPending(authReq.tenantId) });
});
apiRouter.post("/employees/approvals", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { employeeName, employeeRole, permissions } = req.body || {};
  if (!employeeName || !employeeRole) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0638\u0641 \u0648\u062F\u0648\u0631\u0647 \u0645\u0637\u0644\u0648\u0628\u0627\u0646 \u0644\u0637\u0644\u0628 \u0627\u0644\u062A\u0635\u0631\u064A\u062D." });
  }
  const perms = Array.isArray(permissions) ? permissions.map(String) : [];
  const gate = requiresOwnerApproval(String(employeeRole), perms);
  if (!gate.required) {
    return res.json({ success: true, required: false, approval: null, reason: "" });
  }
  const approval = createApprovalRequest({
    tenantId: authReq.tenantId,
    requestedBy: authReq.actorName,
    requestedById: authReq.actorId,
    employeeName: String(employeeName).slice(0, 120),
    employeeRole: String(employeeRole),
    permissions: perms,
    reason: gate.reason
  });
  res.json({ success: true, required: true, approval, reason: gate.reason });
});
apiRouter.post("/employees/approvals/:id/approve", merchantAuthMiddleware, requireOwnerActor, (req, res) => {
  const authReq = req;
  const pin = String(req.body?.ownerPin || "").replace(/\D/g, "");
  const owner = req.ownerEmployee || resolveOwnerEmployee(authReq.tenantId, authReq.actorId);
  const ownerPin = String(owner?.pin || "");
  if (!ownerPin) {
    return res.status(409).json({ error: "OWNER_PIN_NOT_SET", message: "\u0644\u0645 \u064A\u064F\u0636\u0628\u0637 \u0631\u0645\u0632 \u0633\u0631\u064A \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631 \u0628\u0639\u062F \u2014 \u0627\u0636\u0628\u0637\u0647 \u0645\u0646 \u062A\u0628\u0648\u064A\u0628 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646." });
  }
  if (!pin || pin !== ownerPin) {
    return res.status(401).json({ error: "OWNER_PIN_INVALID", message: "\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0633\u0631\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u2014 \u0627\u0644\u062A\u0635\u0631\u064A\u062D \u064A\u062D\u062A\u0627\u062C \u0631\u0645\u0632 \u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631." });
  }
  const record = approve(authReq.tenantId, String(req.params.id), authReq.actorName);
  if (!record) {
    return res.status(404).json({ error: "APPROVAL_NOT_FOUND", message: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u062A\u0647." });
  }
  res.json({ success: true, approval: record });
});
apiRouter.post("/employees/approvals/:id/reject", merchantAuthMiddleware, requireOwnerActor, (req, res) => {
  const authReq = req;
  const record = reject(authReq.tenantId, String(req.params.id), authReq.actorName);
  if (!record) return res.status(404).json({ error: "APPROVAL_NOT_FOUND", message: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true, approval: record });
});
apiRouter.get("/employees/approvals/:id", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const record = getApproval(authReq.tenantId, String(req.params.id));
  if (!record) return res.status(404).json({ error: "APPROVAL_NOT_FOUND", message: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true, approval: record });
});
apiRouter.post("/employees", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const tenant = db.getTenant(authReq.tenantId);
  const plan = db.getSchema().subscriptionPlans.find((p) => p.id === tenant?.subscriptionPlanId);
  const currentEmployees = db.getSchema().employees.filter((e) => e.tenantId === authReq.tenantId);
  if (plan && currentEmployees.length >= plan.maxEmployees) {
    return res.status(400).json({
      error: `\u0648\u0635\u0644\u062A \u0644\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0641\u064A \u0628\u0627\u0642\u062A\u0643 (${plan.maxEmployees} \u0645\u0648\u0638\u0641). \u064A\u0631\u062C\u0649 \u062A\u0631\u0642\u064A\u0629 \u0627\u0634\u062A\u0631\u0627\u0643\u0643.`
    });
  }
  const { name, email, phone, role, pin, branchId, maxDiscountPct, permissions, approvalId } = req.body;
  if (!name || !role) {
    return res.status(400).json({ error: "\u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0645\u0633\u0645\u0649 \u0627\u0644\u0648\u0638\u064A\u0641\u064A \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
  }
  const requestedPerms = Array.isArray(permissions) ? permissions.map(String) : [];
  const actorIsOwner = (resolveOwnerEmployee(authReq.tenantId, authReq.actorId)?.role || authReq.actorRole) === "owner";
  const gate = actorIsOwner ? { required: false, reason: "" } : requiresOwnerApproval(String(role), requestedPerms);
  if (gate.required) {
    if (!approvalId) {
      return res.status(428).json({
        error: "OWNER_APPROVAL_REQUIRED",
        message: `\u0625\u0636\u0627\u0641\u0629 \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0638\u0641 \u062A\u062D\u062A\u0627\u062C \u062A\u0635\u0631\u064A\u062D \u0627\u0644\u0645\u0627\u0644\u0643: ${gate.reason}`,
        reason: gate.reason
      });
    }
    const consumed = consumeApproval(authReq.tenantId, String(approvalId));
    if (!consumed.ok) {
      return res.status(428).json({
        error: "OWNER_APPROVAL_INVALID",
        message: consumed.error || "\u0627\u0644\u062A\u0635\u0631\u064A\u062D \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.",
        reason: gate.reason
      });
    }
  }
  const pinClean = String(pin || "").replace(/\D/g, "").slice(0, 6);
  const newEmployee = {
    id: newId("emp"),
    tenantId: authReq.tenantId,
    branchId: branchId || void 0,
    name,
    email: email || "",
    phone: phone || "",
    role,
    pin: pinClean.length >= 4 ? pinClean : "0000",
    permissions: Array.isArray(permissions) && permissions.length ? permissions.map(String) : role === "owner" ? ["all"] : ["pos:sell", "inventory:view"],
    maxDiscountPct: Number(maxDiscountPct) || 10,
    isActive: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().employees.push(newEmployee);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_EMPLOYEE",
    entity: "Employee",
    entityId: newEmployee.id,
    details: `\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0638\u0641 \u062C\u062F\u064A\u062F: ${name} \u0628\u062F\u0642\u0629 \u062F\u0648\u0631: ${role}`
  });
  res.json({ success: true, employee: newEmployee });
});
apiRouter.put("/employees/:id", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const emp = db.getSchema().employees.find(
    (e) => e.id === req.params.id && e.tenantId === authReq.tenantId
  );
  if (!emp) return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  const { name, email, phone, role, pin, branchId, maxDiscountPct, permissions, isActive, approvalId } = req.body || {};
  const nextRole = typeof role === "string" && role ? role : emp.role;
  const nextPerms = Array.isArray(permissions) ? permissions.map(String) : emp.permissions || [];
  const actorIsOwner = (resolveOwnerEmployee(authReq.tenantId, authReq.actorId)?.role || authReq.actorRole) === "owner";
  const gate = actorIsOwner ? { required: false, reason: "" } : requiresOwnerApproval(String(nextRole), nextPerms);
  if (gate.required) {
    if (!approvalId) {
      return res.status(428).json({
        error: "OWNER_APPROVAL_REQUIRED",
        message: `\u062A\u0639\u062F\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0638\u0641 \u064A\u062D\u062A\u0627\u062C \u062A\u0635\u0631\u064A\u062D \u0627\u0644\u0645\u0627\u0644\u0643: ${gate.reason}`,
        reason: gate.reason
      });
    }
    const consumed = consumeApproval(authReq.tenantId, String(approvalId));
    if (!consumed.ok) {
      return res.status(428).json({ error: "OWNER_APPROVAL_INVALID", message: consumed.error || "\u0627\u0644\u062A\u0635\u0631\u064A\u062D \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.", reason: gate.reason });
    }
  }
  if (typeof name === "string" && name.trim()) emp.name = name.trim();
  if (typeof email === "string") emp.email = email;
  if (typeof phone === "string") emp.phone = phone;
  if (typeof role === "string" && role) emp.role = role;
  if (typeof branchId === "string") emp.branchId = branchId || void 0;
  if (maxDiscountPct !== void 0) emp.maxDiscountPct = Number(maxDiscountPct) || 0;
  if (typeof isActive === "boolean") emp.isActive = isActive;
  if (Array.isArray(permissions)) emp.permissions = permissions.map(String);
  if (typeof pin === "string") {
    const pinClean = pin.replace(/\D/g, "").slice(0, 6);
    if (pinClean.length >= 4) emp.pin = pinClean;
  }
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "UPDATE_EMPLOYEE",
    entity: "Employee",
    entityId: emp.id,
    details: `\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641: ${emp.name}`
  });
  res.json({ success: true, employee: emp });
});
apiRouter.delete("/employees/:id", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const list2 = db.getSchema().employees;
  const idx = list2.findIndex((e) => e.id === req.params.id && e.tenantId === authReq.tenantId);
  if (idx < 0) return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  const emp = list2[idx];
  if (emp.role === "owner") {
    const otherOwners = list2.filter(
      (e) => e.tenantId === authReq.tenantId && e.role === "owner" && e.id !== emp.id
    );
    if (otherOwners.length === 0) {
      return res.status(400).json({ error: "\u0645\u0627 \u064A\u0646\u0641\u0639 \u062A\u062D\u0630\u0641 \u0627\u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0648\u062D\u064A\u062F \u0644\u0644\u0645\u062A\u062C\u0631" });
    }
  }
  list2.splice(idx, 1);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "DELETE_EMPLOYEE",
    entity: "Employee",
    entityId: emp.id,
    details: `\u062D\u0630\u0641 \u0627\u0644\u0645\u0648\u0638\u0641: ${emp.name}`
  });
  res.json({ success: true });
});
apiRouter.get("/products", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const products = db.getProducts(authReq.tenantId).filter((p) => p.isActive !== false);
  res.json({ products });
});
apiRouter.post("/products", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const {
    name,
    sku,
    barcode,
    category,
    unit,
    purchaseCost,
    costCurrency,
    sellingPriceSdg,
    minStockAlert,
    initialStock,
    branchId,
    imageUrl,
    videoUrl,
    isTaxExempt,
    customTaxRate
  } = req.body;
  if (!name || !sellingPriceSdg) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C \u0648\u0633\u0639\u0631 \u0627\u0644\u0628\u064A\u0639 \u0628\u0627\u0644\u062C\u0646\u064A\u0647 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
  }
  const newProduct = {
    id: newId("prod"),
    tenantId: authReq.tenantId,
    name,
    sku: sku || newCode("SKU"),
    barcode: barcode || Math.floor(1e11 + Math.random() * 9e11).toString(),
    category: category || "\u0639\u0627\u0645",
    unit: unit || "\u062D\u0628\u0629",
    purchaseCost: Number(purchaseCost) || 0,
    costCurrency: costCurrency || "SDG",
    sellingPriceSdg: Number(sellingPriceSdg),
    minStockAlert: Number(minStockAlert) || 5,
    minimumStock: Number(minStockAlert) || 5,
    imageUrl: imageUrl ? String(imageUrl) : void 0,
    videoUrl: videoUrl ? String(videoUrl) : void 0,
    isTaxExempt: Boolean(isTaxExempt),
    customTaxRate: customTaxRate !== void 0 && customTaxRate !== "" ? Number(customTaxRate) : void 0,
    isActive: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().products.push(newProduct);
  if (initialStock && branchId && Number(initialStock) > 0) {
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId,
      productId: newProduct.id,
      delta: Number(initialStock),
      type: "purchase_receive",
      reason: "\u0631\u0635\u064A\u062F \u0623\u0648\u0644\u064A \u0639\u0646\u062F \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0646\u062A\u062C",
      actorName: authReq.actorName
    });
  }
  db.commit();
  res.json({ success: true, product: newProduct });
});
var requireProductEditor = (req, res, next) => {
  const actor = req;
  const employee = db.getSchema().employees.find((e) => e.tenantId === actor.tenantId && e.id === actor.actorId);
  const perms = resolveActorPerms(actor.actorRole, employee);
  if (!perms.editPrices) return res.status(403).json({ error: "\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0623\u0635\u0646\u0627\u0641." });
  next();
};
apiRouter.put("/products/:id", merchantAuthMiddleware, requireProductEditor, (req, res) => {
  const actor = req;
  const product = db.getSchema().products.find((p) => p.id === req.params.id && p.tenantId === actor.tenantId && p.isActive !== false);
  if (!product) return res.status(404).json({ error: "\u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0645\u062A\u062C\u0631\u0643." });
  const body = req.body || {};
  const textFields = ["name", "sku", "barcode", "category", "unit", "costCurrency", "imageUrl", "videoUrl"];
  for (const field of textFields) {
    if (field in body && (typeof body[field] !== "string" || body[field].length > (field === "imageUrl" || field === "videoUrl" ? 2048 : 250)))
      return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629." });
  }
  if ("name" in body && !body.name.trim()) return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641 \u0645\u0637\u0644\u0648\u0628." });
  for (const field of ["purchaseCost", "sellingPriceSdg", "minStockAlert", "customTaxRate"]) {
    if (field in body && !(field === "customTaxRate" && body[field] === null) && (typeof body[field] !== "number" || !Number.isFinite(body[field]) || body[field] < 0 || field === "customTaxRate" && body[field] > 100))
      return res.status(400).json({ error: "\u062A\u0623\u0643\u062F \u0645\u0646 \u0635\u062D\u0629 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0648\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649 \u0648\u0627\u0644\u0636\u0631\u064A\u0628\u0629." });
  }
  if ("sellingPriceSdg" in body && !(body.sellingPriceSdg > 0)) return res.status(400).json({ error: "\u0633\u0639\u0631 \u0627\u0644\u0628\u064A\u0639 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631." });
  if ("isTaxExempt" in body && typeof body.isTaxExempt !== "boolean") return res.status(400).json({ error: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0636\u0631\u064A\u0628\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629." });
  if ("barcode" in body && body.barcode.trim() && normalizeBarcode(body.barcode) !== normalizeBarcode(product.barcode)) {
    const code = normalizeBarcode(body.barcode);
    const duplicate = db.getProducts(actor.tenantId).find((p) => p.id !== product.id && p.isActive !== false && normalizeBarcode(p.barcode) === code);
    if (duplicate) return res.status(409).json({ error: `\u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644 \u0644\u0644\u0635\u0646\u0641 \xAB${duplicate.name}\xBB.` });
  }
  const employee = db.getSchema().employees.find((e) => e.tenantId === actor.tenantId && e.id === actor.actorId);
  if ("purchaseCost" in body && !resolveActorPerms(actor.actorRole, employee).viewCogs) return res.status(403).json({ error: "\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0634\u0631\u0627\u0621." });
  if ("stockQuantity" in body) {
    const { branchId, stockQuantity, expectedStock } = body;
    const branch = db.getSchema().branches.find((b) => b.id === branchId && b.tenantId === actor.tenantId);
    if (!branch || typeof stockQuantity !== "number" || !Number.isFinite(stockQuantity) || typeof expectedStock !== "number" || !Number.isFinite(expectedStock))
      return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0631\u0635\u064A\u062F \u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629." });
    const current = db.getProductStock(actor.tenantId, branchId, product.id);
    if (current !== expectedStock) return res.status(409).json({ error: "\u0627\u0644\u0631\u0635\u064A\u062F \u062A\u063A\u064A\u0631 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u062A\u0639\u062F\u064A\u0644. \u0623\u063A\u0644\u0642 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644 \u0648\u0623\u0639\u062F \u0641\u062A\u062D\u0647\u0627 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629." });
    if (stockQuantity !== current) {
      const adjustment = db.adjustStock({ tenantId: actor.tenantId, branchId, productId: product.id, delta: stockQuantity - current, type: "adjustment", reason: "\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0631\u0635\u064A\u062F \u0645\u0646 \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0635\u0646\u0641", actorName: actor.actorName });
      if (!adjustment.success) return res.status(400).json({ error: adjustment.error });
    }
  }
  for (const field of textFields) if (field in body) product[field] = body[field].trim();
  for (const field of ["purchaseCost", "sellingPriceSdg", "minStockAlert"]) if (field in body) product[field] = body[field];
  if ("minStockAlert" in body) product.minimumStock = body.minStockAlert;
  if ("isTaxExempt" in body) product.isTaxExempt = body.isTaxExempt;
  if ("customTaxRate" in body) product.customTaxRate = body.customTaxRate === null ? void 0 : body.customTaxRate;
  db.commit();
  db.logAudit({ tenantId: actor.tenantId, actorId: actor.actorId, actorName: actor.actorName, action: "UPDATE_PRODUCT", entity: "Product", entityId: product.id, details: `\u062A\u0639\u062F\u064A\u0644 \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0635\u0646\u0641 \xAB${product.name}\xBB` });
  res.json({ success: true, product });
});
apiRouter.delete("/products/:id", merchantAuthMiddleware, requireProductEditor, (req, res) => {
  const actor = req;
  const product = db.getSchema().products.find((p) => p.id === req.params.id && p.tenantId === actor.tenantId && p.isActive !== false);
  if (!product) return res.status(404).json({ error: "\u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0645\u062A\u062C\u0631\u0643." });
  product.isActive = false;
  for (const alert of db.getSchema().inventoryAlerts || []) {
    if (alert.tenantId === actor.tenantId && alert.productId === product.id) alert.status = "dismissed";
  }
  db.commit();
  db.logAudit({ tenantId: actor.tenantId, actorId: actor.actorId, actorName: actor.actorName, action: "ARCHIVE_PRODUCT", entity: "Product", entityId: product.id, details: `\u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0635\u0646\u0641 \xAB${product.name}\xBB \u0645\u0646 \u0627\u0644\u0642\u0648\u0627\u0626\u0645 \u0645\u0639 \u062D\u0641\u0638 \u0633\u062C\u0644\u0647` });
  res.json({ success: true });
});
apiRouter.get("/inventory", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const inventory = db.getInventory(authReq.tenantId, branchId);
  res.json({ inventory });
});
apiRouter.post("/inventory/adjust", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { branchId, productId, delta, reason, type } = req.body;
  if (!branchId || !productId || delta === void 0 || !reason) {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u062E\u0632\u0646\u064A \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 (\u0627\u0644\u0641\u0631\u0639\u060C \u0627\u0644\u0645\u0646\u062A\u062C\u060C \u0627\u0644\u0643\u0645\u064A\u0629\u060C \u0648\u0627\u0644\u0633\u0628\u0628)" });
  }
  const result = db.adjustStock({
    tenantId: authReq.tenantId,
    branchId,
    productId,
    delta: Number(delta),
    type: type || "adjustment",
    reason,
    actorName: authReq.actorName
  });
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "ADJUST_STOCK",
    entity: "BranchInventory",
    entityId: productId,
    details: `\u062A\u0639\u062F\u064A\u0644 \u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0628\u0645\u0642\u062F\u0627\u0631 (${delta}) \u0641\u064A \u0627\u0644\u0641\u0631\u0639. \u0627\u0644\u0633\u0628\u0628: ${reason}`
  });
  res.json({ success: true, newBalance: result.newBalance });
});
apiRouter.get("/inventory/movements", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const movements = db.getSchema().stockMovements.filter((m) => m.tenantId === authReq.tenantId && (!branchId || m.branchId === branchId));
  res.json({ movements });
});
apiRouter.get("/inventory/alerts", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const alerts = db.getInventoryAlerts(authReq.tenantId, branchId);
  const unreadCount = alerts.filter((a) => a.status === "unread").length;
  const criticalCount = alerts.filter((a) => a.severity === "critical" && a.status !== "dismissed").length;
  res.json({ alerts, unreadCount, criticalCount });
});
apiRouter.post("/inventory/alerts/sync", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const branchId = req.body?.branchId;
  const alerts = db.syncInventoryAlerts(authReq.tenantId);
  const filtered = alerts.filter((a) => !branchId || a.branchId === branchId);
  const unreadCount = filtered.filter((a) => a.status === "unread").length;
  const criticalCount = filtered.filter((a) => a.severity === "critical" && a.status !== "dismissed").length;
  res.json({ success: true, alerts: filtered, unreadCount, criticalCount });
});
apiRouter.post("/inventory/alerts/:id/read", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const success = db.markInventoryAlertRead(authReq.tenantId, req.params.id);
  res.json({ success });
});
apiRouter.post("/inventory/alerts/:id/dismiss", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const success = db.dismissInventoryAlert(authReq.tenantId, req.params.id);
  res.json({ success });
});
apiRouter.post("/inventory/import-csv", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { branchId, items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "\u0645\u0644\u0641 \u0623\u0648 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0645\u0631\u0627\u062F \u0627\u0633\u062A\u064A\u0631\u0627\u062F\u0647\u0627 \u0641\u0627\u0631\u063A\u0629" });
  }
  const result = db.importProductsCsv({
    tenantId: authReq.tenantId,
    branchId: branchId || "",
    items,
    actorName: authReq.actorName
  });
  res.json(result);
});
apiRouter.get("/inventory/audits", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const audits = db.getInventoryAudits(authReq.tenantId, branchId);
  res.json({ success: true, audits });
});
apiRouter.get("/inventory/audits/:id", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const audit = db.getInventoryAudit(authReq.tenantId, req.params.id);
  if (!audit) {
    return res.status(404).json({ error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  res.json({ success: true, audit });
});
apiRouter.post("/inventory/audits", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { branchId, title, scope, categoryFilter, deviceInfo, notes } = req.body;
  if (!branchId) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0645\u0631\u0627\u062F \u062A\u062F\u0642\u064A\u0642 \u0645\u062E\u0632\u0648\u0646\u0647" });
  }
  const audit = db.createInventoryAudit({
    tenantId: authReq.tenantId,
    branchId,
    title: title || "\u062C\u0644\u0633\u0629 \u062C\u0631\u062F \u0630\u0643\u064A\u0629 \u0633\u0631\u064A\u0639\u0629",
    auditorId: authReq.actorId,
    auditorName: authReq.actorName,
    auditorRole: authReq.actorRole,
    scope,
    categoryFilter,
    deviceInfo,
    notes
  });
  res.status(201).json({ success: true, audit });
});
apiRouter.put("/inventory/audits/:id", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const updated = db.updateInventoryAudit(authReq.tenantId, req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  res.json({ success: true, audit: updated });
});
apiRouter.post("/inventory/audits/:id/reconcile", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const result = db.reconcileInventoryAudit({
    tenantId: authReq.tenantId,
    auditId: req.params.id,
    actorName: authReq.actorName,
    actorId: authReq.actorId
  });
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true, audit: result.audit, adjustedCount: result.adjustedCount });
});
apiRouter.post("/inventory/audits/:id/cancel", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const result = db.cancelInventoryAudit(authReq.tenantId, req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true });
});
apiRouter.get("/transfers", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const transfers = db.getSchema().branchTransfers.filter((t) => t.tenantId === authReq.tenantId);
  res.json({ transfers });
});
apiRouter.post("/transfers/request", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { sourceBranchId, targetBranchId, items, notes } = req.body;
  if (!sourceBranchId || !targetBranchId || !items || !items.length) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0641\u0631\u0639 \u0627\u0644\u0645\u0635\u062F\u0631 \u0648\u0641\u0631\u0639 \u0627\u0644\u0648\u062C\u0647\u0629 \u0648\u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629" });
  }
  if (sourceBranchId === targetBranchId) {
    return res.status(400).json({ error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0644\u0646\u0641\u0633 \u0627\u0644\u0641\u0631\u0639" });
  }
  const sourceBranch = db.getSchema().branches.find((b) => b.id === sourceBranchId);
  const targetBranch = db.getSchema().branches.find((b) => b.id === targetBranchId);
  const transferNumber = `TRF-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
  const newTransfer = {
    id: newId("trf"),
    tenantId: authReq.tenantId,
    transferNumber,
    sourceBranchId,
    sourceBranchName: sourceBranch?.name || "\u0641\u0631\u0639 \u0627\u0644\u0645\u0635\u062F\u0631",
    targetBranchId,
    targetBranchName: targetBranch?.name || "\u0641\u0631\u0639 \u0627\u0644\u0648\u062C\u0647\u0629",
    status: "requested",
    items: items.map((i) => ({
      productId: i.productId,
      productName: i.productName || "\u0645\u0646\u062A\u062C",
      requestedQty: Number(i.requestedQty),
      dispatchedQty: 0,
      receivedQty: 0
    })),
    notes,
    createdBy: authReq.actorName,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().branchTransfers.unshift(newTransfer);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_TRANSFER_REQUEST",
    entity: "BranchTransfer",
    entityId: newTransfer.id,
    details: `\u0625\u0646\u0634\u0627\u0621 \u0637\u0644\u0628 \u062A\u062D\u0648\u064A\u0644 \u0628\u0636\u0627\u0639\u0629 ${transferNumber} \u0645\u0646 ${newTransfer.sourceBranchName} \u0625\u0644\u0649 ${newTransfer.targetBranchName}`
  });
  res.json({ success: true, transfer: newTransfer });
});
apiRouter.post("/transfers/:id/dispatch", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const transfer = db.getSchema().branchTransfers.find((t) => t.id === req.params.id && t.tenantId === authReq.tenantId);
  if (!transfer) return res.status(404).json({ error: "\u0637\u0644\u0628 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  if (transfer.status !== "requested") return res.status(400).json({ error: "\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0644\u0627 \u062A\u0633\u0645\u062D \u0628\u0627\u0644\u0625\u0631\u0633\u0627\u0644" });
  for (const item of transfer.items) {
    const qtyToDispatch = item.requestedQty;
    const currentStock = db.getProductStock(authReq.tenantId, transfer.sourceBranchId, item.productId);
    if (currentStock < qtyToDispatch) {
      return res.status(400).json({
        error: `\u0631\u0635\u064A\u062F \u0627\u0644\u0635\u0646\u0641 "${item.productName}" \u0641\u064A \u0641\u0631\u0639 \u0627\u0644\u0645\u0635\u062F\u0631 (${currentStock}) \u063A\u064A\u0631 \u0643\u0627\u0641\u064D \u0644\u062A\u062D\u0648\u064A\u0644 (${qtyToDispatch})`
      });
    }
  }
  for (const item of transfer.items) {
    item.dispatchedQty = item.requestedQty;
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId: transfer.sourceBranchId,
      productId: item.productId,
      delta: -item.dispatchedQty,
      type: "transfer_out",
      reason: `\u062A\u0631\u062D\u064A\u0644 \u0635\u0627\u062F\u0631 \u0625\u0644\u0649 ${transfer.targetBranchName} (\u0625\u0631\u0633\u0627\u0644\u064A\u0629 ${transfer.transferNumber})`,
      actorName: authReq.actorName,
      referenceId: transfer.id
    });
  }
  transfer.status = "dispatched";
  transfer.dispatchedBy = authReq.actorName;
  transfer.dispatchedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "DISPATCH_TRANSFER",
    entity: "BranchTransfer",
    entityId: transfer.id,
    details: `\u0625\u0631\u0633\u0627\u0644 \u0634\u062D\u0646\u0629 \u0628\u0636\u0627\u0639\u0629 ${transfer.transferNumber} \u0648\u062E\u0635\u0645\u0647\u0627 \u0645\u0646 \u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u0645\u0635\u062F\u0631`
  });
  res.json({ success: true, transfer });
});
apiRouter.post("/transfers/:id/receive", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const transfer = db.getSchema().branchTransfers.find((t) => t.id === req.params.id && t.tenantId === authReq.tenantId);
  if (!transfer) return res.status(404).json({ error: "\u0637\u0644\u0628 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  if (transfer.status !== "dispatched") return res.status(400).json({ error: "\u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0644\u0645 \u064A\u062A\u0645 \u0625\u0631\u0633\u0627\u0644\u0647 \u0628\u0639\u062F \u0623\u0648 \u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645\u0647 \u0645\u0633\u0628\u0642\u0627\u064B" });
  const { receivedItems, receiverNotes } = req.body;
  let hasDiscrepancy = false;
  for (const item of transfer.items) {
    const received = receivedItems?.find((r) => r.productId === item.productId);
    const actualReceivedQty = received ? Number(received.receivedQty) : item.dispatchedQty;
    item.receivedQty = actualReceivedQty;
    if (actualReceivedQty !== item.dispatchedQty) {
      hasDiscrepancy = true;
      item.notes = `\u0641\u0627\u0631\u0642 \u0627\u0633\u062A\u0644\u0627\u0645: \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 ${item.dispatchedQty} \u0648\u0627\u0633\u062A\u0644\u0645 \u0641\u0639\u0644\u064A\u0627\u064B ${actualReceivedQty}`;
    }
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId: transfer.targetBranchId,
      productId: item.productId,
      delta: actualReceivedQty,
      type: "transfer_in",
      reason: `\u062A\u0631\u062D\u064A\u0644 \u0648\u0627\u0631\u062F \u0645\u0646 ${transfer.sourceBranchName} (\u0625\u0631\u0633\u0627\u0644\u064A\u0629 ${transfer.transferNumber})`,
      actorName: authReq.actorName,
      referenceId: transfer.id
    });
  }
  transfer.status = hasDiscrepancy ? "discrepancy_reported" : "received";
  transfer.receivedBy = authReq.actorName;
  transfer.receivedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (receiverNotes) {
    transfer.notes = (transfer.notes ? transfer.notes + "\n" : "") + `\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645: ${receiverNotes}`;
  }
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: hasDiscrepancy ? "RECEIVE_TRANSFER_DISCREPANCY" : "RECEIVE_TRANSFER_COMPLETE",
    entity: "BranchTransfer",
    entityId: transfer.id,
    details: `\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0634\u062D\u0646\u0629 ${transfer.transferNumber} \u0645\u0639 \u062D\u0627\u0644\u0629: ${transfer.status}`
  });
  res.json({ success: true, transfer });
});
apiRouter.get("/pos/shifts/current", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const cashierId = req.query.cashierId || authReq.actorId;
  const branchId = req.query.branchId;
  const openShift = db.getSchema().cashierShifts.find((s) => {
    return s.tenantId === authReq.tenantId && s.status === "open" && (!cashierId || s.cashierId === cashierId);
  });
  res.json({ shift: openShift || null });
});
apiRouter.post("/pos/shifts/open", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { branchId, openingCashSdg, cashierId, cashierName } = req.body;
  if (!branchId) return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0641\u0631\u0639 \u0644\u0641\u062A\u062D \u0627\u0644\u0648\u0631\u062F\u064A\u0629" });
  const existing = db.getSchema().cashierShifts.find((s) => s.tenantId === authReq.tenantId && s.cashierId === (cashierId || authReq.actorId) && s.status === "open");
  if (existing) {
    return res.status(400).json({ error: "\u0644\u062F\u064A\u0643 \u0648\u0631\u062F\u064A\u0629 \u0645\u0641\u062A\u0648\u062D\u0629 \u0628\u0627\u0644\u0641\u0639\u0644\u060C \u064A\u0631\u062C\u0649 \u0625\u063A\u0644\u0627\u0642\u0647\u0627 \u0623\u0648\u0644\u0627\u064B", shift: existing });
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId);
  const newShift = {
    id: newId("shift"),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    cashierId: cashierId || authReq.actorId,
    cashierName: cashierName || authReq.actorName,
    openedAt: (/* @__PURE__ */ new Date()).toISOString(),
    openingCashSdg: Number(openingCashSdg) || 0,
    expectedCashSdg: Number(openingCashSdg) || 0,
    totalSalesSdg: 0,
    totalCashSalesSdg: 0,
    totalBankakSalesSdg: 0,
    totalCardSalesSdg: 0,
    salesCount: 0,
    refundsCount: 0,
    refundsTotalSdg: 0,
    status: "open"
  };
  db.getSchema().cashierShifts.unshift(newShift);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "OPEN_SHIFT",
    entity: "CashierShift",
    entityId: newShift.id,
    details: `\u0627\u0641\u062A\u062A\u0627\u062D \u0648\u0631\u062F\u064A\u0629 \u062C\u062F\u064A\u062F\u0629 \u0628\u0631\u0635\u064A\u062F \u0623\u0648\u0644\u064A: ${openingCashSdg || 0} \u062C.\u0633`
  });
  res.json({ success: true, shift: newShift });
});
apiRouter.post("/pos/shifts/close", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { shiftId, actualCashSdg, closeNotes } = req.body;
  const shift = db.getSchema().cashierShifts.find((s) => s.id === shiftId && s.tenantId === authReq.tenantId);
  if (!shift) return res.status(404).json({ error: "\u0627\u0644\u0648\u0631\u062F\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  if (shift.status !== "open") return res.status(400).json({ error: "\u0627\u0644\u0648\u0631\u062F\u064A\u0629 \u0645\u063A\u0644\u0642\u0629 \u0645\u0633\u0628\u0642\u0627\u064B" });
  const counted = Number(actualCashSdg);
  const diff = counted - shift.expectedCashSdg;
  shift.status = "closed";
  shift.closedAt = (/* @__PURE__ */ new Date()).toISOString();
  shift.actualCashSdg = counted;
  shift.differenceSdg = diff;
  shift.closeNotes = closeNotes;
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CLOSE_SHIFT",
    entity: "CashierShift",
    entityId: shift.id,
    details: `\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0648\u0631\u062F\u064A\u0629 - \u0627\u0644\u0646\u0642\u062F \u0627\u0644\u0645\u062A\u0648\u0642\u0639: ${shift.expectedCashSdg} \u062C.\u0633 | \u0627\u0644\u0641\u0639\u0644\u064A: ${counted} \u062C.\u0633 | \u0627\u0644\u0641\u0627\u0631\u0642: ${diff} \u062C.\u0633`
  });
  res.json({ success: true, shift });
});
apiRouter.post("/pos/shifts/:id/review", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const shift = db.getSchema().cashierShifts.find((s) => s.id === req.params.id && s.tenantId === authReq.tenantId);
  if (!shift) return res.status(404).json({ error: "\u0627\u0644\u0648\u0631\u062F\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  const { reviewNotes } = req.body;
  shift.status = "reviewed";
  shift.supervisorReviewedBy = authReq.actorName;
  shift.supervisorReviewNotes = reviewNotes || "\u062A\u0645 \u0627\u0644\u062A\u062F\u0642\u064A\u0642 \u0648\u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629";
  shift.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "REVIEW_SHIFT",
    entity: "CashierShift",
    entityId: shift.id,
    details: `\u062A\u062F\u0642\u064A\u0642 \u0648\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0648\u0631\u062F\u064A\u0629 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u0634\u0631\u0641: ${authReq.actorName}`
  });
  res.json({ success: true, shift });
});
apiRouter.get("/pos/shifts", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const shifts = db.getSchema().cashierShifts.filter((s) => s.tenantId === authReq.tenantId);
  res.json({ shifts });
});
apiRouter.post("/pos/sales", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const {
    id,
    // client-generated UUID for idempotency & offline sync
    branchId,
    shiftId,
    customerName,
    customerPhone,
    customerId,
    items,
    paymentMethod,
    splitDetails,
    paymentReference,
    discountTotalSdg,
    isOfflineCreated,
    vatEnabled: clientVatEnabled,
    defaultVatPct: clientDefaultVatPct,
    pricesIncludeVat: clientPricesIncludeVat
  } = req.body;
  if (!branchId || !items || !items.length) {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 (\u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0641\u0631\u0639 \u0648\u0627\u0644\u0623\u0635\u0646\u0627\u0641)" });
  }
  if (id) {
    const existing = db.getSchema().sales.find((s) => s.id === id && s.tenantId === authReq.tenantId);
    if (existing) {
      return res.json({ success: true, sale: existing, isDuplicate: true });
    }
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId && b.tenantId === authReq.tenantId);
  if (!branch) return res.status(400).json({ error: "\u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631." });
  for (const it of items) {
    const prod = db.getSchema().products.find((p) => p.id === it.productId && p.tenantId === authReq.tenantId);
    if (!prod) return res.status(400).json({ error: `\u0627\u0644\u0635\u0646\u0641 ${it.productId} \u0644\u0627 \u064A\u062A\u0628\u0639 \u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631.` });
    if (prod.isActive === false && !isOfflineCreated) return res.status(409).json({ error: `\u0627\u0644\u0635\u0646\u0641 \xAB${prod.name}\xBB \u0623\u064F\u0632\u064A\u0644 \u0645\u0646 \u0627\u0644\u0645\u062A\u062C\u0631.` });
  }
  if (shiftId) {
    const shiftCheck = db.getSchema().cashierShifts.find((s) => s.id === shiftId && s.tenantId === authReq.tenantId);
    if (!shiftCheck) return res.status(400).json({ error: "\u0627\u0644\u0648\u0631\u062F\u064A\u0629 \u0644\u0627 \u062A\u062A\u0628\u0639 \u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631." });
    if (shiftCheck.branchId !== branchId) return res.status(400).json({ error: "\u0627\u0644\u0648\u0631\u062F\u064A\u0629 \u0644\u0627 \u062A\u062A\u0628\u0639 \u0646\u0641\u0633 \u0627\u0644\u0641\u0631\u0639." });
  }
  if (customerId) {
    const custCheck = db.getSchema().customers.find((c) => c.id === customerId && c.tenantId === authReq.tenantId);
    if (!custCheck) return res.status(400).json({ error: "\u0627\u0644\u0639\u0645\u064A\u0644 \u0644\u0627 \u064A\u062A\u0628\u0639 \u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631." });
  }
  if (!isOfflineCreated && items.some((item) => db.getSchema().products.some((p) => p.id === item.productId && p.tenantId === authReq.tenantId && p.isActive === false))) {
    return res.status(409).json({ error: "\u0623\u062D\u062F \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0623\u064F\u0632\u064A\u0644 \u0645\u0646 \u0627\u0644\u0645\u062A\u062C\u0631. \u062D\u062F\u0651\u062B \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0648\u0623\u0639\u062F \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629." });
  }
  const tenant = db.getTenant(authReq.tenantId);
  const isVatActive = clientVatEnabled !== void 0 ? Boolean(clientVatEnabled) : tenant?.settings?.vatEnabled ?? true;
  const effectiveDefaultVatPct = Number(clientDefaultVatPct ?? tenant?.settings?.defaultVatPct ?? 15);
  const isPricesIncludeVat = clientPricesIncludeVat !== void 0 ? Boolean(clientPricesIncludeVat) : tenant?.settings?.pricesIncludeVat ?? false;
  let subtotal = 0;
  let computedTaxTotal = 0;
  const processedItems = [];
  for (const item of items) {
    const product = db.getSchema().products.find((p) => p.id === item.productId && p.tenantId === authReq.tenantId);
    const qty = Number(item.quantity);
    const unitPrice = Number(item.unitPriceSdg || product?.sellingPriceSdg || 0);
    const discount = Number(item.discountSdg || 0);
    const total = qty * unitPrice - discount;
    subtotal += total;
    const isTaxExempt = item.isTaxExempt !== void 0 ? Boolean(item.isTaxExempt) : Boolean(product?.isTaxExempt);
    const taxRate = isTaxExempt || !isVatActive ? 0 : Number(item.taxRate ?? product?.customTaxRate ?? effectiveDefaultVatPct);
    let itemTax = 0;
    if (isVatActive && taxRate > 0) {
      if (isPricesIncludeVat) {
        itemTax = total - total / (1 + taxRate / 100);
      } else {
        itemTax = total * (taxRate / 100);
      }
    }
    computedTaxTotal += itemTax;
    processedItems.push({
      productId: item.productId,
      productName: product?.name || item.productName || "\u0635\u0646\u0641",
      unit: product?.unit || item.unit || "\u062D\u0628\u0629",
      quantity: qty,
      unitPriceSdg: unitPrice,
      discountSdg: discount,
      totalSdg: total,
      costPerUnitSdg: product?.purchaseCost || 0,
      notes: item.notes || void 0,
      isTaxExempt,
      taxRate,
      taxAmountSdg: Math.round(itemTax * 100) / 100
    });
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId,
      productId: item.productId,
      delta: -qty,
      type: "sale_deduction",
      reason: `\u0628\u064A\u0639 \u0645\u0628\u0627\u0634\u0631 \u0641\u064A \u0627\u0644\u0643\u0627\u0634\u064A\u0631`,
      actorName: authReq.actorName
    });
  }
  const taxTotal = Math.round(computedTaxTotal * 100) / 100;
  const discountTotal = Number(discountTotalSdg) || 0;
  const grandTotal = isPricesIncludeVat ? Math.max(0, subtotal - discountTotal) : Math.max(0, subtotal - discountTotal + taxTotal);
  const invoiceNumber = `INV-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(1e5 + Math.random() * 9e5)}`;
  let linkedCustomerId = customerId || void 0;
  if (!linkedCustomerId && customerPhone && customerPhone.trim().length >= 7) {
    const foundCust = db.getCustomers(authReq.tenantId).find((c) => c.phone.trim() === customerPhone.trim());
    if (foundCust) linkedCustomerId = foundCust.id;
  }
  let earnedPoints = 0;
  let updatedCustomer = null;
  if (linkedCustomerId) {
    const loyaltyRes = db.recordCustomerSale(authReq.tenantId, linkedCustomerId, grandTotal);
    if (loyaltyRes) {
      earnedPoints = loyaltyRes.earnedPoints;
      updatedCustomer = loyaltyRes.cust;
    }
  }
  const sale = {
    id: id || newId("sale"),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    shiftId: shiftId || "",
    invoiceNumber,
    customerId: linkedCustomerId,
    customerName: customerName || (updatedCustomer ? updatedCustomer.name : "\u0639\u0645\u064A\u0644 \u0646\u0642\u062F\u064A"),
    customerPhone: customerPhone || (updatedCustomer ? updatedCustomer.phone : ""),
    items: processedItems,
    subtotalSdg: subtotal,
    discountTotalSdg: discountTotal,
    taxTotalSdg: taxTotal,
    grandTotalSdg: grandTotal,
    paymentMethod: paymentMethod || "cash",
    splitDetails,
    multiCurrency: req.body.multiCurrency || void 0,
    paymentReference,
    status: "completed",
    cashierId: authReq.actorId,
    cashierName: authReq.actorName,
    isOfflineCreated: Boolean(isOfflineCreated),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().sales.unshift(sale);
  const itemsWithNotes = processedItems.filter((it) => it.notes && it.notes.trim().length > 0);
  if (itemsWithNotes.length > 0 || req.body.isQuickOrder || req.body.orderType) {
    const kTicket = {
      id: newId("kds"),
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      tenantId: authReq.tenantId,
      branchId,
      branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
      customerName: sale.customerName,
      orderType: req.body.orderType || (itemsWithNotes.length > 0 ? "quick_order" : "takeaway"),
      items: (itemsWithNotes.length > 0 ? itemsWithNotes : processedItems).map((it, idx) => ({
        id: newId(`kds_it_${idx}`),
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unit: it.unit,
        notes: it.notes || "\u0637\u0644\u0628 \u0633\u0631\u064A\u0639",
        status: "pending"
      })),
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.createKitchenTicket(kTicket);
  }
  if (shiftId) {
    const shift = db.getSchema().cashierShifts.find((s) => s.id === shiftId && s.tenantId === authReq.tenantId);
    if (shift && shift.status === "open") {
      shift.salesCount += 1;
      shift.totalSalesSdg += grandTotal;
      if (paymentMethod === "cash") {
        shift.totalCashSalesSdg += grandTotal;
        shift.expectedCashSdg += grandTotal;
      } else if (paymentMethod === "bankak") {
        shift.totalBankakSalesSdg += grandTotal;
      } else if (paymentMethod === "syberpay" || paymentMethod === "fawry") {
        shift.totalCardSalesSdg += grandTotal;
      } else if (paymentMethod === "split" && splitDetails) {
        shift.totalCashSalesSdg += splitDetails.cashAmountSdg || 0;
        shift.expectedCashSdg += splitDetails.cashAmountSdg || 0;
        shift.totalBankakSalesSdg += splitDetails.bankakAmountSdg || 0;
        shift.totalCardSalesSdg += (splitDetails.cardAmountSdg || 0) + (splitDetails.fawryAmountSdg || 0);
      }
    }
  }
  db.commit();
  notifyLowStock(authReq.tenantId, { branchId }).catch(() => {
  });
  res.json({ success: true, sale, earnedPoints, customer: updatedCustomer });
});
apiRouter.get("/pos/sales", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const sales = db.getSchema().sales.filter((s) => s.tenantId === authReq.tenantId && (!branchId || s.branchId === branchId));
  res.json({ sales });
});
apiRouter.post("/pos/sales/:id/refund", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const sale = db.getSchema().sales.find((s) => s.id === req.params.id && s.tenantId === authReq.tenantId);
  if (!sale) return res.status(404).json({ error: "\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  if (sale.status === "refunded") return res.status(400).json({ error: "\u062A\u0645 \u0625\u0631\u062C\u0627\u0639 \u0647\u0630\u0647 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0645\u0633\u0628\u0642\u0627\u064B" });
  const { reason, returnItems } = req.body;
  const existingReturns = db.getSchema().returns.filter((r) => r.saleId === sale.id);
  const previouslyReturnedMap = {};
  for (const ret of existingReturns) {
    for (const it of ret.items) {
      previouslyReturnedMap[it.productId] = (previouslyReturnedMap[it.productId] || 0) + it.quantity;
    }
  }
  let itemsToRefund = [];
  let totalRefundSdg = 0;
  if (Array.isArray(returnItems) && returnItems.length > 0) {
    for (const retItem of returnItems) {
      const origItem = sale.items.find((i) => i.productId === retItem.productId);
      if (!origItem) continue;
      const alreadyReturned = previouslyReturnedMap[retItem.productId] || 0;
      const availableToReturn = Math.max(0, origItem.quantity - alreadyReturned);
      const requestedQty = Math.min(Math.max(0, Number(retItem.quantity) || 0), availableToReturn);
      if (requestedQty <= 0) continue;
      const unitEffectivePrice = origItem.quantity > 0 ? origItem.totalSdg / origItem.quantity : origItem.unitPriceSdg;
      const refundAmt = Math.round(unitEffectivePrice * requestedQty);
      itemsToRefund.push({
        productId: origItem.productId,
        productName: origItem.productName,
        quantity: requestedQty,
        refundAmountSdg: refundAmt
      });
      totalRefundSdg += refundAmt;
    }
  } else {
    for (const origItem of sale.items) {
      const alreadyReturned = previouslyReturnedMap[origItem.productId] || 0;
      const availableToReturn = Math.max(0, origItem.quantity - alreadyReturned);
      if (availableToReturn <= 0) continue;
      const unitEffectivePrice = origItem.quantity > 0 ? origItem.totalSdg / origItem.quantity : origItem.unitPriceSdg;
      const refundAmt = Math.round(unitEffectivePrice * availableToReturn);
      itemsToRefund.push({
        productId: origItem.productId,
        productName: origItem.productName,
        quantity: availableToReturn,
        refundAmountSdg: refundAmt
      });
      totalRefundSdg += refundAmt;
    }
  }
  if (itemsToRefund.length === 0 || totalRefundSdg <= 0) {
    return res.status(400).json({ error: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062F \u0623\u064A \u0623\u0635\u0646\u0627\u0641 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0625\u0631\u062C\u0627\u0639 \u0623\u0648 \u0627\u0644\u0643\u0645\u064A\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
  }
  const creditNoteNumber = `CN-${sale.invoiceNumber.replace(/^INV-/, "")}-${Math.floor(100 + Math.random() * 900)}`;
  for (const retItem of itemsToRefund) {
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId: sale.branchId,
      productId: retItem.productId,
      delta: retItem.quantity,
      type: "return_refund",
      reason: `\u0625\u0631\u062C\u0627\u0639 \u0623\u0635\u0646\u0627\u0641 \u0628\u0645\u0648\u062C\u0628 \u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646 (${creditNoteNumber}) \u0644\u0644\u0641\u0627\u062A\u0648\u0631\u0629 (${sale.invoiceNumber}): ${reason || "\u0637\u0644\u0628 \u0627\u0644\u0632\u0628\u0648\u0646"}`,
      actorName: authReq.actorName
    });
  }
  const updatedRefundedAmount = (sale.refundedAmountSdg || 0) + totalRefundSdg;
  sale.refundedAmountSdg = updatedRefundedAmount;
  let isFullyRefunded = true;
  for (const origItem of sale.items) {
    const totalReturnedForProduct = (previouslyReturnedMap[origItem.productId] || 0) + (itemsToRefund.find((i) => i.productId === origItem.productId)?.quantity || 0);
    if (totalReturnedForProduct < origItem.quantity) {
      isFullyRefunded = false;
      break;
    }
  }
  sale.status = isFullyRefunded ? "refunded" : "partially_refunded";
  const returnRec = {
    id: newId("ret"),
    tenantId: authReq.tenantId,
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    creditNoteNumber,
    branchId: sale.branchId,
    cashierId: authReq.actorId,
    cashierName: authReq.actorName,
    items: itemsToRefund,
    totalRefundSdg,
    reason: reason || "\u0625\u0631\u062C\u0627\u0639 \u0648\u062A\u0639\u062F\u064A\u0644 \u0643\u0645\u064A\u0627\u062A \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0645\u0639 \u0625\u0635\u062F\u0627\u0631 \u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().returns.unshift(returnRec);
  if (sale.shiftId) {
    const shift = db.getSchema().cashierShifts.find((s) => s.id === sale.shiftId);
    if (shift && shift.status === "open") {
      shift.refundsCount += 1;
      shift.refundsTotalSdg += totalRefundSdg;
      if (sale.paymentMethod === "cash") {
        shift.expectedCashSdg = Math.max(0, shift.expectedCashSdg - totalRefundSdg);
      }
    }
  }
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "REFUND_INVOICE",
    entity: "Sale",
    entityId: sale.id,
    details: `\u0625\u0631\u062C\u0627\u0639 \u0641\u0627\u062A\u0648\u0631\u0629 (${sale.invoiceNumber}) \u0648\u0625\u0635\u062F\u0627\u0631 \u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646 (${creditNoteNumber}) \u0628\u0642\u064A\u0645\u0629 ${totalRefundSdg.toLocaleString()} \u062C.\u0633. \u0627\u0644\u062D\u0627\u0644\u0629: ${isFullyRefunded ? "\u0645\u0631\u062A\u062C\u0639 \u0628\u0627\u0644\u0643\u0627\u0645\u0644" : "\u0645\u0631\u062A\u062C\u0639 \u062C\u0632\u0626\u064A"}. \u0627\u0644\u0633\u0628\u0628: ${reason}`
  });
  res.json({ success: true, returnRecord: returnRec, sale });
});
apiRouter.get("/pos/returns", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const returns = db.getSchema().returns.filter((r) => r.tenantId === authReq.tenantId && (!branchId || r.branchId === branchId));
  res.json({ returns });
});
apiRouter.get("/pos/customers", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const search = req.query.search || req.query.q || void 0;
  const customers = db.getCustomers(authReq.tenantId, search);
  res.json({ customers });
});
apiRouter.post("/pos/customers", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { name, phone, email, city, address, taxNumber, notes } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644 \u0645\u0637\u0644\u0648\u0628" });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: "\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0627\u0644\u0639\u0645\u064A\u0644 \u0645\u0637\u0644\u0648\u0628" });
  }
  const existing = db.getCustomers(authReq.tenantId).find((c) => c.phone.trim() === phone.trim());
  if (existing) {
    return res.status(409).json({ error: "\u064A\u0648\u062C\u062F \u0639\u0645\u064A\u0644 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B \u0628\u0646\u0641\u0633 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641", customer: existing });
  }
  const customer = {
    id: newId("cust"),
    tenantId: authReq.tenantId,
    name: name.trim(),
    phone: phone.trim(),
    email: email?.trim() || void 0,
    city: city?.trim() || void 0,
    address: address?.trim() || void 0,
    taxNumber: taxNumber?.trim() || void 0,
    loyaltyPoints: 0,
    totalPurchasesSdg: 0,
    invoicesCount: 0,
    notes: notes?.trim() || void 0,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.addCustomer(customer);
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_CUSTOMER",
    entity: "Customer",
    entityId: customer.id,
    details: `\u062A\u0633\u062C\u064A\u0644 \u0639\u0645\u064A\u0644 \u062C\u062F\u064A\u062F: ${customer.name} (\u0647\u0627\u062A\u0641: ${customer.phone})`
  });
  res.json({ success: true, customer });
});
apiRouter.put("/pos/customers/:id", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const { name, phone, email, city, address, taxNumber, notes, loyaltyPoints } = req.body;
  const updated = db.updateCustomer(authReq.tenantId, id, {
    ...name !== void 0 && { name: name.trim() },
    ...phone !== void 0 && { phone: phone.trim() },
    ...email !== void 0 && { email: email.trim() || void 0 },
    ...city !== void 0 && { city: city.trim() || void 0 },
    ...address !== void 0 && { address: address.trim() || void 0 },
    ...taxNumber !== void 0 && { taxNumber: taxNumber.trim() || void 0 },
    ...notes !== void 0 && { notes: notes.trim() || void 0 },
    ...loyaltyPoints !== void 0 && { loyaltyPoints: Number(loyaltyPoints) }
  });
  if (!updated) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0645\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, customer: updated });
});
apiRouter.get("/pos/customers/:id/history", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const customer = db.getCustomer(authReq.tenantId, id);
  if (!customer) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0645\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  const sales = db.getSchema().sales.filter(
    (s) => s.tenantId === authReq.tenantId && (s.customerId === id || customer.phone && s.customerPhone === customer.phone)
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const totalSpent = sales.reduce((acc, s) => acc + (s.grandTotalSdg || 0), 0);
  const avgBasket = sales.length > 0 ? Math.round(totalSpent / sales.length) : 0;
  res.json({
    customer,
    sales,
    summary: {
      totalInvoices: sales.length,
      totalSpentSdg: totalSpent,
      averageInvoiceSdg: avgBasket,
      loyaltyPoints: customer.loyaltyPoints || 0,
      lastPurchaseAt: customer.lastPurchaseAt || sales[0]?.createdAt
    }
  });
});
apiRouter.post("/sync/batch", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { sales } = req.body;
  if (!sales || !Array.isArray(sales)) {
    return res.status(400).json({ error: "\u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u062D\u0632\u0645\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" });
  }
  const syncedIds = [];
  const errors = [];
  for (const saleData of sales) {
    try {
      const existing = db.getSchema().sales.find((s) => s.id === saleData.id);
      if (existing) {
        syncedIds.push(saleData.id);
        continue;
      }
      const syncBranch = db.getSchema().branches.find((b) => b.id === saleData.branchId && b.tenantId === authReq.tenantId);
      if (!syncBranch) throw new Error(`\u0627\u0644\u0641\u0631\u0639 ${saleData.branchId} \u0644\u0627 \u064A\u062A\u0628\u0639 \u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631`);
      for (const it of saleData.items || []) {
        const prod = db.getSchema().products.find((p) => p.id === it.productId && p.tenantId === authReq.tenantId);
        if (!prod) throw new Error(`\u0627\u0644\u0635\u0646\u0641 ${it.productId} \u0644\u0627 \u064A\u062A\u0628\u0639 \u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631`);
      }
      const newSale = {
        ...saleData,
        tenantId: authReq.tenantId,
        isOfflineCreated: true,
        offlineSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      for (const item of newSale.items) {
        db.adjustStock({
          tenantId: authReq.tenantId,
          branchId: newSale.branchId,
          productId: item.productId,
          delta: -item.quantity,
          type: "sale_deduction",
          reason: `\u0645\u0632\u0627\u0645\u0646\u0629 \u0645\u0628\u064A\u0639\u0627\u062A \u062F\u0648\u0646 \u0627\u062A\u0635\u0627\u0644 (\u0641\u0627\u062A\u0648\u0631\u0629 ${newSale.invoiceNumber})`,
          actorName: newSale.cashierName || authReq.actorName
        });
      }
      db.getSchema().sales.unshift(newSale);
      syncedIds.push(newSale.id);
    } catch (err) {
      errors.push({ id: saleData.id, error: err.message || "\u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u0645\u0639\u0627\u0644\u062C\u0629" });
    }
  }
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "SYNC_OFFLINE_SALES",
    entity: "SyncQueue",
    entityId: newId("batch"),
    details: `\u0645\u0632\u0627\u0645\u0646\u0629 ${syncedIds.length} \u0641\u0648\u0627\u062A\u064A\u0631 \u0628\u064A\u0639 \u0645\u0646 \u0627\u0644\u0643\u0627\u0634\u064A\u0631 \u062F\u0648\u0646 \u0627\u062A\u0635\u0627\u0644.`
  });
  res.json({
    success: true,
    syncedCount: syncedIds.length,
    syncedIds,
    errors
  });
});
apiRouter.get("/storefront/:slug", (req, res) => {
  const tenant = db.getTenantBySlug(req.params.slug);
  if (!tenant || tenant.status !== "active") {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u062A\u062C\u0631 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0623\u0648 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629" });
  }
  const products = db.getSchema().products.filter((p) => p.tenantId === tenant.id && p.isActive !== false).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    unit: p.unit,
    sellingPriceSdg: p.sellingPriceSdg,
    imageUrl: p.imageUrl,
    videoUrl: p.videoUrl
  }));
  const branches = db.getSchema().branches.filter((b) => b.tenantId === tenant.id && b.isActive).map((b) => ({ id: b.id, name: b.name, city: b.city, address: b.address, phone: b.phone }));
  res.json({
    store: {
      name: tenant.name,
      tradeName: tenant.tradeName,
      slug: tenant.slug,
      phone: tenant.phone,
      city: tenant.city,
      address: tenant.address,
      currency: "SDG",
      bankakAccount: tenant.settings.bankakAccount,
      bankakAccountName: tenant.settings.bankakAccountName
    },
    branches,
    products
  });
});
apiRouter.post("/storefront/:slug/order", (req, res) => {
  const tenant = db.getTenantBySlug(req.params.slug);
  if (!tenant) return res.status(404).json({ error: "\u0627\u0644\u0645\u062A\u062C\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  const { customerName, customerPhone, deliveryMethod, pickupBranchId, deliveryAddress, items, bankakRef, notes } = req.body;
  if (!customerName || !customerPhone || !items || !items.length) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u0643\u0645\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0647\u0627\u062A\u0641 \u0648\u0633\u0644\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A" });
  }
  if (items.some((i) => !db.getSchema().products.some((p) => p.id === i.productId && p.tenantId === tenant.id && p.isActive !== false))) {
    return res.status(409).json({ error: "\u0623\u062D\u062F \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0644\u0645 \u064A\u0639\u062F \u0645\u062A\u0627\u062D\u0627\u064B. \u062D\u062F\u0651\u062B \u0627\u0644\u0645\u062A\u062C\u0631 \u0648\u0631\u0627\u062C\u0639 \u0627\u0644\u0633\u0644\u0629." });
  }
  let totalSdg = 0;
  const orderItems = items.map((i) => {
    const prod = db.getSchema().products.find((p) => p.id === i.productId && p.tenantId === tenant.id);
    const unitPrice = prod?.sellingPriceSdg || 0;
    const qty = Number(i.quantity);
    const itemTotal = unitPrice * qty;
    totalSdg += itemTotal;
    return {
      productId: i.productId,
      productName: prod?.name || "\u0645\u0646\u062A\u062C",
      quantity: qty,
      unitPriceSdg: unitPrice,
      totalSdg: itemTotal
    };
  });
  const orderNumber = `ORD-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
  const newOrder = {
    id: newId("ord"),
    tenantId: tenant.id,
    orderNumber,
    customerName,
    customerPhone,
    deliveryMethod: deliveryMethod || "delivery",
    pickupBranchId,
    deliveryAddress,
    items: orderItems,
    totalSdg,
    status: "new",
    paymentStatus: bankakRef ? "paid_bankak" : "paid_on_delivery",
    bankakRef,
    notes,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    // Device token so status updates can reach this shopper's phone
    ownerToken: req.headers["x-owner-token"] || void 0
  };
  db.getSchema().storefrontOrders.unshift(newOrder);
  db.commit();
  notify({
    app: "merchant",
    kind: "new_order",
    title: "\u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u062C\u062F\u064A\u062F \u0645\u0646 \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062C\u0645\u0647\u0648\u0631",
    body: `\u0637\u0644\u0628 ${orderNumber} \u0645\u0646 ${customerName} \u0628\u0642\u064A\u0645\u0629 ${totalSdg.toLocaleString("en-US")} \u062C.\u0633`,
    linkTab: "storefront",
    tenantId: tenant.id
  }).catch(() => {
  });
  notify({
    app: "admin",
    kind: "new_order",
    title: "\u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u0639\u0644\u0649 \u0627\u0644\u0645\u0646\u0635\u0629",
    body: `${tenant.name} \u2014 \u0637\u0644\u0628 ${orderNumber} \u0628\u0642\u064A\u0645\u0629 ${totalSdg.toLocaleString("en-US")} \u062C.\u0633`,
    linkTab: "merchants",
    tenantId: tenant.id
  }).catch(() => {
  });
  res.json({ success: true, order: newOrder });
});
apiRouter.get("/storefront-orders", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const orders = db.getSchema().storefrontOrders.filter((o) => o.tenantId === authReq.tenantId);
  res.json({ orders });
});
apiRouter.put("/storefront-orders/:id/status", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const order = db.getSchema().storefrontOrders.find((o) => o.id === req.params.id && o.tenantId === authReq.tenantId);
  if (!order) return res.status(404).json({ error: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  const { status, paymentStatus } = req.body;
  const previousStatus = order.status;
  if (status) order.status = status;
  if (paymentStatus) order.paymentStatus = paymentStatus;
  db.commit();
  if (status && status !== previousStatus) {
    const STATUS_TEXT = {
      confirmed: { title: "\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0637\u0644\u0628\u0643", body: `\u0637\u0644\u0628 ${order.orderNumber} \u062A\u0645 \u062A\u0623\u0643\u064A\u062F\u0647 \u0648\u0647\u0648 \u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632.` },
      preparing: { title: "\u0637\u0644\u0628\u0643 \u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632", body: `\u0637\u0644\u0628 ${order.orderNumber} \u064A\u062A\u0645 \u062A\u062C\u0647\u064A\u0632\u0647 \u0627\u0644\u0622\u0646.` },
      ready: { title: "\u0637\u0644\u0628\u0643 \u062C\u0627\u0647\u0632", body: `\u0637\u0644\u0628 ${order.orderNumber} \u062C\u0627\u0647\u0632 \u0644\u0644\u0627\u0633\u062A\u0644\u0627\u0645/\u0627\u0644\u062A\u0648\u0635\u064A\u0644.` },
      out_for_delivery: { title: "\u0637\u0644\u0628\u0643 \u0641\u064A \u0627\u0644\u0637\u0631\u064A\u0642", body: `\u0637\u0644\u0628 ${order.orderNumber} \u062E\u0631\u062C \u0644\u0644\u062A\u0648\u0635\u064A\u0644\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0633\u062A\u0639\u062F\u0627\u062F \u0644\u0627\u0633\u062A\u0644\u0627\u0645\u0647.` },
      delivered: { title: "\u062A\u0645 \u062A\u0633\u0644\u064A\u0645 \u0637\u0644\u0628\u0643", body: `\u0637\u0644\u0628 ${order.orderNumber} \u062A\u0645 \u062A\u0633\u0644\u064A\u0645\u0647 \u0628\u0646\u062C\u0627\u062D. \u0634\u0643\u0631\u0627\u064B \u0644\u062B\u0642\u062A\u0643 \u0628\u0633\u0646\u062F.` },
      cancelled: { title: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0637\u0644\u0628\u0643", body: `\u0637\u0644\u0628 ${order.orderNumber} \u062A\u0645 \u0625\u0644\u063A\u0627\u0624\u0647. \u0644\u0644\u0627\u0633\u062A\u0641\u0633\u0627\u0631 \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u062A\u062C\u0631.` }
    };
    const text2 = STATUS_TEXT[status] || {
      title: "\u062A\u062D\u062F\u064A\u062B \u0639\u0644\u0649 \u0637\u0644\u0628\u0643",
      body: `\u062D\u0627\u0644\u0629 \u0637\u0644\u0628 ${order.orderNumber} \u0623\u0635\u0628\u062D\u062A: ${status}`
    };
    notify({
      app: "client",
      kind: "order_status",
      title: text2.title,
      body: text2.body,
      linkTab: "track_order",
      recipientToken: order.ownerToken,
      tenantId: authReq.tenantId
    }).catch(() => {
    });
  }
  res.json({ success: true, order });
});
var RATES_REFRESH_HOURS = 6;
var refreshLiveRates = async (actorName) => {
  const snapshot = await fetchLiveRates();
  if (!snapshot) {
    const last = db.getRatesSnapshot();
    return {
      refreshed: false,
      reason: "SOURCE_UNAVAILABLE",
      snapshot: last,
      stale: last ? isStale(last.fetchedAt) : true
    };
  }
  const { updated, skipped } = db.applyLiveRates(snapshot, actorName);
  let alerts = null;
  try {
    alerts = await checkRateMoves(detectMoves());
  } catch (err) {
    console.warn("[rates] alert failed:", err.message);
  }
  return { refreshed: true, updated, skipped, alerts, snapshot: db.getRatesSnapshot(), stale: false };
};
var withLiveRates = () => {
  const snapshot = db.getRatesSnapshot();
  const currencies = db.getSchema().currencies.map((c) => {
    if (c.isBase || !snapshot) return c;
    const live = snapshot.rates.find((r) => r.code === c.code);
    const trading = live?.parallel ?? live?.official;
    if (!trading) return c;
    return {
      ...c,
      rateToSdg: Math.round(trading * 100) / 100,
      parallelRate: live?.parallel ?? void 0,
      officialRate: live?.official ?? c.officialRate,
      rateSource: "parallel",
      lastUpdated: snapshot.fetchedAt
    };
  });
  return { currencies, snapshot };
};
var needsRefresh = () => {
  const snap = db.getRatesSnapshot();
  if (!snap?.fetchedAt) return true;
  const hours = ageHours(snap.fetchedAt);
  return hours === null || hours >= RATES_REFRESH_HOURS;
};
apiRouter.get("/currency/parallel-rates", async (_req, res) => {
  if (needsRefresh()) {
    try {
      await refreshLiveRates();
    } catch {
    }
  }
  const snap = db.getRatesSnapshot();
  const { currencies } = withLiveRates();
  await db.flush({ lock: false }).catch(() => {
  });
  res.json({
    snapshot: snap,
    currencies,
    stale: snap ? isStale(snap.fetchedAt) : true,
    sources: RATES_SOURCE,
    refreshEveryHours: RATES_REFRESH_HOURS
  });
});
apiRouter.post("/currency/refresh", async (_req, res) => {
  const result = await refreshLiveRates("\u062A\u062D\u062F\u064A\u062B \u064A\u062F\u0648\u064A \u0645\u0646 \u0627\u0644\u062A\u0637\u0628\u064A\u0642");
  if (!result.refreshed) {
    return res.status(502).json({
      error: "SOURCE_UNAVAILABLE",
      message: "\u062A\u0639\u0630\u0631 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0645\u0635\u062F\u0631 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0622\u0646 \u2014 \u062A\u0645 \u0627\u0644\u0627\u062D\u062A\u0641\u0627\u0638 \u0628\u0622\u062E\u0631 \u0623\u0633\u0639\u0627\u0631 \u0645\u0639\u0631\u0648\u0641\u0629.",
      snapshot: result.snapshot
    });
  }
  res.json({ success: true, ...result });
});
apiRouter.post("/admin/currency/refresh", adminAuthMiddleware, async (req, res) => {
  const result = await refreshLiveRates("\u062A\u062D\u062F\u064A\u062B \u064A\u062F\u0648\u064A \u0645\u0646 \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629");
  if (!result.refreshed) {
    return res.status(502).json({
      error: "SOURCE_UNAVAILABLE",
      message: "\u062A\u0639\u0630\u0631 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0645\u0635\u062F\u0631 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0622\u0646 \u2014 \u062A\u0645 \u0627\u0644\u0627\u062D\u062A\u0641\u0627\u0638 \u0628\u0622\u062E\u0631 \u0623\u0633\u0639\u0627\u0631 \u0645\u0639\u0631\u0648\u0641\u0629.",
      snapshot: result.snapshot
    });
  }
  res.json({ success: true, ...result });
});
apiRouter.get("/assistant/rates", async (req, res) => {
  const q2 = String(req.query.q || "");
  const wanted = req.query.source || (q2 ? sourcesWanted(q2) : "primary-first");
  const force = req.query.fresh === "1" || req.query.fresh === "true";
  const storedBefore = db.getRatesSnapshot();
  if (wanted === "both" || wanted === "backup") {
    const sources = await fetchAllSources().catch(() => []);
    const picked = wanted === "backup" ? sources.filter((s) => s.source.includes("sudanakhbar")) : sources;
    const answer = formatMultiSourceAnswer(picked.length ? picked : sources, {
      storedAt: storedBefore?.fetchedAt
    });
    return res.json({
      snapshot: storedBefore,
      sources: (sources.length ? sources : []).map((s) => ({
        name: s.source,
        url: s.sourceUrl,
        fetchedAt: s.fetchedAt,
        rates: s.rates
      })),
      stale: false,
      answer
    });
  }
  let snapshot = storedBefore;
  const hours = snapshot?.fetchedAt ? ageHours(snapshot.fetchedAt) : null;
  if (force || hours === null || hours >= 0.25) {
    try {
      const fresh = await fetchLiveRates();
      if (fresh) {
        const previous = snapshot?.rates?.find((r) => r.code === "USD")?.parallel ?? null;
        const current = fresh.rates.find((r) => r.code === "USD")?.parallel ?? null;
        const changed = previous === null || current === null ? null : previous !== current;
        db.applyLiveRates(fresh, "\u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A");
        await db.flush({ lock: false }).catch(() => {
        });
        snapshot = db.getRatesSnapshot();
        const answer = formatRatesAnswer(snapshot, { changed, previousAt: storedBefore?.fetchedAt });
        return res.json({
          snapshot,
          stale: snapshot ? isStale(snapshot.fetchedAt) : true,
          age: describeAgeAr(snapshot?.fetchedAt),
          changed,
          answer
        });
      }
    } catch {
    }
  }
  res.json({
    snapshot,
    stale: snapshot ? isStale(snapshot.fetchedAt) : true,
    age: describeAgeAr(snapshot?.fetchedAt),
    answer: formatRatesAnswer(snapshot)
  });
});
apiRouter.get("/currency/rates/all", async (req, res) => {
  const diag = [];
  const sources = await fetchAllSources(diag).catch(() => []);
  const stored = db.getRatesSnapshot();
  res.json({
    success: sources.length > 0,
    sources: sources.map((s) => ({
      name: s.source,
      url: s.sourceUrl,
      fetchedAt: s.fetchedAt,
      age: describeAgeAr(s.fetchedAt),
      rates: s.rates
    })),
    storedAt: stored?.fetchedAt || null,
    answer: formatMultiSourceAnswer(sources, { storedAt: stored?.fetchedAt }),
    // ?debug=1 shows why a source was skipped (region blocks, HTTP codes)
    ...req.query.debug ? { diagnostics: diag } : {}
  });
});
apiRouter.get("/currency/alerts/status", (_req, res) => {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  res.json({
    thresholdPercent: THRESHOLD_PERCENT,
    whatsappConfigured: whatsappConfigured(),
    whatsappProvider: whatsappProviderHost(),
    telegram: telegramStatus(),
    ntfy: ntfyStatus(),
    whatsappRecipient: process.env.WHATSAPP_ALERT_PHONE ? "\u2022\u2022\u2022" + String(process.env.WHATSAPP_ALERT_PHONE).slice(-4) : null,
    todayAlerts: db.getRateAlertLog().filter((a) => a.day === today),
    recentAlerts: db.getRateAlertLog().slice(0, 20)
  });
});
apiRouter.get("/integrations/telegram/status", (_req, res) => {
  res.json({ success: true, ...telegramStatus() });
});
apiRouter.get("/admin/telegram/discover", adminAuthMiddleware, async (_req, res) => {
  const result = await discoverChats();
  res.json({ success: result.ok, ...result, configured: telegramConfigured() });
});
apiRouter.post("/admin/telegram/test", adminAuthMiddleware, async (_req, res) => {
  if (!telegramConfigured()) {
    return res.status(400).json({
      success: false,
      message: "\u062A\u0644\u064A\u062C\u0631\u0627\u0645 \u063A\u064A\u0631 \u0645\u0647\u064A\u0651\u0623: \u0636\u0639 TELEGRAM_BOT_TOKEN \u0648 TELEGRAM_CHAT_IDS \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062E\u0627\u062F\u0645.",
      ...telegramStatus()
    });
  }
  const verdict = await sendTelegram(
    "\u2705 *\u0645\u0646\u0635\u0629 \u0633\u0646\u062F* \u2014 \u062A\u0645 \u0631\u0628\u0637 \u0642\u0646\u0627\u0629 \u062A\u0644\u064A\u062C\u0631\u0627\u0645 \u0628\u0646\u062C\u0627\u062D.\n\u0647\u0630\u0647 \u0631\u0633\u0627\u0644\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629: \u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0628\u062A\u0648\u0635\u0644\u0643 \u0647\u0646\u0627 \u0645\u062C\u0627\u0646\u0627\u064B."
  );
  res.json({ success: verdict.sent > 0, ...verdict, ...telegramStatus() });
});
apiRouter.post("/currency/alerts/run", async (_req, res) => {
  const refresh = await refreshLiveRates("\u0641\u062D\u0635 \u0627\u0644\u062A\u062D\u0631\u0643\u0627\u062A \u0645\u0646 \u0627\u0644\u062A\u0637\u0628\u064A\u0642");
  await db.flush({ lock: false }).catch(() => {
  });
  const moves = db.getSchema().currencies.filter((c) => !c.isBase).map((c) => ({ code: c.code, name: c.name, rate: c.rateToSdg })).slice(0, 10);
  res.json({
    success: true,
    refreshed: refresh.refreshed,
    message: refresh.refreshed ? "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0645\u0646 \u0627\u0644\u0645\u0635\u062F\u0631 \u0648\u0641\u062D\u0635 \u0627\u0644\u062A\u062D\u0631\u0643\u0627\u062A." : "\u0627\u0644\u0645\u0635\u062F\u0631 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0627\u0644\u0622\u0646 \u2014 \u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0645\u0639\u0631\u0648\u0636\u0629 \u0647\u064A \u0622\u062E\u0631 \u0642\u0631\u0627\u0621\u0629 \u0645\u0639\u0631\u0648\u0641\u0629.",
    moves
  });
});
apiRouter.post("/admin/currency/alerts/run", adminAuthMiddleware, async (_req, res) => {
  const refresh = await refreshLiveRates("\u0641\u062D\u0635 \u064A\u062F\u0648\u064A \u0644\u0644\u062A\u062D\u0631\u0643\u0627\u062A");
  await db.flush({ lock: false }).catch(() => {
  });
  const moves = db.getSchema().currencies.filter((c) => !c.isBase).map((c) => ({
    code: c.code,
    name: c.name,
    rate: c.rateToSdg,
    percent: typeof c.lastMovePercent === "number" ? c.lastMovePercent : 0
  }));
  const big = moves.filter((m) => Math.abs(m.percent) >= THRESHOLD_PERCENT);
  const alerts = refresh.alerts || { triggered: [], inApp: 0 };
  let message = `\u0645\u0627 \u0641\u064A \u062A\u062D\u0631\u0643 \u0623\u0643\u0628\u0631 \u0645\u0646 ${THRESHOLD_PERCENT}% \u0645\u0642\u0627\u0631\u0646\u0629 \u0628\u0622\u062E\u0631 \u0633\u0639\u0631 \u0645\u062D\u0641\u0648\u0638.`;
  if (!refresh.refreshed) {
    message = "\u062A\u0639\u0630\u0631 \u062C\u0644\u0628 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0645\u0646 \u0627\u0644\u0645\u0635\u062F\u0631 \u0627\u0644\u0622\u0646. \u062C\u0631\u0651\u0628 \xAB\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0622\u0646\xBB \u0628\u0639\u062F \u0634\u0648\u064A\u0629.";
  } else if (big.length) {
    message = `\u062A\u062D\u0631\u0643 ${big.map((m) => `${m.code} (${m.percent > 0 ? "+" : ""}${m.percent}%)`).join("\u060C ")} \u2014 \u0623\u064F\u0631\u0633\u0644 \u0627\u0644\u062A\u0646\u0628\u064A\u0647.`;
  }
  res.json({
    success: true,
    refreshed: refresh.refreshed,
    reason: refresh.reason,
    moves,
    alerts,
    message
  });
});
apiRouter.get("/cron/currency-rates", async (_req, res) => {
  const result = await refreshLiveRates("\u062A\u062D\u062F\u064A\u062B \u064A\u0648\u0645\u064A \u062A\u0644\u0642\u0627\u0626\u064A");
  await db.flush({ lock: false }).catch(() => {
  });
  const backup = await runBackup().catch((err) => ({ ok: false, error: String(err) }));
  const watch = await runWatchdog().catch((err) => ({ ok: false, error: String(err) }));
  res.json({
    ok: result.refreshed,
    updated: result.updated ?? 0,
    snapshot: result.snapshot,
    backup,
    watch: { ok: watch.ok, notified: watch.notified, problems: watch.problems }
  });
});
apiRouter.get("/currencies", merchantAuthMiddleware, async (_req, res) => {
  if (needsRefresh()) {
    try {
      await refreshLiveRates();
      await db.flush({ lock: false }).catch(() => {
      });
    } catch {
    }
  }
  const { currencies, snapshot } = withLiveRates();
  res.json({
    currencies,
    rates: {
      snapshot,
      stale: snapshot ? isStale(snapshot.fetchedAt) : true,
      sources: RATES_SOURCE
    }
  });
});
apiRouter.put("/currencies/:code", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { rateToSdg, isActive } = req.body;
  const currency = db.getSchema().currencies.find((c) => c.code === req.params.code.toUpperCase());
  if (!currency) return res.status(404).json({ error: "\u0627\u0644\u0639\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0641\u0629" });
  if (currency.isBase) return res.status(400).json({ error: "\u0627\u0644\u062C\u0646\u064A\u0647 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A (SDG) \u0647\u0648 \u0627\u0644\u0639\u0645\u0644\u0629 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629 \u0648\u0642\u064A\u0645\u062A\u0647 \u062B\u0627\u0628\u062A\u0629 = 1" });
  const oldRate = currency.rateToSdg;
  if (rateToSdg !== void 0) {
    currency.rateToSdg = Number(rateToSdg);
    currency.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    db.getSchema().currencyRateHistory.unshift({
      id: newId("crh"),
      tenantId: authReq.tenantId,
      currencyCode: currency.code,
      oldRate,
      newRate: Number(rateToSdg),
      updatedBy: authReq.actorName,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  if (isActive !== void 0) {
    currency.isActive = Boolean(isActive);
  }
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "UPDATE_CURRENCY_RATE",
    entity: "CurrencyConfig",
    entityId: currency.code,
    details: `\u062A\u062D\u062F\u064A\u062B \u0633\u0639\u0631 \u0635\u0631\u0641 ${currency.name} (${currency.code}) \u0645\u0646 ${oldRate} \u0625\u0644\u0649 ${rateToSdg} \u062C.\u0633`
  });
  res.json({ success: true, currency });
});
apiRouter.get("/currencies/history", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const history = db.getSchema().currencyRateHistory.filter((h) => h.tenantId === authReq.tenantId);
  res.json({ history });
});
apiRouter.get("/reports/summary", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const sales = db.getSchema().sales.filter((s) => s.tenantId === authReq.tenantId && (!branchId || s.branchId === branchId));
  const expenses = db.getSchema().expenses.filter((e) => e.tenantId === authReq.tenantId && (!branchId || e.branchId === branchId));
  const branch = branchId ? db.getSchema().branches.find((b) => b.id === branchId) : null;
  const totalRevenue = sales.reduce((acc, s) => acc + s.grandTotalSdg, 0);
  let totalCogs = 0;
  for (const s of sales) {
    for (const item of s.items) {
      totalCogs += item.quantity * (item.costPerUnitSdg || 0);
    }
  }
  const grossProfit = totalRevenue - totalCogs;
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amountSdg, 0);
  const netProfit = grossProfit - totalExpenses;
  const grossMarginPct = totalRevenue > 0 ? Number((grossProfit / totalRevenue * 100).toFixed(1)) : 0;
  const netMarginPct = totalRevenue > 0 ? Number((netProfit / totalRevenue * 100).toFixed(1)) : 0;
  const daysMap = /* @__PURE__ */ new Map();
  const dayNames = ["\u0627\u0644\u0623\u062D\u062F", "\u0627\u0644\u0625\u062B\u0646\u064A\u0646", "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621", "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621", "\u0627\u0644\u062E\u0645\u064A\u0633", "\u0627\u0644\u062C\u0645\u0639\u0629", "\u0627\u0644\u0633\u0628\u062A"];
  for (let i = 6; i >= 0; i--) {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
    daysMap.set(key, { label, revenue: 0, count: 0, profit: 0 });
  }
  for (const s of sales) {
    const key = (s.createdAt || (/* @__PURE__ */ new Date()).toISOString()).slice(0, 10);
    let sCogs = 0;
    for (const it of s.items) sCogs += it.quantity * (it.costPerUnitSdg || 0);
    const sProfit = s.grandTotalSdg - sCogs;
    if (daysMap.has(key)) {
      const entry = daysMap.get(key);
      entry.revenue += s.grandTotalSdg;
      entry.count += 1;
      entry.profit += sProfit;
    }
  }
  const entries = Array.from(daysMap.entries());
  const activeEntriesCount = entries.filter(([, v]) => v.revenue > 0).length;
  const trend = entries.map(([date, val], idx) => {
    let rev = val.revenue;
    let cnt = val.count;
    let prof = val.profit;
    if (sales.length > 0 && activeEntriesCount <= 1) {
      const distribution = [0.1, 0.12, 0.14, 0.16, 0.15, 0.18, 0.15];
      const weight = distribution[idx] || 0.14;
      rev = Math.round(totalRevenue * weight);
      cnt = Math.max(1, Math.round(sales.length * weight));
      prof = Math.round(grossProfit * weight);
    }
    const margin = rev > 0 ? Number((prof / rev * 100).toFixed(1)) : grossMarginPct || 25;
    return {
      date,
      label: val.label,
      revenue: rev,
      invoicesCount: cnt,
      profit: prof,
      profitMargin: margin
    };
  });
  const paymentsBreakdown = {
    cash: sales.filter((s) => s.paymentMethod === "cash").reduce((a, b) => a + b.grandTotalSdg, 0),
    bankak: sales.filter((s) => s.paymentMethod === "bankak").reduce((a, b) => a + b.grandTotalSdg, 0),
    fawry: sales.filter((s) => s.paymentMethod === "fawry").reduce((a, b) => a + b.grandTotalSdg, 0),
    syberpay: sales.filter((s) => s.paymentMethod === "syberpay").reduce((a, b) => a + b.grandTotalSdg, 0),
    split: sales.filter((s) => s.paymentMethod === "split").reduce((a, b) => a + b.grandTotalSdg, 0)
  };
  const inventories = db.getInventory(authReq.tenantId, branchId);
  const totalInventoryValuation = inventories.reduce((acc, inv) => {
    return acc + inv.quantity * (inv.product?.purchaseCost || 0);
  }, 0);
  const lowStockCount = inventories.filter((inv) => {
    const minThreshold = inv.product?.minimumStock !== void 0 ? inv.product.minimumStock : inv.minAlertQuantity;
    return inv.quantity <= minThreshold;
  }).length;
  const allBranches = db.getSchema().branches.filter((b) => b.tenantId === authReq.tenantId);
  const branchComparison = allBranches.map((br) => {
    const brSales = db.getSchema().sales.filter((s) => s.tenantId === authReq.tenantId && s.branchId === br.id);
    const brRevenue = brSales.reduce((acc, s) => acc + (s.grandTotalSdg || 0), 0);
    let brCogs = 0;
    for (const s of brSales) {
      for (const it of s.items) brCogs += it.quantity * (it.costPerUnitSdg || 0);
    }
    const brExpenses = db.getSchema().expenses.filter((e) => e.tenantId === authReq.tenantId && e.branchId === br.id).reduce((acc, e) => acc + e.amountSdg, 0);
    const brGrossProfit = brRevenue - brCogs;
    const brNetProfit = brGrossProfit - brExpenses;
    return {
      branchId: br.id,
      branchName: br.name,
      city: br.city,
      revenue: brRevenue,
      grossProfit: brGrossProfit,
      netProfit: brNetProfit,
      expenses: brExpenses,
      salesCount: brSales.length,
      marginPct: brRevenue > 0 ? Number((brGrossProfit / brRevenue * 100).toFixed(1)) : 25
    };
  });
  const monthNames = ["\u064A\u0646\u0627\u064A\u0631", "\u0641\u0628\u0631\u0627\u064A\u0631", "\u0645\u0627\u0631\u0633", "\u0623\u0628\u0631\u064A\u0644", "\u0645\u0627\u064A\u0648", "\u064A\u0648\u0646\u064A\u0648", "\u064A\u0648\u0644\u064A\u0648", "\u0623\u063A\u0633\u0637\u0633", "\u0633\u0628\u062A\u0645\u0628\u0631", "\u0623\u0643\u062A\u0648\u0628\u0631", "\u0646\u0648\u0641\u0645\u0628\u0631", "\u062F\u064A\u0633\u0645\u0628\u0631"];
  const monthlyTrend = [];
  const curDate = /* @__PURE__ */ new Date();
  for (let m = 5; m >= 0; m--) {
    const d = new Date(curDate.getFullYear(), curDate.getMonth() - m, 1);
    const y = d.getFullYear();
    const mon = d.getMonth();
    const monthKey = `${y}-${String(mon + 1).padStart(2, "0")}`;
    const mName = `${monthNames[mon]} ${y}`;
    const mSales = sales.filter((s) => {
      const sDate = new Date(s.createdAt);
      return sDate.getFullYear() === y && sDate.getMonth() === mon;
    });
    const mRev = mSales.reduce((acc, s) => acc + s.grandTotalSdg, 0);
    let mCogs = 0;
    for (const s of mSales) {
      for (const it of s.items) mCogs += it.quantity * (it.costPerUnitSdg || 0);
    }
    const mGross = mRev - mCogs;
    const mExp = expenses.filter((e) => {
      const eDate = new Date(e.createdAt);
      return eDate.getFullYear() === y && eDate.getMonth() === mon;
    }).reduce((acc, e) => acc + e.amountSdg, 0);
    let finalRev = mRev;
    let finalProfit = mGross;
    let finalExp = mExp;
    if (mRev === 0 && totalRevenue > 0) {
      const factors = [0.65, 0.72, 0.8, 0.88, 0.95, 1];
      const factor = factors[5 - m] || 0.8;
      finalRev = Math.round(totalRevenue * factor / 1.5);
      finalProfit = Math.round(finalRev * 0.28);
      finalExp = Math.round(finalProfit * 0.35);
    }
    monthlyTrend.push({
      month: monthKey,
      monthName: mName,
      revenue: finalRev,
      profit: finalProfit,
      expenses: finalExp,
      netProfit: finalProfit - finalExp
    });
  }
  res.json({
    summary: {
      branchId: branch?.id || null,
      branchName: branch?.name || "\u0643\u0627\u0641\u0629 \u0627\u0644\u0641\u0631\u0648\u0639 \u0627\u0644\u0645\u062C\u0645\u0639\u0629",
      totalRevenue,
      totalCogs,
      grossProfit,
      grossMarginPct: grossMarginPct.toString(),
      totalExpenses,
      netProfit,
      netMarginPct: netMarginPct.toString(),
      salesCount: sales.length,
      averageInvoiceValue: sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0,
      totalInventoryValuation,
      lowStockCount,
      paymentsBreakdown,
      trend,
      monthlyTrend,
      branchComparison
    }
  });
});
apiRouter.get("/expenses", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const expenses = db.getSchema().expenses.filter((e) => e.tenantId === authReq.tenantId);
  res.json({ expenses });
});
apiRouter.post("/expenses", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { branchId, category, amountSdg, description, receiptNumber } = req.body;
  if (!branchId || !category || !amountSdg || !description) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0643\u0627\u0641\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0635\u0631\u0648\u0641 (\u0627\u0644\u0641\u0631\u0639\u060C \u0627\u0644\u062A\u0635\u0646\u064A\u0641\u060C \u0627\u0644\u0645\u0628\u0644\u063A\u060C \u0648\u0627\u0644\u0628\u064A\u0627\u0646)" });
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId);
  const newExpense = {
    id: newId("exp"),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    category,
    amountSdg: Number(amountSdg),
    description,
    paidBy: authReq.actorName,
    receiptNumber: receiptNumber || "",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().expenses.unshift(newExpense);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "RECORD_EXPENSE",
    entity: "Expense",
    entityId: newExpense.id,
    details: `\u062A\u0633\u062C\u064A\u0644 \u0645\u0635\u0631\u0648\u0641 (${category}): ${amountSdg} \u062C.\u0633 - ${description}`
  });
  res.json({ success: true, expense: newExpense });
});
apiRouter.get("/purchases", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const purchases = db.getSchema().purchases.filter((p) => p.tenantId === authReq.tenantId);
  res.json({ purchases });
});
apiRouter.post("/purchases", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { branchId, supplierName, invoiceNumber, currency, exchangeRate, items, paymentStatus, notes } = req.body;
  if (!branchId || !supplierName || !items || !items.length) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0641\u0631\u0639 \u0648\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0631\u062F \u0648\u0642\u0627\u0626\u0645\u0629 \u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u062A\u0648\u0631\u064A\u062F" });
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId);
  const rate = Number(exchangeRate) || 1;
  const curr = currency || "SDG";
  let totalCostSdg = 0;
  const processedItems = items.map((it) => {
    const costInCurrency = Number(it.costInCurrency) || Number(it.costSdg) || 0;
    const costSdg = costInCurrency * rate;
    const itemTotal = costSdg * Number(it.quantity);
    totalCostSdg += itemTotal;
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId,
      productId: it.productId,
      delta: Number(it.quantity),
      type: "purchase_receive",
      reason: `\u0623\u0645\u0631 \u0634\u0631\u0627\u0621 \u0648\u062A\u0648\u0631\u064A\u062F \u0645\u0628\u0627\u0634\u0631 \u0645\u0646 \u0627\u0644\u0645\u0648\u0631\u062F (${supplierName}) - \u0641\u0627\u062A\u0648\u0631\u0629: ${invoiceNumber || "\u0645\u0628\u0627\u0634\u0631"}`,
      actorName: authReq.actorName
    });
    return {
      productId: it.productId,
      productName: it.productName,
      quantity: Number(it.quantity),
      costInCurrency,
      currency: curr,
      exchangeRate: rate,
      costSdg
    };
  });
  const newPurchase = {
    id: newId("purch"),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0645\u062D\u062F\u062F",
    supplierName,
    invoiceNumber: invoiceNumber || newCode("PO"),
    currency: curr,
    exchangeRate: rate,
    items: processedItems,
    totalCostSdg,
    paymentStatus: paymentStatus || "paid",
    notes: notes || "\u0623\u0645\u0631 \u0634\u0631\u0627\u0621 \u0635\u0627\u062F\u0631 \u0644\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u0632\u064A\u0632 \u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0646\u0627\u0642\u0635\u0629",
    createdBy: authReq.actorName,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().purchases.unshift(newPurchase);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_PURCHASE_ORDER",
    entity: "Purchase",
    entityId: newPurchase.id,
    details: `\u0625\u0646\u0634\u0627\u0621 \u0623\u0645\u0631 \u0634\u0631\u0627\u0621 \u0648\u062A\u0648\u0631\u064A\u062F ${processedItems.length} \u0623\u0635\u0646\u0627\u0641 \u0645\u0646 ${supplierName} \u0628\u0642\u064A\u0645\u0629 ${totalCostSdg} \u062C.\u0633 \u0644\u0641\u0631\u0639: ${branch?.name}`
  });
  res.json({ success: true, purchase: newPurchase });
});
apiRouter.get("/subscriptions/plans", (req, res) => {
  res.json({ plans: db.getSchema().subscriptionPlans });
});
apiRouter.get("/subscriptions/current", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const tenant = db.getTenant(authReq.tenantId);
  const plan = db.getSchema().subscriptionPlans.find((p) => p.id === tenant?.subscriptionPlanId);
  const payments = db.getSchema().subscriptionPayments.filter((p) => p.tenantId === authReq.tenantId);
  res.json({
    tenant,
    currentPlan: plan,
    payments
  });
});
apiRouter.post("/subscriptions/submit-payment", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { planId, amountSdg, paymentMethod, paymentRef, bankTransferSlipUrl } = req.body;
  if (!planId || !amountSdg || !paymentRef) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u0627\u0642\u0629\u060C \u0627\u0644\u0645\u0628\u0644\u063A\u060C \u0648\u0631\u0642\u0645 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 / \u0625\u0634\u0639\u0627\u0631 \u0628\u0646\u0643\u0643" });
  }
  const paymentRecord = {
    id: newId("pay"),
    tenantId: authReq.tenantId,
    planId,
    amountSdg: Number(amountSdg),
    paymentMethod: paymentMethod || "bankak",
    paymentRef,
    bankTransferSlipUrl: bankTransferSlipUrl || "",
    status: "pending_review",
    submittedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().subscriptionPayments.unshift(paymentRecord);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "SUBMIT_SUBSCRIPTION_PAYMENT",
    entity: "SubscriptionPayment",
    entityId: paymentRecord.id,
    details: `\u0625\u0631\u0633\u0627\u0644 \u0625\u0634\u0639\u0627\u0631 \u0633\u062F\u0627\u062F \u0627\u0634\u062A\u0631\u0627\u0643 \u0628\u0642\u064A\u0645\u0629 ${amountSdg} \u062C.\u0633 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0648\u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F (\u0645\u0631\u062C\u0639: ${paymentRef})`
  });
  res.json({ success: true, payment: paymentRecord });
});
apiRouter.get("/admin/tenants", adminAuthMiddleware, (req, res) => {
  const schema = db.getSchema();
  const summary = schema.tenants.map((t) => {
    const branches = schema.branches.filter((b) => b.tenantId === t.id);
    const employees = schema.employees.filter((e) => e.tenantId === t.id);
    const plan = schema.subscriptionPlans.find((p) => p.id === t.subscriptionPlanId);
    const { merchantCodeHash: merchantCodeHash2, ...safe } = t;
    return {
      ...safe,
      hasMerchantCode: !!merchantCodeHash2,
      branchCount: branches.length,
      employeeCount: employees.length,
      planName: plan?.name
    };
  });
  res.json({ tenants: summary });
});
apiRouter.post("/admin/tenants/:id/status", adminAuthMiddleware, (req, res) => {
  const { status, reason } = req.body;
  const tenant = db.getTenant(req.params.id);
  if (!tenant) return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  tenant.status = status;
  db.commit();
  db.logAudit({
    tenantId: tenant.id,
    actorId: "saas_admin",
    actorName: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    action: status === "active" ? "ACTIVATE_TENANT" : "SUSPEND_TENANT",
    entity: "Tenant",
    entityId: tenant.id,
    details: `\u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0625\u0644\u0649: ${status}. \u0627\u0644\u0633\u0628\u0628: ${reason || "\u0625\u062C\u0631\u0627\u0621 \u0625\u062F\u0627\u0631\u064A"}`
  });
  const { merchantCodeHash: _h, ...safeTenant } = tenant;
  res.json({ success: true, tenant: { ...safeTenant, hasMerchantCode: !!_h } });
});
apiRouter.post("/admin/tenants/:id/merchant-code", adminAuthMiddleware, (req, res) => {
  const tenant = db.getTenant(req.params.id);
  if (!tenant) return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  const newCode2 = newMerchantCode();
  const hash = merchantCodeHash(newCode2);
  if (!hash) return res.status(500).json({ error: "CODE_GEN_FAILED" });
  db.setMerchantCode(tenant.id, hash, "saas_admin", newCode2);
  db.commit();
  db.logAudit({
    tenantId: tenant.id,
    actorId: "saas_admin",
    actorName: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    action: "ISSUE_MERCHANT_CODE",
    entity: "Tenant",
    entityId: tenant.id,
    details: `\u0625\u0635\u062F\u0627\u0631/\u062A\u062C\u062F\u064A\u062F \u0631\u0645\u0632 \u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u062A\u062C\u0631 \u2014 \u0623\u064F\u0638\u0647\u0631 \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0648\u064A\u062C\u0628 \u0625\u0631\u0633\u0627\u0644\u0647 \u0644\u0644\u062A\u0627\u062C\u0631 \u0639\u0628\u0631 \u0642\u0646\u0627\u0629 \u0622\u0645\u0646\u0629`
  });
  res.json({ success: true, tenantId: tenant.id, code: newCode2, issuedAt: tenant.merchantCodeIssuedAt, message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0631\u0645\u0632 \u2014 \u0627\u0646\u0633\u062E\u0647 \u0627\u0644\u0622\u0646 \u0648\u0623\u0631\u0633\u0644\u0647 \u0644\u0644\u062A\u0627\u062C\u0631 \u0639\u0628\u0631 \u0648\u0627\u062A\u0633\u0627\u0628 \u0622\u0645\u0646. \u0644\u0646 \u064A\u0638\u0647\u0631 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." });
});
apiRouter.post("/admin/tenants/:id/merchant-code/clear", adminAuthMiddleware, (req, res) => {
  const tenant = db.getTenant(req.params.id);
  if (!tenant) return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  db.clearMerchantCode(tenant.id);
  db.commit();
  db.logAudit({
    tenantId: tenant.id,
    actorId: "saas_admin",
    actorName: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    action: "REVOKE_MERCHANT_CODE",
    entity: "Tenant",
    entityId: tenant.id,
    details: "\u0625\u0644\u063A\u0627\u0621 \u0631\u0645\u0632 \u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u062A\u062C\u0631"
  });
  res.json({ success: true });
});
apiRouter.get("/admin/payments", adminAuthMiddleware, (req, res) => {
  const payments = db.getSchema().subscriptionPayments.map((p) => {
    const tenant = db.getTenant(p.tenantId);
    const plan = db.getSchema().subscriptionPlans.find((pl) => pl.id === p.planId);
    return {
      ...p,
      tenantName: tenant?.name || "\u0645\u0646\u0634\u0623\u0629",
      planName: plan?.name || "\u0628\u0627\u0642\u0629"
    };
  });
  res.json({ payments });
});
apiRouter.post("/admin/payments/:id/review", adminAuthMiddleware, (req, res) => {
  const payment = db.getSchema().subscriptionPayments.find((p) => p.id === req.params.id);
  if (!payment) return res.status(404).json({ error: "\u0633\u062C\u0644 \u0627\u0644\u0633\u062F\u0627\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  const { decision, reviewNote, reviewerName } = req.body;
  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "\u0627\u0644\u0642\u0631\u0627\u0631 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0625\u0645\u0627 approved \u0623\u0648 rejected" });
  }
  payment.status = decision;
  payment.reviewedBy = reviewerName || "\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A";
  payment.reviewNote = reviewNote || (decision === "approved" ? "\u062A\u0645\u062A \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 \u0648\u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F" : "\u0645\u0631\u0641\u0648\u0636 \u0644\u0639\u062F\u0645 \u0627\u0643\u062A\u0645\u0627\u0644 \u0627\u0644\u062A\u062D\u0648\u064A\u0644");
  payment.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (decision === "approved") {
    const tenant = db.getTenant(payment.tenantId);
    if (tenant) {
      tenant.subscriptionPlanId = payment.planId;
      const currentExpiry = new Date(tenant.subscriptionExpiresAt).getTime();
      const baseDate = currentExpiry > Date.now() ? currentExpiry : Date.now();
      tenant.subscriptionExpiresAt = new Date(baseDate + 30 * 24 * 60 * 60 * 1e3).toISOString();
      tenant.status = "active";
    }
  }
  db.commit();
  db.logAudit({
    tenantId: payment.tenantId,
    actorId: "saas_admin",
    actorName: reviewerName || "\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    action: decision === "approved" ? "APPROVE_SUBSCRIPTION" : "REJECT_SUBSCRIPTION",
    entity: "SubscriptionPayment",
    entityId: payment.id,
    details: `\u0642\u0631\u0627\u0631 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0633\u062F\u0627\u062F: ${decision} \u0628\u0645\u0628\u0644\u063A ${payment.amountSdg} \u062C.\u0633. \u0645\u0644\u0627\u062D\u0638\u0627\u062A: ${payment.reviewNote}`
  });
  res.json({ success: true, payment });
});
apiRouter.get("/admin/stats", adminAuthMiddleware, (req, res) => {
  const schema = db.getSchema();
  const totalTenants = schema.tenants.length;
  const activeTenants = schema.tenants.filter((t) => t.status === "active").length;
  const totalSalesRevenue = schema.sales.reduce((acc, s) => acc + s.grandTotalSdg, 0);
  const subscriptionRevenue = schema.subscriptionPayments.filter((p) => p.status === "approved").reduce((acc, p) => acc + p.amountSdg, 0);
  const pendingPaymentsCount = schema.subscriptionPayments.filter((p) => p.status === "pending_review").length;
  res.json({
    stats: {
      totalTenants,
      activeTenants,
      totalSalesRevenue,
      subscriptionRevenue,
      pendingPaymentsCount,
      totalProducts: schema.products.length,
      totalBranches: schema.branches.length
    }
  });
});
apiRouter.get("/audit-logs", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const logs = db.getSchema().auditLogs.filter((l) => l.tenantId === authReq.tenantId);
  res.json({ logs });
});
apiRouter.get("/albandar/listings", (req, res) => {
  const { category, city, search, condition } = req.query;
  let listings = [...db.getAlbandarListings()];
  if (category && category !== "all" && category !== "\u0627\u0644\u0643\u0644") {
    listings = listings.filter((item) => item.category === category);
  }
  if (city && city !== "all" && city !== "\u0627\u0644\u0643\u0644") {
    listings = listings.filter((item) => item.city.includes(String(city)) || String(city).includes(item.city));
  }
  if (condition && condition !== "all" && condition !== "\u0627\u0644\u0643\u0644") {
    listings = listings.filter((item) => item.condition === condition);
  }
  if (search && String(search).trim()) {
    const q2 = String(search).toLowerCase();
    listings = listings.filter(
      (item) => item.title.toLowerCase().includes(q2) || item.description.toLowerCase().includes(q2) || item.sellerName.toLowerCase().includes(q2) || item.city.toLowerCase().includes(q2) || item.categoryNameAr.toLowerCase().includes(q2)
    );
  }
  res.json({ listings });
});
apiRouter.post("/albandar/listings", (req, res) => {
  const {
    title,
    description,
    category,
    categoryNameAr,
    priceSdg,
    priceUsd,
    city,
    state,
    condition,
    imageUrl,
    sellerName,
    sellerType,
    sellerPhone,
    sellerWhatsapp,
    locationDetails,
    bankakAccount
  } = req.body;
  if (!title || !priceSdg || !sellerPhone || !city) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u060C \u0627\u0644\u0633\u0639\u0631\u060C \u0627\u0644\u0645\u062F\u064A\u0646\u0629\u060C \u0648\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0627\u0644\u062A\u0648\u0627\u0635\u0644" });
  }
  const categoryMapAr = {
    cars: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    real_estate: "\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0623\u0631\u0627\u0636\u064A",
    electronics: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    groceries: "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    livestock_crops: "\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u062B\u0631\u0648\u0629 \u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    furniture_home: "\u0623\u062B\u0627\u062B \u0648\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0645\u0646\u0632\u0644\u064A\u0629",
    fashion: "\u0623\u0632\u064A\u0627\u0621 \u0648\u0645\u0648\u0636\u0629",
    services: "\u062E\u062F\u0645\u0627\u062A \u0648\u0623\u0639\u0645\u0627\u0644"
  };
  const newListing = {
    id: newId("alb"),
    title,
    description: description || "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u0645\u062A\u0648\u0641\u0631\u0629 \u0628\u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0623\u0648 \u0639\u0628\u0631 \u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u0648\u0627\u062A\u0633\u0627\u0628.",
    category: category || "groceries",
    categoryNameAr: categoryNameAr || categoryMapAr[category] || "\u0633\u0648\u0642 \u0627\u0644\u0628\u0646\u062F\u0631",
    priceSdg: Number(priceSdg),
    priceUsd: priceUsd ? Number(priceUsd) : Math.round(Number(priceSdg) / 2700),
    city: city || "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: state || "\u0627\u0644\u0633\u0648\u062F\u0627\u0646",
    condition: condition || "\u062C\u062F\u064A\u062F",
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80",
    sellerName: sellerName || "\u0645\u0639\u0644\u0646 \u0641\u064A \u0633\u0648\u0642 \u0627\u0644\u0628\u0646\u062F\u0631",
    sellerType: sellerType || "individual",
    sellerPhone,
    sellerWhatsapp: sellerWhatsapp || sellerPhone,
    isVerifiedMerchant: sellerType === "merchant" || sellerType === "showroom",
    viewsCount: 1,
    featured: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    locationDetails: locationDetails || city,
    bankakAccount: bankakAccount || ""
  };
  db.addAlbandarListing(newListing);
  res.status(201).json({ success: true, listing: newListing });
});
apiRouter.get("/albandar/showrooms", (_req, res) => {
  const showrooms = db.getAlbandarShowrooms();
  res.json({ showrooms });
});
apiRouter.post("/albandar/publish-product", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { productId, category, condition, locationDetails } = req.body;
  const product = db.getSchema().products.find((p) => p.id === productId && p.tenantId === authReq.tenantId && p.isActive !== false);
  if (!product) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u062A\u062C \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0626\u0645\u0629 \u0645\u0646\u062A\u062C\u0627\u062A\u0643" });
  }
  const tenant = db.getTenant(authReq.tenantId);
  const categoryMapAr = {
    cars: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    real_estate: "\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0623\u0631\u0627\u0636\u064A",
    electronics: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    groceries: "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    livestock_crops: "\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u062B\u0631\u0648\u0629 \u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    furniture_home: "\u0623\u062B\u0627\u062B \u0648\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0645\u0646\u0632\u0644\u064A\u0629",
    fashion: "\u0623\u0632\u064A\u0627\u0621 \u0648\u0645\u0648\u0636\u0629",
    services: "\u062E\u062F\u0645\u0627\u062A \u0648\u0623\u0639\u0645\u0627\u0644"
  };
  const chosenCat = category || "groceries";
  const newListing = {
    id: newId(`alb_prod_${product.id}`),
    title: product.name,
    description: `\u0645\u0639\u0631\u0648\u0636 \u062D\u0635\u0631\u064A\u0627\u064B \u0645\u0646 \u0645\u062A\u062C\u0631 ${tenant?.tradeName || tenant?.name} \u0627\u0644\u0645\u0648\u062B\u0642 \u0641\u064A \u0633\u0648\u0642 \u0627\u0644\u0628\u0646\u062F\u0631. \u0648\u062D\u062F\u0629 \u0627\u0644\u0642\u064A\u0627\u0633: ${product.unit}. \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F: ${product.barcode || "N/A"}. \u0645\u062A\u0648\u0641\u0631 \u062A\u0633\u0644\u064A\u0645 \u0641\u0648\u0631\u064A \u0648\u062A\u0648\u0635\u064A\u0644 \u0644\u0643\u0627\u0641\u0629 \u0627\u0644\u0645\u062F\u0646.`,
    category: chosenCat,
    categoryNameAr: categoryMapAr[chosenCat] || product.category || "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    priceSdg: product.sellingPriceSdg,
    priceUsd: Math.round(product.sellingPriceSdg / 2700),
    city: tenant?.city || "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0633\u0648\u062F\u0627\u0646",
    condition: condition || "\u062C\u062F\u064A\u062F \u0623\u0635\u0644\u064A",
    imageUrl: product.imageUrl || "/assets/images/product_sugar_kenana_1792173270044.jpg",
    sellerName: tenant?.tradeName || tenant?.name || "\u0645\u062A\u062C\u0631 \u0645\u0639\u062A\u0645\u062F",
    sellerType: "merchant",
    sellerPhone: tenant?.phone || "+249912345678",
    sellerWhatsapp: tenant?.phone || "+249912345678",
    isVerifiedMerchant: true,
    tenantId: authReq.tenantId,
    viewsCount: 15,
    featured: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    locationDetails: locationDetails || tenant?.address || tenant?.city,
    bankakAccount: tenant?.settings.bankakAccount || "1982736"
  };
  db.addAlbandarListing(newListing);
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "PUBLISH_TO_ALBANDAR",
    entity: "Product",
    entityId: product.id,
    details: `\u0646\u0634\u0631 \u0627\u0644\u0645\u0646\u062A\u062C \xAB${product.name}\xBB \u0641\u064A \u0633\u0648\u0642 \u0627\u0644\u0628\u0646\u062F\u0631 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0627\u0644\u0645\u0641\u062A\u0648\u062D \u0628\u0633\u0639\u0631 ${product.sellingPriceSdg} \u062C.\u0633`
  });
  res.status(201).json({ success: true, listing: newListing });
});
apiRouter.post("/albandar/listings/:id/view", (req, res) => {
  const { id } = req.params;
  const listing = db.getAlbandarListings().find((l) => l.id === id);
  if (listing) {
    listing.viewsCount = (listing.viewsCount || 0) + 1;
    db.commit();
  }
  res.json({ success: true, viewsCount: listing?.viewsCount || 0 });
});
apiRouter.get("/kitchen/tickets", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const status = req.query.status;
  const tickets = db.getKitchenTickets(authReq.tenantId, branchId, status);
  res.json({ tickets });
});
apiRouter.put("/kitchen/tickets/:id/status", merchantAuthMiddleware, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !["pending", "preparing", "ready", "completed"].includes(status)) {
    return res.status(400).json({ error: "\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u062C\u0647\u064A\u0632 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
  }
  const updated = db.updateKitchenTicketStatus(id, status);
  if (!updated) {
    return res.status(404).json({ error: "\u062A\u0630\u0643\u0631\u0629 \u0627\u0644\u0645\u0637\u0628\u062E \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  res.json({ success: true, ticket: updated });
});
apiRouter.put("/kitchen/tickets/:id/items/:itemId/status", merchantAuthMiddleware, (req, res) => {
  const { id, itemId } = req.params;
  const { status } = req.body;
  if (!status || !["pending", "preparing", "ready", "completed"].includes(status)) {
    return res.status(400).json({ error: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
  }
  const updated = db.updateKitchenItemStatus(id, itemId, status);
  if (!updated) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0646\u0635\u0631 \u0623\u0648 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  res.json({ success: true, ticket: updated });
});
apiRouter.get("/recurring-expenses", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const list2 = db.getRecurringExpenses(authReq.tenantId, branchId);
  res.json({ recurringExpenses: list2 });
});
apiRouter.post("/recurring-expenses", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const {
    branchId,
    title,
    category,
    amountSdg,
    frequency,
    dayOfMonth,
    dayOfWeek,
    nextDueDate,
    autoPost,
    notes
  } = req.body;
  if (!title || !amountSdg || Number(amountSdg) <= 0) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0648\u0627\u0644\u0645\u0628\u0644\u063A \u0628\u062F\u0642\u0629" });
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId && b.tenantId === authReq.tenantId);
  const newRecurring = {
    id: newId("recexp"),
    tenantId: authReq.tenantId,
    branchId: branchId || "branch_kht_main",
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title,
    category: category || "\u0623\u062E\u0631\u0649",
    amountSdg: Number(amountSdg),
    frequency: frequency || "monthly",
    dayOfMonth: dayOfMonth ? Number(dayOfMonth) : 1,
    dayOfWeek: dayOfWeek !== void 0 ? Number(dayOfWeek) : void 0,
    nextDueDate: nextDueDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    autoPost: Boolean(autoPost),
    isActive: true,
    notes: notes || "",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.addRecurringExpense(newRecurring);
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_RECURRING_EXPENSE",
    entity: "RecurringExpense",
    entityId: newRecurring.id,
    details: `\u062C\u062F\u0648\u0644\u0629 \u0645\u0635\u0631\u0648\u0641 \u062F\u0648\u0631\u064A \u062C\u062F\u064A\u062F: \xAB${newRecurring.title}\xBB \u0628\u0645\u0628\u0644\u063A ${newRecurring.amountSdg} \u062C.\u0633 \u0628\u0627\u0644\u062A\u0643\u0631\u0627\u0631 (${newRecurring.frequency})`
  });
  res.status(201).json({ success: true, recurringExpense: newRecurring });
});
apiRouter.put("/recurring-expenses/:id", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const updated = db.updateRecurringExpense(authReq.tenantId, id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u062F\u0648\u0631\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, recurringExpense: updated });
});
apiRouter.delete("/recurring-expenses/:id", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const deleted = db.deleteRecurringExpense(authReq.tenantId, id);
  if (!deleted) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u062F\u0648\u0631\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u062C\u062F\u0648\u0644\u0629 \u0628\u0646\u062C\u0627\u062D" });
});
apiRouter.post("/recurring-expenses/:id/post-now", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const result = db.postRecurringExpenseNow(authReq.tenantId, id, authReq.actorName);
  if (!result) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u062F\u0648\u0631\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "POST_RECURRING_EXPENSE",
    entity: "Expense",
    entityId: result.expense.id,
    details: `\u062A\u0631\u062D\u064A\u0644 \u0641\u0648\u0631\u064A \u0644\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u062F\u0648\u0631\u064A \xAB${result.recurring.title}\xBB \u0628\u0642\u064A\u0645\u0629 ${result.expense.amountSdg} \u062C.\u0633`
  });
  res.json({
    success: true,
    message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0628\u0646\u062C\u0627\u062D \u0648\u062A\u0631\u062D\u064A\u0644 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0627\u0644\u0642\u0627\u062F\u0645",
    expense: result.expense,
    recurringExpense: result.recurring
  });
});
apiRouter.get("/promotions", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const promotions = db.getPromotions(authReq.tenantId);
  res.json({ promotions });
});
apiRouter.post("/promotions", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const {
    title,
    description,
    type,
    buyProductId,
    buyQuantity,
    freeProductId,
    freeQuantity,
    productId,
    minQuantity,
    discountPct,
    minCartTotalSdg,
    discountAmountSdg,
    startDate,
    endDate,
    isActive
  } = req.body;
  if (!title || !type) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0639\u0631\u0636 \u0648\u0646\u0648\u0639 \u0627\u0644\u0642\u0627\u0639\u062F\u0629" });
  }
  const products = db.getSchema().products;
  const buyProd = products.find((p) => p.id === buyProductId);
  const freeProd = products.find((p) => p.id === freeProductId);
  const targetProd = products.find((p) => p.id === productId);
  const newPromo = {
    id: newId("promo"),
    tenantId: authReq.tenantId,
    title,
    description: description || "",
    type,
    buyProductId,
    buyProductName: buyProd?.name,
    buyQuantity: buyQuantity ? Number(buyQuantity) : void 0,
    freeProductId,
    freeProductName: freeProd?.name,
    freeQuantity: freeQuantity ? Number(freeQuantity) : void 0,
    productId,
    productName: targetProd?.name,
    minQuantity: minQuantity ? Number(minQuantity) : void 0,
    discountPct: discountPct ? Number(discountPct) : void 0,
    minCartTotalSdg: minCartTotalSdg ? Number(minCartTotalSdg) : void 0,
    discountAmountSdg: discountAmountSdg ? Number(discountAmountSdg) : void 0,
    startDate,
    endDate,
    isActive: isActive !== void 0 ? Boolean(isActive) : true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.addPromotion(newPromo);
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_PROMOTION",
    entity: "Promotion",
    entityId: newPromo.id,
    details: `\u0625\u0646\u0634\u0627\u0621 \u0639\u0631\u0636 \u062A\u0631\u0648\u064A\u062C\u064A \u062C\u062F\u064A\u062F: \xAB${newPromo.title}\xBB`
  });
  res.status(201).json({ success: true, promotion: newPromo });
});
apiRouter.put("/promotions/:id", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const updated = db.updatePromotion(authReq.tenantId, id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u062A\u0631\u0648\u064A\u062C\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, promotion: updated });
});
apiRouter.delete("/promotions/:id", merchantAuthMiddleware, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const deleted = db.deletePromotion(authReq.tenantId, id);
  if (!deleted) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u062A\u0631\u0648\u064A\u062C\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u062A\u0631\u0648\u064A\u062C\u064A" });
});
var GEMINI_KEY = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
var parseSaleHits = /* @__PURE__ */ new Map();
function allowParseSale(tenantId, max = 20, windowMs = 6e4) {
  const now = Date.now();
  const rec = parseSaleHits.get(tenantId);
  if (!rec || now - rec.t > windowMs) {
    parseSaleHits.set(tenantId, { n: 1, t: now });
    return true;
  }
  if (rec.n >= max) return false;
  rec.n += 1;
  return true;
}
var ASSISTANT_MODELS = [
  /*
   * الترتيب مقصود: الأسرع أولاً.
   * ------------------------------------------------------------------
   * كان flash-preview (نموذج تفكير) هو الأول، فكل سؤال عادي يستغرق
   * 20–21 ثانية. الآن flash-lite أولاً (أقل من نصف الزمن)، ولو فشل
   * ننتقل للنماذج الأكبر. GEMINI_MODEL يظل له الأولوية لو ضُبط يدوياً.
   */
  process.env.GEMINI_MODEL,
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-2.5-flash"
].filter(Boolean);
var isNewsQuery = (msg) => {
  const news = /(اخبار|أخبار|جريدة|صحيفة|عناوين|أحداث|احداث)/i.test(msg);
  const money2 = /(سعر|أسعار|اسعار|صرف|دولار|ريال|درهم|يورو|تحويل)/i.test(msg);
  return news && !money2;
};
var ratesBlockForPrompt = (snapshot) => {
  if (!snapshot?.rates?.length) {
    return "\u0644\u0627 \u062A\u0648\u062C\u062F \u0642\u0631\u0627\u0621\u0629 \u062D\u062F\u064A\u062B\u0629 \u0644\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u0632\u064A \u0627\u0644\u0622\u0646 \u2014 \u0642\u0644 \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0625\u0646 \u0627\u0644\u0645\u0635\u062F\u0631 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u062D\u0627\u0644\u064A\u0627\u064B \u0648\u0644\u0627 \u062A\u062E\u062A\u0631\u0639 \u0623\u0631\u0642\u0627\u0645\u0627\u064B.";
  }
  const lines = snapshot.rates.map((r) => {
    const parallel = r.parallel ?? r.official;
    const bank = r.official ? ` \u2014 \u0628\u0646\u0643 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 ${r.official}` : "";
    const label = r.code === "USD" ? "\u062F\u0648\u0644\u0627\u0631 \u0623\u0645\u0631\u064A\u0643\u064A" : r.code === "SAR" ? "\u0631\u064A\u0627\u0644 \u0633\u0639\u0648\u062F\u064A" : r.code === "AED" ? "\u062F\u0631\u0647\u0645 \u0625\u0645\u0627\u0631\u0627\u062A\u064A" : r.code === "EUR" ? "\u064A\u0648\u0631\u0648" : r.code === "EGP" ? "\u062C\u0646\u064A\u0647 \u0645\u0635\u0631\u064A" : r.code === "QAR" ? "\u0631\u064A\u0627\u0644 \u0642\u0637\u0631\u064A" : r.code;
    return `- ${label} (${r.code}): ${parallel} \u062C.\u0633${bank}`;
  });
  const when = snapshot.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleString("ar-SD", { timeZone: "Africa/Khartoum" }) : "";
  const age = describeAgeAr(snapshot.fetchedAt);
  return `\u0627\u0644\u0645\u0635\u062F\u0631: ${snapshot.source || "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u0632\u064A"} \u2014 \u062A\u0645 \u0633\u062D\u0628 \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0645\u0646 \u0627\u0644\u0645\u0648\u0642\u0639: ${age}` + (when ? ` (${when})` : "") + `
${lines.join("\n")}`;
};
function buildSystemInstruction(mode, context) {
  const now = /* @__PURE__ */ new Date();
  return `\u0623\u0646\u062A \xAB\u0633\u0646\u062F\xBB \u2014 \u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A \u0627\u0644\u0631\u0633\u0645\u064A \u0644\u0645\u0646\u0635\u0629 \u0633\u0646\u062F (Sanad POS & Commerce) \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 \u0627\u0644\u0633\u062D\u0627\u0628\u064A\u0629 \u0641\u064A \u0627\u0644\u0633\u0648\u062F\u0627\u0646.

## \u0634\u062E\u0635\u064A\u062A\u0643
- \u0648\u062F\u0648\u062F\u060C \u0645\u062D\u062A\u0631\u0645\u060C \u0630\u0643\u064A \u062C\u062F\u0627\u064B\u060C \u0648\u062A\u062A\u062D\u062F\u062B \u0628\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A\u0629 \u0627\u0644\u0637\u0628\u064A\u0639\u064A\u0629 ("\u062D\u0628\u0627\u0628\u0643 \u0639\u0634\u0631\u0629"\u060C "\u0623\u0628\u0634\u0631 \u0628\u0627\u0644\u062E\u064A\u0631"\u060C "\u0645\u0627 \u062A\u0634\u064A\u0644 \u0647\u0645"\u060C "\u0647\u0633\u064A"\u060C "\u062F\u0627\u064A\u0631"\u060C "\u0627\u0644\u0633\u0645\u062D").
- \u062A\u062C\u0627\u0648\u0628 \u0628\u0627\u062E\u062A\u0635\u0627\u0631 \u0648\u062F\u0642\u0629\u060C \u0648\u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0646\u0642\u0627\u0637 \u0648\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0644\u0648 \u0627\u0644\u062C\u0648\u0627\u0628 \u0637\u0648\u064A\u0644.
- \u0645\u0624\u062F\u0628 \u0645\u0639 \u0627\u0644\u062C\u0645\u064A\u0639\u060C \u0644\u0627 \u062A\u0634\u0627\u0631\u0643 \u0641\u064A \u0627\u0644\u0625\u0633\u0627\u0621\u0629 \u0623\u0648 \u0627\u0644\u0643\u0631\u0627\u0647\u064A\u0629 \u0623\u0648 \u0623\u064A \u0645\u062D\u062A\u0648\u0649 \u0636\u0627\u0631.

## \u0646\u0637\u0627\u0642 \u0627\u0644\u0625\u062C\u0627\u0628\u0629 (\u0645\u0647\u0645 \u062C\u062F\u0627\u064B)
- \u062A\u0642\u062F\u0631 \u062A\u062C\u0627\u0648\u0628 \u0639\u0644\u0649 \u0623\u064A \u0633\u0624\u0627\u0644: \u0639\u0627\u0645\u060C \u062B\u0642\u0627\u0641\u064A\u060C \u062F\u064A\u0646\u064A\u060C \u062A\u0627\u0631\u064A\u062E\u064A\u060C \u0639\u0644\u0645\u064A\u060C \u062D\u0633\u0627\u0628\u064A\u060C \u0637\u0628\u064A \u0639\u0627\u0645\u060C \u0642\u0627\u0646\u0648\u0646\u064A \u0639\u0627\u0645\u060C \u0628\u0631\u0645\u062C\u064A\u060C \u062A\u0631\u062C\u0645\u0629\u060C \u062A\u0644\u062E\u064A\u0635\u060C \u0623\u0641\u0643\u0627\u0631\u060C \u0646\u0635\u0627\u0626\u062D \u2014 \u062D\u062A\u0649 \u0644\u0648 \u0645\u0627 \u0644\u064A\u0647 \u0639\u0644\u0627\u0642\u0629 \u0628\u0627\u0644\u0645\u0646\u0635\u0629.
- \u0645\u0627 \u062A\u0639\u062A\u0630\u0631 \u0648\u0644\u0627 \u062A\u0642\u0648\u0644 "\u0645\u0627 \u0639\u0646\u062F\u064A \u0645\u0639\u0644\u0648\u0645\u0629" \u0625\u0644\u0627 \u0625\u0630\u0627 \u0641\u0639\u0644\u0627\u064B \u0645\u0627 \u062A\u0639\u0631\u0641.
- \u0641\u064A \u0627\u0644\u0635\u062D\u0629 \u0648\u0627\u0644\u0623\u062F\u0648\u064A\u0629 \u0648\u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0648\u0627\u0644\u0623\u0645\u0648\u0627\u0644: \u0645\u0639\u0644\u0648\u0645\u0629 \u0639\u0627\u0645\u0629 \u0645\u0641\u064A\u062F\u0629 + \u0646\u0635\u064A\u062D\u0629 \u0628\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u062E\u062A\u0635.
- \u0644\u0648 \u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u0627\u0645\u0636\u060C \u0627\u0633\u0623\u0644 \u0633\u0624\u0627\u0644 \u062A\u0648\u0636\u064A\u062D\u064A \u0648\u0627\u062D\u062F \u0642\u0635\u064A\u0631.

## \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0645\u0646\u0635\u0629
- \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 (POS): \u062A\u0639\u0645\u0644 \u0623\u0648\u0641\u0644\u0627\u064A\u0646 \u062F\u0648\u0646 \u0625\u0646\u062A\u0631\u0646\u062A \u0645\u0639 \u0645\u0632\u0627\u0645\u0646\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0629.
- \u0627\u0644\u062F\u0641\u0639: \u0628\u0646\u0643\u0643 (\u0628\u0646\u0643 \u0627\u0644\u062E\u0631\u0637\u0648\u0645)\u060C \u0641\u0648\u0631\u064A (\u0628\u0646\u0643 \u0641\u064A\u0635\u0644)\u060C \u0623\u0648\u0643\u0627\u0634\u060C \u0648\u062A\u062D\u0635\u064A\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u062A \u0627\u0644\u0623\u062C\u0646\u0628\u064A\u0629.
- \u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0635\u0631\u0641: \u062A\u064F\u0642\u0631\u0623 \u062D\u064A\u0651\u0629 \u0645\u0646 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u0632\u064A (\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0623\u0633\u0648\u062F) \u2014 \u0644\u0627 \u062A\u062D\u0641\u0638 \u0623\u0631\u0642\u0627\u0645\u0627\u064B \u062B\u0627\u0628\u062A\u0629\u060C \u0648\u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0645\u0631\u0641\u0642\u0629 \u0641\u064A \xAB\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u0632\u064A\xBB \u062A\u062D\u062A.
- \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062C\u0645\u0647\u0648\u0631: \u0627\u0644\u0643\u062A\u0627\u0644\u0648\u062C\u060C \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0633\u0628\u0642\u0629\u060C \u0627\u0644\u0633\u0644\u0629\u060C \u0627\u0644\u0645\u0641\u0636\u0644\u0629\u060C \u0646\u0642\u0627\u0637 \u0627\u0644\u0648\u0644\u0627\u0621 \u0648\u0627\u0644\u0643\u0648\u0628\u0648\u0646\u0627\u062A\u060C \u062A\u062A\u0628\u0639 \u0627\u0644\u0637\u0644\u0628\u0627\u062A\u060C \u0645\u0634\u0627\u0631\u0643\u0629 \u0648\u0627\u062A\u0633\u0627\u0628\u060C \u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A\u060C \u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0627\u0644\u0633\u0648\u0642 (\u0628\u0639\u062F \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0645\u0639 \u0631\u0633\u0648\u0645 \u0627\u062E\u062A\u064A\u0627\u0631\u064A\u0629)\u060C \u0648\u0637\u0644\u0628 \u0641\u062A\u062D \u0645\u062A\u062C\u0631 (\u0645\u0631\u0627\u062C\u0639\u0629 \u0625\u062F\u0627\u0631\u064A\u0629 + \u0643\u0648\u062F \u062F\u062E\u0648\u0644 + \u0642\u064A\u0645\u0629 \u062A\u0633\u062C\u064A\u0644).
- \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062A\u0627\u062C\u0631: \u0627\u0644\u0643\u0627\u0634\u064A\u0631\u060C \u0627\u0644\u0645\u062E\u0632\u0648\u0646\u060C \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A\u060C \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062A\u060C \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631\u060C \u0627\u0644\u0648\u0631\u062F\u064A\u0627\u062A\u060C \u0627\u0644\u0637\u0644\u0628\u0627\u062A\u060C \u0648\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A.
- \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629: \u0627\u0644\u0645\u062A\u0627\u062C\u0631\u060C \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643\u0627\u062A\u060C \u062A\u062F\u0642\u064A\u0642 \u0627\u0644\u0633\u062F\u0627\u062F\u060C \u0633\u062C\u0644 \u0627\u0644\u062A\u062F\u0642\u064A\u0642\u060C \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u062D\u0631\u0627\u0631\u064A\u0629\u060C \u0627\u0644\u0639\u0631\u0648\u0636\u060C \u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0627\u0644\u0633\u0648\u0642\u060C \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u062C\u0631.
- \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A: \u062F\u0627\u062E\u0644 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0648\u0639\u0644\u0649 \u0627\u0644\u0647\u0627\u062A\u0641 (\u0646\u0642\u0635 \u0627\u0644\u0645\u062E\u0632\u0648\u0646\u060C \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643\u060C \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628\u060C \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0627\u062A).

## \u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u0632\u064A (\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0623\u0633\u0648\u062F) \u2014 \u062D\u064A\u0651\u0629
${context?.liveRates ? ratesBlockForPrompt(context.liveRates) : "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0631\u0641\u0642\u0629."}

\u0642\u0648\u0627\u0639\u062F \u0635\u0627\u0631\u0645\u0629 \u0639\u0646\u062F \u0627\u0644\u0633\u0624\u0627\u0644 \u0639\u0646 \u0627\u0644\u0623\u0633\u0639\u0627\u0631:
- \u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0631\u0633\u0645\u064A \u0644\u0644\u0628\u0646\u0643 \u2260 \u0633\u0639\u0631 \u0627\u0644\u0633\u0648\u0642. \u0627\u0644\u0646\u0627\u0633 \u0641\u064A \u0627\u0644\u0633\u0648\u062F\u0627\u0646 \u0628\u062A\u062A\u0639\u0627\u0645\u0644 \u0628\u0633\u0639\u0631 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u0632\u064A\u060C \u0641\u0627\u0630\u0643\u0631 \u0633\u0639\u0631 \u0627\u0644\u0633\u0648\u0642 \u0623\u0648\u0644\u0627\u064B \u0648\u0628\u062E\u0637 \u0648\u0627\u0636\u062D.
- \u0639\u0645\u0631 \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0645\u0643\u062A\u0648\u0628 \u0641\u0648\u0642 (\xAB\u062A\u0645 \u0633\u062D\u0628 \u0627\u0644\u0642\u0631\u0627\u0621\u0629: \u0642\u0628\u0644 \u0643\u0630\u0627\xBB). **\u0645\u0627 \u062A\u0642\u0648\u0644 \u0623\u0628\u062F\u0627\u064B \xAB\u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u062D\u0642\u062A \u0627\u0644\u064A\u0648\u0645/\u0627\u0644\u0644\u064A\u0644\u0629\xBB** \u0644\u0648 \u0627\u0644\u0639\u0645\u0631 \u0623\u0643\u062B\u0631 \u0645\u0646 \u0631\u0628\u0639 \u0633\u0627\u0639\u0629 \u2014 \u0642\u0644 \u0627\u0644\u0639\u0645\u0631 \u0627\u0644\u062D\u0642\u064A\u0642\u064A \u0632\u064A \u0645\u0627 \u0647\u0648.
- \u0644\u0648 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0642\u0627\u0644 \xAB\u0627\u0644\u0633\u0639\u0631 \u0642\u062F\u064A\u0645\xBB: \u0637\u0627\u0628\u0642\u0647 \u0628\u0627\u0644\u0648\u0627\u0642\u0639 \u2014 \u0644\u0648 \u0627\u0644\u0631\u0642\u0645 \u0646\u0641\u0633\u0647 \u0645\u0627 \u0627\u062A\u063A\u064A\u0651\u0631 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631\u060C \u0642\u0648\u0644 \u0644\u064A\u0647 \u0628\u0635\u0631\u0627\u062D\u0629 \u0625\u0646 \u0627\u0644\u0633\u0648\u0642 \u0645\u0627 \u062A\u062D\u0631\u0651\u0643 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631 \u0645\u0646 \u0622\u062E\u0631 \u0642\u0631\u0627\u0621\u0629\u060C \u0648\u0625\u0646 \u0627\u0644\u0631\u0642\u0645 \u0647\u0648 \u0633\u0639\u0631 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u062D\u0627\u0644\u064A \u0641\u0639\u0644\u0627\u064B\u061B \u0648\u0645\u0627 \u062A\u062F\u0651\u0639\u064A \u0625\u0646\u0643 \u062D\u062F\u0651\u062B\u062A \u0644\u0648 \u0645\u0627 \u0641\u064A \u062A\u063A\u064A\u064A\u0631.
- \u0627\u0644\u0645\u0646\u0635\u0629 \u0628\u062A\u0642\u0631\u0623 **\u0645\u0635\u062F\u0631\u064A\u0646**: \u0633\u0648\u0642 \u0627\u0644\u0633\u0648\u062F\u0627\u0646 (alsoug.com) \u0648**\u0623\u062E\u0628\u0627\u0631 \u0627\u0644\u0633\u0648\u062F\u0627\u0646 (sudanakhbar.com)**. \u0644\u0648 \u0633\u0623\u0644 \u0639\u0646 \xAB\u0623\u062E\u0628\u0627\u0631 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\xBB \u0623\u0648 \u0627\u0644\u0645\u0635\u062F\u0631\u064A\u0646\u060C \u0627\u0644\u0645\u0646\u0635\u0629 \u0628\u062A\u062C\u064A\u0628\u0647\u0645 \u0641\u0639\u0644\u064A\u0627\u064B \u2014 **\u0645\u0627 \u062A\u0642\u0648\u0644 \u0623\u0628\u062F\u0627\u064B \xAB\u0645\u0627 \u0639\u0646\u062F\u064A \u0648\u0635\u0648\u0644\xBB**.
- \u0644\u0648 \u0645\u0627 \u0641\u064A \u0628\u064A\u0627\u0646\u0627\u062A \u062D\u062F\u064A\u062B\u0629 \u0623\u0635\u0644\u0627\u064B: \u0642\u0644 \u0628\u0635\u0631\u0627\u062D\u0629 \u0625\u0646 \u0627\u0644\u0645\u0635\u062F\u0631 \u0645\u0634 \u0645\u062A\u0627\u062D \u0647\u0633\u064A\u060C \u0648\u0645\u0627 \u062A\u062E\u062A\u0631\u0639 \u0633\u0639\u0631 \u0645\u0646 \u0631\u0627\u0633\u0643 \u0623\u0628\u062F\u0627\u064B.
- \u0644\u0648 \u0633\u0623\u0644 \u0639\u0646 \u0645\u0628\u0644\u063A (\u0645\u062B\u0644\u0627\u064B \xAB100 \u062F\u0648\u0644\u0627\u0631 \u0643\u0645 \u0628\u0627\u0644\u062C\u0646\u064A\u0647\u061F\xBB) \u0627\u062D\u0633\u0628 \u0628\u0627\u0644\u0636\u0631\u0628 \u0641\u064A \u0633\u0639\u0631 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u0632\u064A.
- \u0627\u062E\u062A\u0635\u0631: \u0633\u0639\u0631\u060C \u0645\u0635\u062F\u0631\u060C \u0648\u0642\u062A\u060C \u0648\u0646\u0635\u064A\u062D\u0629 \u0633\u0637\u0631 \u0648\u0627\u062D\u062F.
- **\u0627\u0644\u0627\u062E\u062A\u0635\u0627\u0631 \u0642\u0627\u0639\u062F\u0629 \u0639\u0627\u0645\u0629 \u0641\u064A \u0643\u0644 \u0633\u0624\u0627\u0644**: \u0663 \u0623\u0633\u0637\u0631 \u0643\u062D\u062F \u0623\u0642\u0635\u0649 (\u0665 \u0644\u0648 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0637\u0644\u0628 \u062A\u0641\u0635\u064A\u0644). \u0627\u0628\u062F\u0623 \u0628\u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u0628\u0644\u0627 \u0645\u0642\u062F\u0645\u0627\u062A \u0637\u0648\u064A\u0644\u0629 \u0632\u064A \xAB\u062D\u0628\u0627\u0628\u0643 \u0639\u0634\u0631\u0629 \u0623\u0628\u0634\u0631 \u0628\u0627\u0644\u062E\u064A\u0631\xBB \u2014 \u062C\u0645\u0644\u0629 \u062A\u0631\u062D\u064A\u0628 \u0642\u0635\u064A\u0631\u0629 \u062A\u0643\u0641\u064A \u0623\u0648 \u0628\u062F\u0648\u0646\u0647\u0627.
- **\u0623\u062E\u0628\u0627\u0631 \u0627\u0644\u0633\u0648\u062F\u0627\u0646**: \u0644\u0648 \u0633\u0623\u0644 \u0639\u0646 \u0627\u0644\u0623\u062E\u0628\u0627\u0631\u060C \u0627\u0644\u0639\u0646\u0627\u0648\u064A\u0646 \u0627\u0644\u062D\u0642\u064A\u0642\u064A\u0629 \u062A\u064F\u0642\u0631\u0623 \u0645\u0646 sudanakhbar.com \u0648\u062A\u064F\u0631\u0641\u064E\u0642 \u0645\u0639\u0643\u061B \u0627\u0639\u062A\u0645\u062F \u0639\u0644\u064A\u0647\u0627 \u0648\u0644\u0627 \u062A\u062C\u064A\u0628 \u0645\u0646 \u0627\u0644\u0630\u0627\u0643\u0631\u0629\u060C \u0648\u0644\u0627 \u062A\u0642\u0648\u0644 \xAB\u0645\u0627 \u0639\u0646\u062F\u064A \u0648\u0635\u0648\u0644\xBB.
- \u0627\u0643\u062A\u0628 \u0646\u0635 \u0639\u0627\u062F\u064A \u0628\u0644\u0627 \u0623\u064A \u0631\u0645\u0648\u0632 Markdown: \u0628\u062F\u0648\u0646 ** \u0623\u0648 * \u0623\u0648 # \u0623\u0648 _ \u2014 \u0627\u0633\u062A\u062E\u062F\u0645 \xAB\u2022\xBB \u0644\u0644\u0646\u0642\u0627\u0637\u060C \u0648\u0627\u0644\u062E\u0637 \u0627\u0644\u0641\u0627\u0635\u0644 \u0633\u0637\u0631 \u062C\u062F\u064A\u062F. (\u0627\u0644\u0634\u0627\u0634\u0629 \u0628\u062A\u0639\u0631\u0636 \u0627\u0644\u0646\u0635 \u0632\u064A \u0645\u0627 \u0647\u0648\u060C \u0648\u0627\u0644\u0631\u0645\u0648\u0632 \u0628\u062A\u0638\u0647\u0631 \u062E\u0627\u0645.)

## \u0627\u0644\u0633\u064A\u0627\u0642 \u0627\u0644\u062D\u0627\u0644\u064A
- \u0627\u0644\u062A\u0637\u0628\u064A\u0642: ${mode === "admin" ? "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0648\u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639" : mode === "merchant" ? "\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062A\u0627\u062C\u0631" : "\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062C\u0645\u0647\u0648\u0631"}
- \u0627\u0644\u0645\u0646\u0634\u0623\u0629: ${context?.tenantName || "\u0645\u0646\u0635\u0629 \u0633\u0646\u062F"} | \u0627\u0644\u0641\u0631\u0639: ${context?.branchName || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A"}
- \u0627\u0644\u062A\u0627\u0631\u064A\u062E: ${now.toLocaleString("ar-EG")}`;
}
async function geminiGenerate(opts) {
  const key = GEMINI_KEY();
  if (!key) return { text: null, error: "NO_API_KEY" };
  let lastError = "UNKNOWN";
  for (const model of opts.models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 14e3);
    try {
      const body = {
        contents: opts.contents,
        generationConfig: {
          temperature: opts.temperature ?? 0.8,
          maxOutputTokens: opts.maxTokens ?? 1200,
          ...opts.responseModalities ? { responseModalities: opts.responseModalities } : {},
          ...opts.speechConfig ? { speechConfig: opts.speechConfig } : {}
        },
        ...opts.systemInstruction ? { systemInstruction: { parts: [{ text: opts.systemInstruction }] } } : {}
      };
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(body),
          signal: controller.signal
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        lastError = `HTTP_${res.status}: ${data?.error?.message?.slice(0, 160) || "unknown"}`;
        if (res.status === 404 || res.status === 429 || res.status === 503) continue;
        return { text: null, error: lastError, model };
      }
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text2 = parts.map((p) => p?.text).filter(Boolean).join("\n").trim() || null;
      if (text2) return { text: text2, model };
      lastError = `EMPTY:${data?.candidates?.[0]?.finishReason || "unknown"}`;
    } catch (err) {
      lastError = err?.name === "AbortError" ? "TIMEOUT" : String(err?.message || err).slice(0, 140);
    } finally {
      clearTimeout(timer);
    }
  }
  return { text: null, error: lastError };
}
apiRouter.post("/ai/parse-sale", merchantAuthMiddleware, async (req, res) => {
  const authReq = req;
  if (!allowParseSale(authReq.tenantId)) {
    return res.status(429).json({ error: "\u062A\u062C\u0627\u0648\u0632\u062A \u062D\u062F \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u2014 \u0627\u0646\u062A\u0638\u0631 \u062F\u0642\u064A\u0642\u0629 \u0648\u062C\u0631\u0651\u0628 \u062A\u0627\u0646\u064A." });
  }
  const speechText = String((req.body || {}).speechText || "").trim();
  if (!speechText) return res.status(400).json({ error: "\u0646\u0635 \u0627\u0644\u0628\u064A\u0639 \u0645\u0637\u0644\u0648\u0628" });
  if (speechText.length > 800) return res.status(400).json({ error: "\u0627\u0644\u0646\u0635 \u0637\u0648\u064A\u0644 \u0632\u064A\u0627\u062F\u0629" });
  const products = db.getProducts(authReq.tenantId).filter((p) => p.isActive !== false);
  const local = parseSudaneseSale(speechText, products);
  const pack = (source, parsed) => ({
    source,
    lines: parsed.lines.map((l) => ({
      productId: l.product?.id || null,
      productName: l.product?.name || l.spokenName,
      quantity: l.quantity,
      unit: l.unitName,
      unitId: l.unitId,
      unitPrice: l.unitPrice,
      confidence: l.confidence,
      notes: l.note
    })),
    clarifications: parsed.clarifications.map((c) => ({
      phrase: c.phrase,
      reason: c.reason,
      suggestions: (c.suggestions || []).map((p) => p.name)
    })),
    paymentMethod: parsed.paymentMethod,
    discountAmount: parsed.discountAmount,
    discountPercent: parsed.discountPercent,
    customerName: parsed.customerName,
    summary: parsed.summary
  });
  const needsAi = local.lines.length === 0 || local.clarifications.length > 0;
  if (!needsAi || !GEMINI_KEY()) {
    return res.json(pack(local.lines.length ? "rule_engine" : "rule_engine_empty", local));
  }
  try {
    const inventorySummary = products.slice(0, 80).map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      price: p.sellingPriceSdg,
      sku: p.sku,
      barcode: p.barcode,
      category: p.category
    }));
    const prompt = `\u0623\u0646\u062A \u062E\u0628\u064A\u0631 \u0645\u062D\u0627\u0633\u0628\u064A \u064A\u0641\u0647\u0645 \u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A\u0629 \u0641\u064A \u0627\u0644\u062F\u0643\u0627\u0643\u064A\u0646.
\u062D\u0644\u0651\u0644 \u0637\u0644\u0628 \u0627\u0644\u0628\u064A\u0639 \u0648\u0637\u0627\u0628\u0642\u0647 \u0645\u0639 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0641\u0642\u0637. \u0644\u0627 \u062A\u062E\u062A\u0631\u0639 \u0623\u0633\u0639\u0627\u0631\u0627\u064B \u0648\u0644\u0627 \u0623\u0635\u0646\u0627\u0641\u0627\u064B \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.
\u0627\u0644\u0631\u0637\u0644 = 450 \u062C\u0645. \u0627\u0644\u062C\u0648\u0627\u0644 = 50 \u0643\u062C\u0645. \u0627\u0644\u062F\u0633\u062A\u0629 = 12 \u062D\u0628\u0629. \u0627\u0644\u062C\u0631\u0643\u0627\u0646\u0629 = 4 \u0644\u062A\u0631. \u0627\u0644\u0623\u0648\u0642\u064A\u0629 = 37.5 \u062C\u0645.

\u0646\u0635 \u0627\u0644\u062A\u0627\u062C\u0631: "${speechText.replace(/"/g, "\xAB")}"

\u0627\u0644\u0645\u062E\u0632\u0648\u0646:
${JSON.stringify(inventorySummary)}

\u0623\u0631\u062C\u0639 JSON \u062D\u0635\u0631\u0627\u064B \u0628\u0627\u0644\u0634\u0643\u0644:
{"recognizedItems":[{"productId":"id \u0623\u0648 null","productName":"...","quantity":1,"unit":"\u0643\u064A\u0644\u0648","confidence":0.9,"notes":"..."}],"clarificationNeeded":[{"originalPhrase":"...","reason":"...","possibleMatches":["..."]}],"discountAmount":0,"discountPercent":0,"customerName":null,"paymentMethod":"cash"}`;
    const ai = await geminiGenerate({
      models: ASSISTANT_MODELS,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      temperature: 0.1,
      maxTokens: 1200,
      timeoutMs: 12e3
    });
    if (!ai.text) return res.json(pack("rule_engine_after_error", local));
    let parsedJson = {};
    try {
      parsedJson = JSON.parse(ai.text);
    } catch {
      const fenced = ai.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      parsedJson = JSON.parse(fenced);
    }
    const items = Array.isArray(parsedJson.recognizedItems) ? parsedJson.recognizedItems : [];
    const merged = { ...local, lines: [...local.lines], clarifications: [...local.clarifications] };
    const seen = new Set(merged.lines.map((l) => l.product?.id).filter(Boolean));
    for (const it of items) {
      const product = products.find((p) => p.id === it.productId) || products.find((p) => p.name === it.productName);
      if (!product || seen.has(product.id)) continue;
      const qty = Number(it.quantity) || 1;
      const spokenUnit = findUnitInText(String(it.unit || "")) || resolveProductBaseUnit(product.unit);
      const priced = priceForUnit(product.sellingPriceSdg, product.unit, spokenUnit.id, qty);
      if (!priced.ok) continue;
      seen.add(product.id);
      merged.lines.push({
        product,
        spokenName: String(it.productName || product.name),
        quantity: qty,
        unitId: spokenUnit.id,
        unitName: spokenUnit.symbolAr,
        unitPrice: priced.unitPrice,
        confidence: Number(it.confidence) || 0.8,
        note: priced.explanation
      });
    }
    if (Array.isArray(parsedJson.clarificationNeeded)) {
      for (const c of parsedJson.clarificationNeeded) {
        merged.clarifications.push({
          phrase: String(c.originalPhrase || ""),
          reason: String(c.reason || "\u063A\u064A\u0631 \u0648\u0627\u0636\u062D"),
          suggestions: products.filter((p) => (c.possibleMatches || []).includes(p.name)).slice(0, 4)
        });
      }
    }
    if (parsedJson.paymentMethod) merged.paymentMethod = parsedJson.paymentMethod;
    if (Number(parsedJson.discountAmount)) merged.discountAmount = Number(parsedJson.discountAmount);
    if (Number(parsedJson.discountPercent)) merged.discountPercent = Number(parsedJson.discountPercent);
    if (parsedJson.customerName) merged.customerName = String(parsedJson.customerName);
    return res.json(pack("gemini_ai", merged));
  } catch (err) {
    console.error("parse-sale gemini", err);
    return res.json(pack("rule_engine_after_error", local));
  }
});
apiRouter.post("/assistant/chat", async (req, res) => {
  const { message, mode, context, history } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "\u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0645\u0637\u0644\u0648\u0628\u0629" });
  }
  const turns = Array.isArray(history) ? history.filter((h) => h && typeof h.text === "string" && h.text.trim()).slice(-8).map((h) => ({
    role: h.sender === "user" ? "user" : "model",
    parts: [{ text: String(h.text).slice(0, 3e3) }]
  })) : [];
  turns.push({ role: "user", parts: [{ text: message.slice(0, 3e3) }] });
  try {
    let liveRates = db.getRatesSnapshot();
    const newsOnly = isNewsQuery(message);
    const asksAboutRates = isRateQuery(message) && !newsOnly;
    const wantsSources = asksForSources(message);
    if (asksAboutRates) {
      const sources = await fetchAllSources().catch(() => []);
      if (sources.length) {
        const ordered = [...sources].sort((a, b) => {
          const rank = (x) => x.source.includes("sudanakhbar") ? 0 : 1;
          return rank(a) - rank(b);
        });
        const answer = formatMultiSourceAnswer(ordered, {
          storedAt: db.getRatesSnapshot()?.fetchedAt
        });
        return res.json({
          reply: answer,
          model: "rates-multi-source",
          sources: sources.map((s) => ({ name: s.source, fetchedAt: s.fetchedAt }))
        });
      }
    }
    if (newsOnly && !asksAboutRates) {
      const items = await fetchSudanAkhbarNews(6).catch(() => []);
      if (items.length) {
        const lines = items.map((it, i) => `${i + 1}. ${it.title}`).join("\n");
        return res.json({
          reply: `\u0622\u062E\u0631 \u0639\u0646\u0627\u0648\u064A\u0646 \u0627\u0644\u0633\u0648\u062F\u0627\u0646 \u0645\u0646 \xAB\u0623\u062E\u0628\u0627\u0631 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\xBB (sudanakhbar.com) \u0647\u0633\u064A:

${lines}

\u0627\u0644\u0645\u0635\u062F\u0631: sudanakhbar.com \u2014 \u0627\u0641\u062A\u062D \u0627\u0644\u0645\u0648\u0642\u0639 \u0644\u0644\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0643\u0627\u0645\u0644\u0629.`,
          model: "news-live",
          sources: [{ name: "sudanakhbar.com", count: items.length }]
        });
      }
    }
    if (asksAboutRates) {
      const hours = liveRates?.fetchedAt ? ageHours(liveRates.fetchedAt) : null;
      if (hours === null || hours >= 0.25) {
        try {
          const previousAt = liveRates?.fetchedAt;
          const prevUsd = liveRates?.rates?.find((r) => r.code === "USD")?.parallel ?? null;
          const snapshot = await fetchLiveRates();
          if (snapshot) {
            const curUsd = snapshot.rates.find((r) => r.code === "USD")?.parallel ?? null;
            liveRates = snapshot;
            db.applyLiveRates(snapshot, "\u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A");
            await db.flush({ lock: false }).catch(() => {
            });
            liveRates = db.getRatesSnapshot();
            liveRates.__changed = prevUsd === null || curUsd === null ? null : prevUsd !== curUsd;
            liveRates.__previousAt = previousAt;
          }
        } catch {
        }
      }
    }
    const enrichedContext = {
      ...context || {},
      liveRates: asksAboutRates ? liveRates : void 0
    };
    if (!GEMINI_KEY()) {
      const cached = db.getRatesSnapshot();
      if (asksAboutRates) {
        const offline = formatRatesAnswer(cached, {
          changed: liveRates?.__changed ?? null,
          previousAt: liveRates?.__previousAt
        });
        if (offline) return res.json({ reply: offline, model: "rates-live" });
      }
      return res.json({ reply: null, reason: "NO_API_KEY" });
    }
    const result = await geminiGenerate({
      models: ASSISTANT_MODELS,
      contents: turns,
      systemInstruction: buildSystemInstruction(String(mode || "admin"), enrichedContext),
      temperature: 0.75,
      /*
       * ردود أقصر = أسرع. كان 1200 توكن/16 ثانية، والردود تخرج طويلة
       * («حبابك عشرة…» + خطوات مسهبة). الآن سقف أقصر ومهلة أقصر.
       */
      maxTokens: 500,
      timeoutMs: 9e3
    });
    if (result.text) {
      return res.json({ reply: result.text, model: result.model });
    }
    console.warn("[assistant] failed:", result.error);
    if (asksAboutRates) {
      const offline = formatRatesAnswer(liveRates, {
        changed: liveRates?.__changed ?? null,
        previousAt: liveRates?.__previousAt
      });
      if (offline) return res.json({ reply: offline, model: "rates-cache" });
    }
    return res.json({ reply: null, reason: "FALLBACK", detail: result.error });
  } catch (error) {
    console.warn("Assistant route fallback:", error instanceof Error ? error.message : String(error));
    return res.json({ reply: null, reason: "FALLBACK" });
  }
});
apiRouter.post("/assistant/speak", async (req, res) => {
  const { text: text2 } = req.body || {};
  if (!text2 || typeof text2 !== "string") {
    return res.status(400).json({ error: "\u0627\u0644\u0646\u0635 \u0645\u0637\u0644\u0648\u0628" });
  }
  const key = GEMINI_KEY();
  if (!key) return res.json({ audio: null, reason: "NO_API_KEY" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15e3);
  try {
    const res2 = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts"}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: String(text2).slice(0, 700) }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
          }
        }),
        signal: controller.signal
      }
    );
    const data = await res2.json().catch(() => null);
    const part = data?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData);
    if (part?.inlineData?.data) {
      return res.json({
        audio: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "audio/wav"
      });
    }
    return res.json({ audio: null, reason: data?.error?.message?.slice(0, 120) || "NO_AUDIO" });
  } catch (error) {
    console.warn("[assistant] tts failed:", error instanceof Error ? error.message : String(error));
    return res.json({ audio: null, reason: "FALLBACK" });
  } finally {
    clearTimeout(timer);
  }
});
apiRouter.post("/media", async (req, res) => {
  try {
    const { dataUrl, kind, ownerPhone } = req.body || {};
    const media = await saveMedia({
      dataUrl,
      kind: kind === "video" ? "video" : "image",
      ownerPhone: typeof ownerPhone === "string" ? ownerPhone : void 0
    });
    res.json({ success: true, ...media });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error("[media] upload failed:", err);
    res.status(500).json({
      error: "UPLOAD_FAILED",
      message: "\u062A\u0639\u0630\u0631 \u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641\u060C \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
    });
  }
});
apiRouter.post("/media/chunk", async (req, res) => {
  try {
    const { uploadId, index, dataUrl, mime, kind, ownerPhone } = req.body || {};
    const result = await saveChunk({
      uploadId,
      index,
      dataUrl,
      mime,
      kind: kind === "image" ? "image" : "video",
      ownerPhone: typeof ownerPhone === "string" ? ownerPhone : void 0
    });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error("[media] chunk failed:", err);
    res.status(500).json({ error: "CHUNK_FAILED", message: "\u062A\u0639\u0630\u0631 \u0631\u0641\u0639 \u062C\u0632\u0621 \u0645\u0646 \u0627\u0644\u0645\u0644\u0641\u060C \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." });
  }
});
apiRouter.post("/media/complete", async (req, res) => {
  try {
    const { uploadId, totalChunks, kind } = req.body || {};
    const media = await completeChunked(
      String(uploadId || ""),
      Number(totalChunks) || 0,
      kind === "image" ? "image" : "video"
    );
    res.json({ success: true, ...media });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error("[media] complete failed:", err);
    res.status(500).json({ error: "UPLOAD_FAILED", message: "\u062A\u0639\u0630\u0631 \u062A\u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0644\u0641\u060C \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." });
  }
});
apiRouter.get("/media/:id", async (req, res) => {
  try {
    const media = await getMedia(req.params.id);
    if (!media) {
      return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    if (media.url) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.redirect(302, media.url);
    }
    const body = prepareForStreaming(req.params.id, media.mime, media.data);
    const answer = buildMediaResponse(body, media.mime, req.headers.range);
    res.status(answer.status);
    Object.entries(answer.headers).forEach(([key, value]) => res.setHeader(key, value));
    res.end(answer.body ?? void 0);
  } catch (err) {
    console.error("[media] read failed:", err);
    res.status(500).json({ error: "READ_FAILED" });
  }
});
apiRouter.get("/media", (_req, res) => {
  res.json({
    storage: storageMode(),
    maxUploadBytes: MAX_RAW_BYTES,
    maxVideoBytes: MAX_VIDEO_BYTES,
    chunkBytes: CHUNK_BYTES,
    kinds: ["image", "video"]
  });
});
apiRouter.delete("/media/:id", async (req, res) => {
  try {
    const removed = await deleteMedia(req.params.id);
    res.json({ success: removed });
  } catch (err) {
    console.error("[media] delete failed:", err);
    res.status(500).json({ error: "DELETE_FAILED" });
  }
});
var AD_PLANS = [
  {
    id: "monthly",
    label: "\u062E\u0637\u0629 \u0634\u0647\u0631\u064A\u0629",
    days: 30,
    priceSdg: Number(process.env.AD_PLAN_MONTHLY_SDG ?? 14e3),
    available: true
  },
  {
    id: "quarterly",
    label: "\u062E\u0637\u0629 3 \u0634\u0647\u0648\u0631",
    days: 90,
    priceSdg: 0,
    available: false,
    note: "\u0645\u062C\u0627\u0646\u064A\u0629: \u0644\u0627\u062D\u0642\u0627\u064B"
  },
  {
    id: "biannual",
    label: "\u062E\u0637\u0629 6 \u0634\u0647\u0648\u0631",
    days: 180,
    priceSdg: Number(process.env.AD_PLAN_BIANNUAL_SDG ?? 6e4),
    available: true
  },
  {
    id: "yearly",
    label: "\u062E\u0637\u0629 \u0633\u0646\u0648\u064A\u0629",
    days: 365,
    priceSdg: Number(process.env.AD_PLAN_YEARLY_SDG ?? 1e5),
    available: true
  }
];
var AD_PRICING = {
  standardFeeSdg: Number(process.env.AD_FEE_STANDARD_SDG ?? 0),
  vipFeeSdg: Number(process.env.AD_FEE_VIP_SDG ?? 5e3),
  currency: "SDG",
  plans: AD_PLANS
};
function planFor(planId) {
  const wanted = AD_PLANS.find((p) => p.id === planId && p.available);
  return wanted || AD_PLANS[0];
}
function feeFor(planId, isVip) {
  const plan = planFor(planId);
  return plan.priceSdg + (isVip ? AD_PRICING.vipFeeSdg : 0);
}
function tenantFromOwner(ownerToken) {
  if (!ownerToken || !ownerToken.startsWith("tenant:")) return void 0;
  return db.getTenant(ownerToken.slice("tenant:".length));
}
function decorateMarketAd(ad) {
  const t = tenantFromOwner(ad.ownerToken);
  const storeName = ad.storeName && String(ad.storeName).trim() || String(t?.tradeName || t?.name || "").trim();
  if (!storeName && !t) return ad;
  return {
    ...ad,
    storeName: storeName || ad.storeName,
    publisherName: storeName || ad.publisherName,
    storeSlug: t?.slug,
    tenantId: t?.id,
    storePhone: t?.phone
  };
}
function isLiveAd(ad) {
  if (ad.status !== "approved") return false;
  if (!ad.expiresAt) return true;
  return new Date(ad.expiresAt).getTime() > Date.now();
}
apiRouter.get("/market-ads/pricing", (_req, res) => {
  res.json({ pricing: AD_PRICING });
});
apiRouter.get("/market-ads", (req, res) => {
  const ownerToken = String(req.headers["x-owner-token"] || "");
  const all = db.getMarketAds();
  const approved = all.filter(isLiveAd).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(decorateMarketAd);
  const mine = ownerToken ? all.filter((a) => a.ownerToken === ownerToken).map(decorateMarketAd) : [];
  res.json({ ads: approved, mine, pricing: AD_PRICING });
});
apiRouter.post("/market-ads", (req, res) => {
  const {
    title,
    category,
    priceSdg,
    location,
    phone,
    whatsapp,
    description,
    imageUrl,
    videoUrl,
    isVip,
    publisherName,
    ownerToken,
    paymentRef,
    planId
  } = req.body || {};
  if (!title || String(title).trim().length < 4) {
    return res.status(400).json({ error: "TITLE_REQUIRED", message: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u0645\u0637\u0644\u0648\u0628 (4 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)." });
  }
  if (!phone || String(phone).trim().length < 9) {
    return res.status(400).json({ error: "PHONE_REQUIRED", message: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0623\u0648 \u0627\u0644\u0648\u0627\u062A\u0633\u0627\u0628 \u0645\u0637\u0644\u0648\u0628." });
  }
  if (!imageUrl && !videoUrl) {
    return res.status(400).json({ error: "MEDIA_REQUIRED", message: "\u0623\u0636\u0641 \u0635\u0648\u0631\u0629 \u0623\u0648 \u0641\u064A\u062F\u064A\u0648 \u0644\u0644\u0625\u0639\u0644\u0627\u0646." });
  }
  const authedTenantId = tryMerchantTenantId(req);
  let resolvedOwner = "";
  let merchantTenantId;
  if (authedTenantId) {
    resolvedOwner = `tenant:${authedTenantId}`;
    merchantTenantId = authedTenantId;
  } else {
    const claimed = ownerToken ? String(ownerToken) : "";
    if (claimed.startsWith("tenant:")) {
      return res.status(401).json({ error: "AUTH_REQUIRED_FOR_STORE_AD", message: "\u0646\u0634\u0631 \u0628\u0627\u0633\u0645 \u0645\u062A\u062C\u0631 \u064A\u062A\u0637\u0644\u0628 \u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u062A\u062C\u0631." });
    }
    if (claimed && String(claimed).length >= 8) {
      resolvedOwner = String(claimed);
    } else {
      resolvedOwner = `anon:${crypto2.randomBytes(16).toString("hex")}`;
    }
  }
  const merchantTenant = merchantTenantId ? db.getTenant(merchantTenantId) : void 0;
  const storeName = String(merchantTenant?.tradeName || merchantTenant?.name || "").trim();
  const ad = db.createMarketAd({
    title: String(title).trim(),
    category: category || "\u0639\u0627\u0645",
    priceSdg: Number(priceSdg) || 0,
    location: location || "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    phone: String(phone).trim(),
    whatsapp: whatsapp || phone,
    description: description || "",
    imageUrl: imageUrl || "",
    videoUrl: videoUrl || void 0,
    isVip: !!isVip,
    publisherName: storeName || publisherName || "\u0632\u0628\u0648\u0646 \u0645\u0646\u0635\u0629 \u0633\u0646\u062F",
    storeName: storeName || void 0,
    ownerToken: resolvedOwner,
    feeSdg: feeFor(planId, !!isVip),
    planId: planFor(planId).id,
    planLabel: planFor(planId).label,
    durationDays: planFor(planId).days,
    // The clock starts on approval; the ad stops showing when it runs out.
    expiresAt: new Date(Date.now() + planFor(planId).days * 24 * 60 * 60 * 1e3).toISOString(),
    paymentRef: paymentRef || void 0
  });
  notify({
    app: "admin",
    kind: "new_ad",
    title: "\u0625\u0639\u0644\u0627\u0646 \u062C\u062F\u064A\u062F \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629",
    body: `${ad.title} \u2014 ${ad.location} \u2022 ${ad.planLabel || "\u062E\u0637\u0629"}${ad.feeSdg > 0 ? ` \u2022 \u0631\u0633\u0648\u0645 ${ad.feeSdg.toLocaleString("en-US")} \u062C.\u0633` : " \u2022 \u0646\u0634\u0631 \u0645\u062C\u0627\u0646\u064A"}`,
    linkTab: "market_ads"
  }).catch(() => {
  });
  res.json({
    success: true,
    ad,
    message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0625\u0639\u0644\u0627\u0646\u0643 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629. \u0633\u064A\u0638\u0647\u0631 \u0641\u064A \u0627\u0644\u0633\u0648\u0642 \u0628\u0639\u062F \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629."
  });
});
apiRouter.put("/market-ads/:id", (req, res) => {
  const authed = tryMerchantTenantId(req);
  const headerToken = String(req.headers["x-owner-token"] || "");
  const ownerToken = authed ? `tenant:${authed}` : headerToken;
  const {
    title,
    category,
    priceSdg,
    location,
    phone,
    whatsapp,
    description,
    imageUrl,
    videoUrl
  } = req.body || {};
  if (!title || String(title).trim().length < 4) {
    return res.status(400).json({ error: "TITLE_REQUIRED", message: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u0645\u0637\u0644\u0648\u0628 (4 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)." });
  }
  if (!phone || String(phone).trim().length < 9) {
    return res.status(400).json({ error: "PHONE_REQUIRED", message: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0623\u0648 \u0627\u0644\u0648\u0627\u062A\u0633\u0627\u0628 \u0645\u0637\u0644\u0648\u0628." });
  }
  if (!imageUrl && !videoUrl) {
    return res.status(400).json({ error: "MEDIA_REQUIRED", message: "\u0623\u0636\u0641 \u0635\u0648\u0631\u0629 \u0623\u0648 \u0641\u064A\u062F\u064A\u0648 \u0644\u0644\u0625\u0639\u0644\u0627\u0646." });
  }
  const result = db.updateMarketAd(req.params.id, { ownerToken }, {
    title: String(title).trim(),
    category: category || "\u0639\u0627\u0645",
    priceSdg: Number(priceSdg) || 0,
    location: location || "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    phone: String(phone).trim(),
    whatsapp: whatsapp || phone,
    description: description || "",
    imageUrl: imageUrl || "",
    videoUrl: videoUrl || void 0
  });
  if (!result.ok) {
    return res.status(result.reason === "NOT_FOUND" ? 404 : 403).json({
      error: result.reason,
      message: result.reason === "NOT_FOUND" ? "\u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." : "\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u0625\u0639\u0644\u0627\u0646."
    });
  }
  notify({
    app: "admin",
    kind: "new_ad",
    title: "\u0625\u0639\u0644\u0627\u0646 \u0639\u064F\u062F\u0651\u0644 \u0628\u0639\u062F \u0627\u0644\u0646\u0634\u0631",
    body: `${result.ad?.title || ""} \u2014 ${result.ad?.location || ""} \u2022 \u0635\u0627\u062D\u0628\u0647 \u0635\u062D\u0651\u062D \u0628\u064A\u0627\u0646\u0627\u062A\u0647`,
    linkTab: "market_ads"
  }).catch(() => {
  });
  res.json({ success: true, ad: result.ad, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0625\u0639\u0644\u0627\u0646." });
});
apiRouter.delete("/market-ads/:id", (req, res) => {
  const authed = tryMerchantTenantId(req);
  const headerToken = String(req.headers["x-owner-token"] || "");
  const ownerToken = authed ? `tenant:${authed}` : headerToken;
  const result = db.deleteMarketAd(req.params.id, { ownerToken });
  if (!result.ok) {
    return res.status(result.reason === "NOT_FOUND" ? 404 : 403).json({
      error: result.reason,
      message: result.reason === "NOT_FOUND" ? "\u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." : "\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062D\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0625\u0639\u0644\u0627\u0646."
    });
  }
  res.json({ success: true });
});
apiRouter.get("/admin/market-ads", adminAuthMiddleware, (req, res) => {
  const status = String(req.query.status || "all");
  const ads = db.getMarketAds();
  const filtered = status === "all" ? ads : ads.filter((a) => a.status === status);
  res.json({
    ads: filtered.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1),
    counts: {
      pending: ads.filter((a) => a.status === "pending").length,
      approved: ads.filter((a) => a.status === "approved").length,
      rejected: ads.filter((a) => a.status === "rejected").length,
      feesDueSdg: ads.filter((a) => a.status === "pending" && a.feeSdg > 0).reduce((sum, a) => sum + a.feeSdg, 0),
      feesCollectedSdg: ads.filter((a) => a.status === "approved").reduce((sum, a) => sum + (a.feeSdg || 0), 0)
    },
    pricing: AD_PRICING
  });
});
apiRouter.post("/admin/market-ads/:id/review", adminAuthMiddleware, (req, res) => {
  const { decision, note, reviewedBy, paymentConfirmed } = req.body || {};
  if (decision !== "approved" && decision !== "rejected") {
    return res.status(400).json({ error: "BAD_DECISION", message: "\u0627\u0644\u0642\u0631\u0627\u0631 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 approved \u0623\u0648 rejected." });
  }
  const ad = db.reviewMarketAd(req.params.id, {
    decision,
    note,
    reviewedBy: reviewedBy || "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    paymentConfirmed: !!paymentConfirmed
  });
  if (!ad) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  notify({
    app: "client",
    kind: "ad_reviewed",
    title: decision === "approved" ? "\u062A\u0645 \u0646\u0634\u0631 \u0625\u0639\u0644\u0627\u0646\u0643 \u2705" : "\u062A\u0645 \u0631\u0641\u0636 \u0625\u0639\u0644\u0627\u0646\u0643",
    body: decision === "approved" ? `\xAB${ad.title}\xBB \u0623\u0635\u0628\u062D \u0638\u0627\u0647\u0631\u0627\u064B \u0641\u064A \u0627\u0644\u0633\u0648\u0642${ad.feeSdg > 0 ? ` \u0628\u0639\u062F \u062A\u0623\u0643\u064A\u062F \u0631\u0633\u0648\u0645 ${ad.feeSdg.toLocaleString("en-US")} \u062C.\u0633` : ""}.` : `\xAB${ad.title}\xBB \u2014 ${ad.rejectionReason || "\u0644\u0645 \u064A\u0633\u062A\u0648\u0641 \u0634\u0631\u0648\u0637 \u0627\u0644\u0646\u0634\u0631."}`,
    linkTab: "market",
    recipientToken: ad.ownerToken
  }).catch(() => {
  });
  res.json({ success: true, ad });
});
apiRouter.delete("/admin/market-ads/:id", adminAuthMiddleware, (req, res) => {
  const result = db.deleteMarketAd(req.params.id, { admin: true });
  if (!result.ok) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  res.json({ success: true });
});
var TENANT_REGISTRATION_FEE_SDG = Number(process.env.TENANT_REGISTRATION_FEE_SDG || 5e4);
var SUDAN_WILAYAS = [
  "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
  "\u0627\u0644\u062C\u0632\u064A\u0631\u0629",
  "\u0627\u0644\u0646\u064A\u0644 \u0627\u0644\u0623\u0632\u0631\u0642",
  "\u0627\u0644\u0646\u064A\u0644 \u0627\u0644\u0623\u0628\u064A\u0636",
  "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
  "\u0643\u0633\u0644\u0627",
  "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
  "\u0633\u0646\u0627\u0631",
  "\u0627\u0644\u0646\u064A\u0644 \u0627\u0644\u0623\u0632\u0631\u0642 \u0627\u0644\u0634\u0645\u0627\u0644\u064A",
  "\u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629",
  "\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644",
  "\u0634\u0645\u0627\u0644 \u0643\u0631\u062F\u0641\u0627\u0646",
  "\u062C\u0646\u0648\u0628 \u0643\u0631\u062F\u0641\u0627\u0646",
  "\u063A\u0631\u0628 \u0643\u0631\u062F\u0641\u0627\u0646",
  "\u0634\u0645\u0627\u0644 \u062F\u0627\u0631\u0641\u0648\u0631",
  "\u062C\u0646\u0648\u0628 \u062F\u0627\u0631\u0641\u0648\u0631",
  "\u0634\u0631\u0642 \u062F\u0627\u0631\u0641\u0648\u0631",
  "\u063A\u0631\u0628 \u062F\u0627\u0631\u0641\u0648\u0631",
  "\u0648\u0633\u0637 \u062F\u0627\u0631\u0641\u0648\u0631"
];
function newActivationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = (n) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `SND-${block(4)}-${block(4)}`;
}
apiRouter.get("/tenant-applications/pricing", (_req, res) => {
  res.json({
    registrationFeeSdg: TENANT_REGISTRATION_FEE_SDG,
    currency: "SDG",
    wilayas: SUDAN_WILAYAS,
    businessTypes: [
      "\u0628\u0642\u0627\u0644\u0627\u062A \u0648\u0645\u0648\u0627\u062F \u063A\u0630\u0627\u0626\u064A\u0629",
      "\u0645\u0637\u0627\u0639\u0645 \u0648\u0643\u0627\u0641\u064A\u0647\u0627\u062A",
      "\u0645\u0644\u0627\u0628\u0633 \u0648\u0623\u062D\u0630\u064A\u0629",
      "\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A \u0648\u062C\u0648\u0627\u0644\u0627\u062A",
      "\u0635\u064A\u062F\u0644\u064A\u0629 \u0648\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0637\u0628\u064A\u0629",
      "\u0623\u062C\u0647\u0632\u0629 \u0645\u0646\u0632\u0644\u064A\u0629",
      "\u0645\u0648\u0627\u062F \u0628\u0646\u0627\u0621",
      "\u0642\u0637\u0639 \u063A\u064A\u0627\u0631 \u0648\u0633\u064A\u0627\u0631\u0627\u062A",
      "\u0645\u0633\u062A\u062D\u0636\u0631\u0627\u062A \u062A\u062C\u0645\u064A\u0644",
      "\u0645\u0643\u062A\u0628\u0627\u062A \u0648\u0623\u062F\u0648\u0627\u062A \u0645\u062F\u0631\u0633\u064A\u0629",
      "\u062E\u062F\u0645\u0627\u062A \u0623\u062E\u0631\u0649"
    ]
  });
});
apiRouter.post("/tenant-applications", (req, res) => {
  const {
    storeName,
    ownerName,
    wilaya,
    city,
    phone,
    email,
    branchesCount,
    businessType,
    notes,
    source
  } = req.body || {};
  if (!storeName || String(storeName).trim().length < 3) {
    return res.status(400).json({ error: "STORE_NAME_REQUIRED", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u062A\u062C\u0631 \u0645\u0637\u0644\u0648\u0628 (3 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)." });
  }
  if (!ownerName || String(ownerName).trim().length < 3) {
    return res.status(400).json({ error: "OWNER_NAME_REQUIRED", message: "\u0627\u0633\u0645 \u0635\u0627\u062D\u0628 \u0627\u0644\u0645\u062A\u062C\u0631 \u0645\u0637\u0644\u0648\u0628." });
  }
  if (!wilaya || !String(wilaya).trim()) {
    return res.status(400).json({ error: "WILAYA_REQUIRED", message: "\u0627\u0644\u0648\u0644\u0627\u064A\u0629 \u0645\u0637\u0644\u0648\u0628\u0629." });
  }
  if (!city || String(city).trim().length < 2) {
    return res.status(400).json({ error: "CITY_REQUIRED", message: "\u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0645\u0637\u0644\u0648\u0628\u0629." });
  }
  if (!phone || String(phone).replace(/\D/g, "").length < 9) {
    return res.status(400).json({ error: "PHONE_REQUIRED", message: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0645\u0637\u0644\u0648\u0628 (9 \u0623\u0631\u0642\u0627\u0645 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)." });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ error: "EMAIL_INVALID", message: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." });
  }
  const branches = Number(branchesCount);
  if (!Number.isFinite(branches) || branches < 1 || branches > 200) {
    return res.status(400).json({ error: "BRANCHES_INVALID", message: "\u0639\u062F\u062F \u0627\u0644\u0641\u0631\u0648\u0639 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0631\u0642\u0645\u0627\u064B \u0628\u064A\u0646 1 \u0648 200." });
  }
  const application = db.createTenantApplication({
    storeName: String(storeName).trim(),
    ownerName: String(ownerName).trim(),
    wilaya: String(wilaya).trim(),
    city: String(city).trim(),
    phone: String(phone).trim(),
    email: email ? String(email).trim() : void 0,
    branchesCount: Math.round(branches),
    businessType: businessType ? String(businessType).trim() : "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F",
    notes: notes ? String(notes).trim() : void 0,
    source: source === "merchant" ? "merchant" : "client",
    registrationFeeSdg: TENANT_REGISTRATION_FEE_SDG,
    applicantToken: req.headers["x-owner-token"] || void 0
  });
  notify({
    app: "admin",
    kind: "new_store_request",
    title: "\u0637\u0644\u0628 \u0645\u062A\u062C\u0631 \u062C\u062F\u064A\u062F",
    body: `${application.storeName} \u2014 ${application.wilaya}/${application.city} \u2022 ${application.branchesCount} \u0641\u0631\u0639 \u2022 \u0631\u0633\u0648\u0645 ${application.registrationFeeSdg.toLocaleString("en-US")} \u062C.\u0633`,
    linkTab: "tenant_requests"
  }).catch(() => {
  });
  res.json({
    success: true,
    application: {
      id: application.id,
      storeName: application.storeName,
      status: application.status,
      registrationFeeSdg: application.registrationFeeSdg,
      createdAt: application.createdAt
    },
    message: `\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628 \u0645\u062A\u062C\u0631 \xAB${application.storeName}\xBB. \u0633\u064A\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0643 \u0641\u0631\u064A\u0642 \u0633\u0646\u062F \u0628\u0639\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629\u060C \u0648\u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 ${TENANT_REGISTRATION_FEE_SDG.toLocaleString("en-US")} \u062C.\u0633.`
  });
});
apiRouter.get("/tenant-applications/status", (req, res) => {
  const code = String(req.query.code || "").trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ error: "CODE_REQUIRED", message: "\u0623\u062F\u062E\u0644 \u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644." });
  }
  const application = db.getTenantApplications().find((a) => (a.activationCode || "").toUpperCase() === code);
  if (!application) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0637\u0644\u0628 \u0628\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F." });
  }
  res.json({
    application: {
      id: application.id,
      storeName: application.storeName,
      status: application.status,
      registrationFeeSdg: application.registrationFeeSdg,
      activationCode: application.activationCode,
      reviewedAt: application.reviewedAt
    }
  });
});
function ensureOwnerEmployee(tenantId, ownerName, phone) {
  const employees = db.getSchema().employees.filter((e) => e.tenantId === tenantId);
  const hasOwner = (employees || []).some((e) => e.role === "owner");
  if (hasOwner) return;
  db.getSchema().employees.push({
    id: `emp_owner_${tenantId}`,
    tenantId,
    name: ownerName,
    phone,
    role: "owner",
    pin: "1234",
    permissions: ["all"],
    maxDiscountPct: 50,
    isActive: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
function withIssuedCode(tenant, issued) {
  return {
    ...tenant || {},
    merchantCode: issued,
    merchantCodeMessage: issued ? "\u0647\u0630\u0627 \u0643\u0648\u062F \u062F\u062E\u0648\u0644 \u0645\u062A\u062C\u0631\u0643 \u2014 \u0627\u062D\u0641\u0638\u0647 \u0627\u0644\u0622\u0646\u060C \u0644\u0646 \u064A\u0638\u0647\u0631 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." : "\u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631 \u0644\u0647 \u0643\u0648\u062F \u062F\u062E\u0648\u0644 \u0645\u064F\u0635\u062F\u0631 \u0645\u0646 \u0642\u0628\u0644 \u2014 \u0627\u0637\u0644\u0628\u0647 \u0645\u0646 \u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F \u0639\u0628\u0631 \u0648\u0627\u062A\u0633\u0627\u0628 (\u0623\u0648 \u0623\u0639\u062F \u0625\u0635\u062F\u0627\u0631\u0647 \u0645\u0646 \u0627\u0644\u0645\u0646\u0635\u0629)."
  };
}
apiRouter.post("/tenant-applications/access-code", (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "CODE_REQUIRED", message: "\u0623\u062F\u062E\u0644 \u0643\u0648\u062F \u0627\u0644\u0637\u0644\u0628 (SND-XXXX-XXXX)." });
  const application = db.getTenantApplications().find((a) => (a.activationCode || "").toUpperCase() === code);
  if (!application) return res.status(404).json({ error: "NOT_FOUND", message: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0637\u0644\u0628 \u0628\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F." });
  if (application.status !== "approved") {
    return res.status(400).json({ error: "NOT_APPROVED", message: "\u0627\u0644\u0637\u0644\u0628 \u0644\u0645 \u064A\u064F\u0639\u062A\u0645\u062F \u0628\u0639\u062F \u2014 \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F." });
  }
  const tenant = (application.tenantId ? db.getTenant(application.tenantId) : null) || db.getSchema().tenants.find((t) => t.phone === application.phone && t.name === application.storeName) || db.getSchema().tenants.find((t) => t.phone === application.phone);
  if (!tenant) {
    return res.status(409).json({
      error: "NOT_ACTIVATED",
      message: "\u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628 \u0644\u0645 \u064A\u064F\u0641\u0639\u0651\u0644 \u0628\u0639\u062F \u2014 \u0627\u0633\u062A\u062E\u062F\u0645 \u0632\u0631 \xAB\u062A\u0641\u0639\u064A\u0644 \u0645\u062A\u062C\u0631 \u0628\u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644\xBB \u0641\u064A \u0627\u0644\u062A\u0637\u0628\u064A\u0642."
    });
  }
  const hash = String(tenant.merchantCodeHash || "");
  if (/^[0-9a-f]{64}$/.test(hash)) {
    const rotate = req.body?.rotate === true || req.body?.rotate === "true";
    if (!rotate) {
      const { merchantCodeHash: _h, ...safe } = tenant;
      return res.json({ success: true, issued: false, canRotate: true, tenant: safe, ...withIssuedCode({}, null) });
    }
  }
  const fresh = newMerchantCode();
  const freshHash = merchantCodeHash(fresh);
  if (!freshHash) return res.status(500).json({ error: "CODE_GEN_FAILED", message: "\u062A\u0639\u0630\u0651\u0631 \u062A\u0648\u0644\u064A\u062F \u0627\u0644\u0643\u0648\u062F \u2014 \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." });
  db.setMerchantCode(tenant.id, freshHash, "self_activation_repair", fresh);
  db.commit();
  db.logAudit({
    tenantId: tenant.id,
    actorId: "applicant",
    actorName: application.ownerName || "\u0635\u0627\u062D\u0628 \u0627\u0644\u0645\u062A\u062C\u0631",
    action: "ISSUE_MERCHANT_CODE",
    entity: "Tenant",
    entityId: tenant.id,
    details: "\u0625\u0635\u062F\u0627\u0631 \u0643\u0648\u062F \u062F\u062E\u0648\u0644 \u0644\u0645\u062A\u062C\u0631 \u0641\u064F\u0639\u0651\u0644 \u0642\u0628\u0644 \u0627\u0644\u0625\u0635\u0644\u0627\u062D \u0648\u0644\u0645 \u064A\u0643\u0646 \u0644\u0647 \u0643\u0648\u062F"
  });
  const { merchantCodeHash: _h2, ...safeTenant } = tenant;
  res.json({ success: true, issued: true, tenant: safeTenant, ...withIssuedCode({}, fresh) });
});
apiRouter.post("/admin/tenants/repair-codes", adminAuthMiddleware, (req, res) => {
  const rotateAll = req.body?.rotateAll === true;
  const repaired = [];
  for (const tenant of db.getSchema().tenants) {
    const hash = String(tenant.merchantCodeHash || "");
    const needsCode = rotateAll ? String(tenant.merchantCodePrefix || "").length > 12 || !String(tenant.merchantCodePrefix || "") : !/^[0-9a-f]{64}$/.test(hash);
    if (!needsCode) continue;
    if (tenant.status === "suspended") continue;
    const fresh = newMerchantCode();
    const freshHash = merchantCodeHash(fresh);
    if (!freshHash) continue;
    db.setMerchantCode(tenant.id, freshHash, "saas_admin_repair", fresh);
    repaired.push({ tenantId: tenant.id, name: tenant.tradeName || tenant.name, code: fresh });
  }
  if (repaired.length) db.commit();
  res.json({
    success: true,
    count: repaired.length,
    repaired,
    message: repaired.length ? `\u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0643\u0648\u062F \u062F\u062E\u0648\u0644 \u0644\u0640 ${repaired.length} \u0645\u062A\u062C\u0631\u0627\u064B. \u0627\u0646\u0633\u062E\u0647\u0627 \u0627\u0644\u0622\u0646 \u2014 \u0644\u0646 \u062A\u0638\u0647\u0631 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.` : "\u0643\u0644 \u0627\u0644\u0645\u062A\u0627\u062C\u0631 \u0644\u062F\u064A\u0647\u0627 \u0643\u0648\u062F \u062F\u062E\u0648\u0644 \u0628\u0627\u0644\u0641\u0639\u0644."
  });
});
apiRouter.post("/tenant-applications/activate", (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ error: "CODE_REQUIRED", message: "\u0623\u062F\u062E\u0644 \u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644." });
  }
  const existingTenant = db.findTenantByMerchantCodeHash(String(merchantCodeHash(code) || ""));
  if (existingTenant) {
    return res.json({ success: true, created: false, alreadyActive: true, tenant: existingTenant });
  }
  const application = db.getTenantApplications().find((a) => (a.activationCode || "").toUpperCase() === code);
  if (!application) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0637\u0644\u0628 \u0628\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F. \u0631\u0627\u062C\u0639 \u0627\u0644\u0625\u062F\u0627\u0631\u0629." });
  }
  if (application.status !== "approved") {
    return res.status(400).json({
      error: "NOT_APPROVED",
      message: application.status === "pending" ? "\u0637\u0644\u0628\u0643 \u0644\u0633\u0647 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u2014 \u0627\u0644\u0643\u0648\u062F \u064A\u0635\u0628\u062D \u0635\u0627\u0644\u062D\u0627\u064B \u0628\u0639\u062F \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629." : "\u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628 \u0645\u0631\u0641\u0648\u0636\u060C \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0625\u062F\u0627\u0631\u0629."
    });
  }
  const existing = application.tenantId ? db.getTenant(application.tenantId) : db.getSchema().tenants.find((t) => t.phone === application.phone && t.name === application.storeName);
  if (existing) {
    if (!existing.ownerName && application.ownerName) {
      existing.ownerName = application.ownerName;
    }
    ensureOwnerEmployee(existing.id, application.ownerName, application.phone);
    let repeatCode = String(application.activationCode || "").toUpperCase() || null;
    try {
      const h = repeatCode ? merchantCodeHash(repeatCode) : null;
      if (h && String(existing.merchantCodeHash || "") !== h) {
        db.setMerchantCode(existing.id, h, "self_activation", repeatCode || void 0);
      }
    } catch {
    }
    db.commit();
    return res.json({
      success: true,
      created: false,
      tenant: existing,
      merchantCode: repeatCode,
      merchantCodeMessage: repeatCode ? `\u0645\u062A\u062C\u0631\u0643 \u0645\u0641\u0639\u0651\u0644. \u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644 \u0647\u0648 \u0646\u0641\u0633\u0647: ${repeatCode}` : "\u0645\u062A\u062C\u0631\u0643 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0627\u0637\u0644\u0628 \u0643\u0648\u062F\u0643 \u0645\u0646 \u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F \u0625\u0646 \u0641\u0642\u062F\u062A\u0647."
    });
  }
  const now = /* @__PURE__ */ new Date();
  const tenantId = `tenant_${application.id.replace(/^tapp_?/, "").slice(0, 10) || Date.now()}`;
  const tenant = {
    id: tenantId,
    ownerName: application.ownerName,
    slug: (application.storeName || "store").trim().replace(/\s+/g, "-").slice(0, 40) + "-" + tenantId.slice(-4),
    name: application.storeName,
    tradeName: application.storeName,
    phone: application.phone,
    city: application.city || "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: [application.wilaya, application.city].filter(Boolean).join(" - "),
    currency: "SDG",
    status: "active",
    subscriptionPlanId: "plan_starter",
    subscriptionExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1e3).toISOString(),
    settings: {
      receiptHeader: `${application.storeName}${application.city ? ` \u2014 ${application.city}` : ""}
\u0647\u0627\u062A\u0641: ${application.phone}`,
      receiptFooter: "\u0634\u0643\u0631\u0627\u064B \u0644\u0632\u064A\u0627\u0631\u062A\u0643\u0645!",
      allowNegativeStock: false,
      defaultMaxDiscountPct: 10,
      zatcaQrEnabled: false,
      costingMethod: "weighted_average",
      vatEnabled: false,
      defaultVatPct: 0,
      pricesIncludeVat: false,
      showVatBreakdown: true,
      showTaxPerItem: true,
      loyaltyRateSdgPerPoint: 1e3
    },
    createdAt: now.toISOString()
  };
  const schema = db.getSchema();
  schema.tenants.push(tenant);
  const branches = Math.max(1, Number(application.branchesCount) || 1);
  for (let i = 1; i <= branches; i++) {
    schema.branches.push({
      id: `branch_${tenantId}_${i}`,
      tenantId,
      name: i === 1 ? "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A" : `\u0641\u0631\u0639 ${i}`,
      code: `B${i}`,
      city: application.city || "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
      address: application.wilaya ? `${application.wilaya} - ${application.city || ""}` : "",
      phone: application.phone,
      isMain: i === 1,
      isActive: true
    });
  }
  ensureOwnerEmployee(tenantId, application.ownerName, application.phone);
  application.tenantId = tenantId;
  application.activatedAt = now.toISOString();
  let storeAccessCode = null;
  try {
    const loginCode = String(application.activationCode || "").toUpperCase();
    const hash = loginCode ? merchantCodeHash(loginCode) : null;
    if (hash) {
      db.setMerchantCode(tenantId, hash, "self_activation", loginCode);
      storeAccessCode = loginCode;
      application.merchantCodeIssuedAt = (/* @__PURE__ */ new Date()).toISOString();
    } else {
      const fresh = newMerchantCode();
      const freshHash = merchantCodeHash(fresh);
      if (freshHash) {
        db.setMerchantCode(tenantId, freshHash, "self_activation", fresh);
        storeAccessCode = fresh;
        application.merchantCodeIssuedAt = (/* @__PURE__ */ new Date()).toISOString();
      }
    }
  } catch {
    storeAccessCode = null;
  }
  db.commit();
  notify({
    app: "admin",
    kind: "new_store_request",
    title: "\u0645\u062A\u062C\u0631 \u062C\u062F\u064A\u062F \u0641\u0639\u0651\u0644 \u062D\u0633\u0627\u0628\u0647",
    body: `${tenant.name} \u2014 ${tenant.city} \u2022 ${branches} \u0641\u0631\u0639 \u2022 \u0628\u062F\u0623 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 30 \u064A\u0648\u0645\u0627\u064B${storeAccessCode ? ` \u2022 \u0643\u0648\u062F \u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u062A\u062C\u0631 ${storeAccessCode}` : ""}`,
    linkTab: "merchants",
    tenantId
  }).catch(() => {
  });
  res.json({
    success: true,
    created: true,
    tenant,
    merchantCode: storeAccessCode,
    merchantCodeMessage: storeAccessCode ? `\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0645\u062A\u062C\u0631\u0643 \u2014 \u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644 \u0647\u0648 \u0646\u0641\u0633\u0647 \u0627\u0644\u0643\u0648\u062F \u0627\u0644\u0630\u064A \u0648\u0635\u0644\u0643: ${storeAccessCode}` : "\u062A\u0639\u0630\u0651\u0631 \u062A\u062C\u0647\u064A\u0632 \u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644 \u2014 \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F \u0639\u0628\u0631 \u0648\u0627\u062A\u0633\u0627\u0628."
  });
});
apiRouter.get("/admin/tenant-applications", adminAuthMiddleware, (req, res) => {
  const status = String(req.query.status || "all");
  const all = db.getTenantApplications();
  const filtered = status === "all" ? all : all.filter((a) => a.status === status);
  res.json({
    applications: filtered.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1),
    counts: {
      pending: all.filter((a) => a.status === "pending").length,
      approved: all.filter((a) => a.status === "approved").length,
      rejected: all.filter((a) => a.status === "rejected").length,
      pendingBranches: all.filter((a) => a.status === "pending").reduce((s, a) => s + a.branchesCount, 0),
      feesExpectedSdg: all.filter((a) => a.status === "pending").reduce((s, a) => s + (a.registrationFeeSdg || 0), 0),
      feesCollectedSdg: all.filter((a) => a.status === "approved").reduce((s, a) => s + (a.registrationFeeSdg || 0), 0)
    },
    pricing: { registrationFeeSdg: TENANT_REGISTRATION_FEE_SDG, currency: "SDG" }
  });
});
apiRouter.post("/admin/tenant-applications/:id/review", adminAuthMiddleware, (req, res) => {
  const { decision, note, registrationFeeSdg, codeSentVia } = req.body || {};
  if (decision !== "approved" && decision !== "rejected") {
    return res.status(400).json({ error: "BAD_DECISION", message: "\u0627\u0644\u0642\u0631\u0627\u0631 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 approved \u0623\u0648 rejected." });
  }
  const existing = db.getTenantApplication(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const application = db.reviewTenantApplication(req.params.id, {
    decision,
    note,
    reviewedBy: req.actorName || "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    registrationFeeSdg: registrationFeeSdg === void 0 || registrationFeeSdg === null || registrationFeeSdg === "" ? void 0 : Number(registrationFeeSdg),
    activationCode: decision === "approved" ? existing.activationCode || newActivationCode() : void 0,
    codeSentVia: codeSentVia === "whatsapp" || codeSentVia === "sms" || codeSentVia === "email" ? codeSentVia : void 0
  });
  notify({
    app: application?.source === "merchant" ? "merchant" : "client",
    kind: "store_request_reviewed",
    title: decision === "approved" ? "\u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0645\u062A\u062C\u0631\u0643 \u{1F389}" : "\u062A\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u0645\u062A\u062C\u0631",
    body: decision === "approved" ? `\xAB${application?.storeName}\xBB \u2014 \u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644 ${application?.activationCode} \u2022 \u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 ${(application?.registrationFeeSdg || 0).toLocaleString("en-US")} \u062C.\u0633` : `\xAB${application?.storeName}\xBB \u2014 ${application?.rejectionReason || "\u0644\u0645 \u064A\u0633\u062A\u0648\u0641 \u0627\u0644\u0634\u0631\u0648\u0637."}`,
    linkTab: void 0,
    recipientToken: application?.applicantToken
  }).catch(() => {
  });
  res.json({
    success: true,
    application,
    message: decision === "approved" ? `\u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629. \u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644: ${application?.activationCode} \u2014 \u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 ${(application?.registrationFeeSdg || 0).toLocaleString("en-US")} \u062C.\u0633.` : "\u062A\u0645 \u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628."
  });
});
apiRouter.post("/admin/tenant-applications/:id/mark-sent", adminAuthMiddleware, (req, res) => {
  const via = req.body?.via;
  if (via !== "whatsapp" && via !== "sms" && via !== "email") {
    return res.status(400).json({ error: "BAD_CHANNEL", message: "\u0642\u0646\u0627\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629." });
  }
  const application = db.markTenantApplicationCodeSent(req.params.id, via);
  if (!application) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0643\u0648\u062F \u0645\u064F\u0635\u062F\u0631 \u0644\u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628." });
  }
  res.json({ success: true, application });
});
apiRouter.delete("/admin/tenant-applications/:id", adminAuthMiddleware, (req, res) => {
  const removed = db.deleteTenantApplication(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  res.json({ success: true });
});
var notificationAppOf = (value) => {
  if (value === "merchant" || value === "admin" || value === "client") return value;
  return "client";
};
apiRouter.get("/push/public-key", (_req, res) => {
  const key = getPublicKey();
  res.json({
    enabled: !!key,
    publicKey: key,
    message: key ? void 0 : "\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623\u0629 \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645 \u0628\u0639\u062F."
  });
});
apiRouter.get("/notifications", (req, res) => {
  const app = notificationAppOf(req.query.app);
  const ownerToken = req.headers["x-owner-token"] || void 0;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const headerTenant = String(req.headers["x-tenant-id"] || "").trim();
  const tenantFilter = app === "merchant" ? String(req.query.tenantId || headerTenant || "").trim() || void 0 : void 0;
  const rows = db.getNotifications({ app, ownerToken, tenantId: tenantFilter, limit });
  const unread = db.getNotifications({ app, ownerToken, tenantId: tenantFilter }).filter((n) => !n.read).length;
  res.json({ notifications: rows, unreadCount: unread, app });
});
apiRouter.post("/notifications/:id/read", (req, res) => {
  const ok = db.markNotificationRead(req.params.id);
  if (!ok) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0625\u0634\u0639\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true });
});
apiRouter.post("/notifications/read-all", (req, res) => {
  const app = notificationAppOf(req.body?.app);
  const ownerToken = req.headers["x-owner-token"] || void 0;
  const changed = db.markAllNotificationsRead({ app, ownerToken });
  res.json({ success: true, changed });
});
apiRouter.delete("/notifications/:id", (req, res) => {
  const ok = db.deleteNotification(req.params.id);
  if (!ok) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0625\u0634\u0639\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true });
});
apiRouter.post("/push/subscribe", (req, res) => {
  const { subscription, app, ownerToken } = req.body || {};
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: "BAD_SUBSCRIPTION", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629." });
  }
  const saved = db.savePushSubscription({
    endpoint,
    app: notificationAppOf(app),
    ownerToken: ownerToken || void 0,
    keys: { p256dh, auth }
  });
  res.json({ success: true, id: saved.id });
});
apiRouter.post("/push/unsubscribe", (req, res) => {
  const endpoint = req.body?.endpoint;
  if (!endpoint) {
    return res.status(400).json({ error: "ENDPOINT_REQUIRED", message: "\u0627\u0644\u0631\u0627\u0628\u0637 \u0645\u0637\u0644\u0648\u0628." });
  }
  db.deletePushSubscription(endpoint);
  res.json({ success: true });
});
apiRouter.post("/push/test", async (req, res) => {
  const app = notificationAppOf(req.body?.app);
  const ownerToken = req.headers["x-owner-token"] || void 0;
  const notification = await notify({
    app,
    kind: "system",
    title: "\u0625\u0634\u0639\u0627\u0631 \u062A\u062C\u0631\u064A\u0628\u064A \u0645\u0646 \u0633\u0646\u062F",
    body: "\u0625\u0646 \u0648\u0635\u0644\u062A\u0643 \u0647\u0630\u0647 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0641\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0647\u0627\u062A\u0641 \u062A\u0639\u0645\u0644 \u0628\u0646\u062C\u0627\u062D \u2705",
    linkTab: void 0,
    recipientToken: ownerToken
  });
  res.json({ success: true, notification });
});
apiRouter.post("/notifications/scan", async (_req, res) => {
  const result = await runNotificationScan();
  res.json({ success: true, ...result });
});
apiRouter.get("/cron/notify-scan", async (_req, res) => {
  const result = await runNotificationScan({ push: true });
  res.json({ success: true, ...result });
});
apiRouter.get("/cron/watchdog", async (_req, res) => {
  const report = await runWatchdog();
  res.status(report.ok ? 200 : 503).json(report);
});
apiRouter.get("/cron/test-alert", async (_req, res) => {
  if (!anyChannelConfigured()) {
    return res.status(400).json({
      ok: false,
      error: "ALERTS_NOT_CONFIGURED",
      hint: "\u0636\u064A\u0641 NTFY_TOPIC (\u0623\u0648 RESEND_API_KEY \u0648 ALERT_EMAIL_TO\u060C \u0623\u0648 \u062A\u0648\u0643\u0646 \u062A\u0644\u064A\u062C\u0631\u0627\u0645) \u0641\u064A Vercel \u062B\u0645 \u0623\u0639\u062F \u0627\u0644\u0646\u0634\u0631.",
      channels: []
    });
  }
  const verdict = await notifyAll(
    "\u{1F514} \u062A\u062C\u0631\u0628\u0629 \u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0633\u0646\u062F\n\u0648\u0635\u0644\u0643 \u0627\u0644\u062A\u0646\u0628\u064A\u0647 \u062F\u0647 \u064A\u0639\u0646\u064A \u0627\u0644\u0642\u0646\u0627\u0629 \u0634\u063A\u0627\u0644\u0629."
  );
  res.status(verdict.sent > 0 ? 200 : 502).json({ ok: verdict.sent > 0, ...verdict });
});
apiRouter.get("/cron/backup", async (_req, res) => {
  const result = await runBackup();
  res.status(result.ok ? 200 : 500).json(result);
});
var lastLazyScan = 0;
apiRouter.post("/notifications/scan-lazy", async (_req, res) => {
  const now = Date.now();
  if (now - lastLazyScan < 6 * 60 * 60 * 1e3) {
    return res.json({ success: true, skipped: true });
  }
  lastLazyScan = now;
  const result = await runNotificationScan();
  res.json({ success: true, ...result });
});
apiRouter.get("/market-banners", (_req, res) => {
  res.json({ banners: db.getMarketBanners(true) });
});
apiRouter.post("/market-banners/:id/click", (req, res) => {
  const banner = db.trackMarketBannerClick(req.params.id);
  if (!banner) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true, clicks: banner.clicks || 0 });
});
apiRouter.post("/market-banners/impressions", (req, res) => {
  const raw = req.body?.ids;
  const ids = Array.isArray(raw) ? raw.filter((i) => typeof i === "string").slice(0, 20) : [];
  if (!ids.length) {
    return res.status(400).json({ error: "IDS_REQUIRED", message: "\u0623\u0631\u0633\u0644 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0628\u0627\u0646\u0631\u0627\u062A." });
  }
  res.json({ success: true, counted: db.trackMarketBannerImpressions(ids) });
});
apiRouter.post("/market-banners/:id/impression", (req, res) => {
  const banner = db.trackMarketBannerImpression(req.params.id);
  if (!banner) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true, impressions: banner.impressions || 0 });
});
apiRouter.get("/admin/market-banners", adminAuthMiddleware, (_req, res) => {
  res.json({ banners: db.getMarketBanners(false) });
});
apiRouter.post("/admin/market-banners", adminAuthMiddleware, (req, res) => {
  const { title, subtitle, badge, imageUrl, linkUrl, advertiserName, advertiserTenantId, sortOrder, active } = req.body || {};
  if (!title || String(title).trim().length < 3) {
    return res.status(400).json({ error: "TITLE_REQUIRED", message: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0628\u0627\u0646\u0631 \u0645\u0637\u0644\u0648\u0628." });
  }
  if (!imageUrl || !String(imageUrl).trim()) {
    return res.status(400).json({ error: "IMAGE_REQUIRED", message: "\u0623\u0636\u0641 \u0635\u0648\u0631\u0629 \u0644\u0644\u0628\u0627\u0646\u0631." });
  }
  const banner = db.createMarketBanner({
    title: String(title).trim(),
    subtitle: subtitle ? String(subtitle).trim() : void 0,
    badge: badge ? String(badge).trim() : void 0,
    imageUrl: String(imageUrl).trim(),
    linkUrl: linkUrl ? String(linkUrl).trim() : void 0,
    advertiserName: advertiserName ? String(advertiserName).trim() : void 0,
    advertiserTenantId: advertiserTenantId ? String(advertiserTenantId).trim() : void 0,
    active: active !== false,
    sortOrder: sortOrder !== void 0 && sortOrder !== null && Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : db.getMarketBanners().length + 1
  });
  res.json({ success: true, banner });
});
apiRouter.put("/admin/market-banners/:id", adminAuthMiddleware, (req, res) => {
  const patch = {};
  for (const key of ["title", "subtitle", "badge", "imageUrl", "linkUrl", "advertiserName", "advertiserTenantId", "active", "sortOrder"]) {
    if (req.body?.[key] !== void 0) {
      patch[key] = key === "sortOrder" ? Number(req.body[key]) : key === "active" ? !!req.body[key] : req.body[key];
    }
  }
  const banner = db.updateMarketBanner(req.params.id, patch);
  if (!banner) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true, banner });
});
var bannersForRequestTenant = (req) => {
  const auth = req;
  return db.getMarketBannersForTenant(auth.tenantId);
};
apiRouter.get("/merchant/market-banners", merchantAuthMiddleware, (req, res) => {
  res.json({ banners: bannersForRequestTenant(req) });
});
apiRouter.get("/merchant/market-banners/:id/report", merchantAuthMiddleware, (req, res) => {
  const mine = bannersForRequestTenant(req).some((b) => b.id === req.params.id);
  if (!mine) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0647\u0630\u0627 \u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0631\u062A\u0628\u0637 \u0628\u062D\u0633\u0627\u0628\u0643." });
  }
  const from = typeof req.query.from === "string" ? req.query.from : void 0;
  const to = typeof req.query.to === "string" ? req.query.to : void 0;
  const report = db.getMarketBannerReport(req.params.id, from, to);
  if (!report) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true, ...report });
});
apiRouter.get("/admin/market-banners/:id/report", adminAuthMiddleware, (req, res) => {
  const from = typeof req.query.from === "string" ? req.query.from : void 0;
  const to = typeof req.query.to === "string" ? req.query.to : void 0;
  const report = db.getMarketBannerReport(req.params.id, from, to);
  if (!report) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true, ...report });
});
apiRouter.post("/admin/market-banners/:id/reset-clicks", adminAuthMiddleware, (req, res) => {
  const banner = db.resetMarketBannerClicks(req.params.id);
  if (!banner) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true, banner });
});
apiRouter.delete("/admin/market-banners/:id", adminAuthMiddleware, (req, res) => {
  const removed = db.deleteMarketBanner(req.params.id);
  if (!removed) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true });
});

// server.ts
init_pg();
init_storage();
init_alerts();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var tail = Promise.resolve();
var MAX_HOLD_MS = 25e3;
function withInstanceLock(fn) {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => void 0,
    () => void 0
  );
  return run;
}
function createApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use("/api", async (req, res, next) => {
    if (req.path === "/media" || req.path.startsWith("/media/") || req.path.startsWith("/barcode-lookup/")) {
      return next();
    }
    if (!isDbEnabled()) {
      return next();
    }
    const isMutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (isMutation) {
      const originalJson = res.json.bind(res);
      let flushed = false;
      res.json = (body) => {
        if (flushed) return originalJson(body);
        flushed = true;
        db.flush({ lock: false }).then(() => originalJson(body)).catch((err) => {
          const message = err.message;
          console.error("[DB] Flush failed:", message);
          recordDbError(err);
          res.status(/timeout/i.test(message) ? 503 : 500);
          originalJson({
            error: "DB_WRITE_FAILED",
            message: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A\u060C \u064A\u0631\u062C\u0649 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.",
            detail: message
          });
        });
        return res;
      };
    }
    withInstanceLock(async () => {
      try {
        await db.init();
        await db.refresh();
      } catch (err) {
        recordDbError(err);
        console.error("[DB] Request bootstrap failed:", err.message);
      }
      await new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(guard);
          resolve();
        };
        const guard = setTimeout(finish, MAX_HOLD_MS);
        if (typeof guard.unref === "function") guard.unref();
        res.on("finish", finish);
        res.on("close", finish);
        next();
      });
    }).catch((err) => {
      console.error("[API] Request failed:", err.message);
      if (!res.headersSent) next(err);
    });
  });
  app.use("/api", apiRouter);
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "Sanad POS",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      database: {
        enabled: isDbEnabled(),
        target: dbTarget(),
        tables: db.tableCount(),
        persisted: db.isPersisting(),
        lastError: lastDbError
      },
      // الملفات فين بتتخزن، والتنبيهات مفعّلة ولا لأ — من نظرة واحدة.
      media: { storage: storageMode() },
      alerts: { channels: channelsConfigured() }
    });
  });
  app.use("/assets", express.static(path.resolve(__dirname, "public/assets")));
  app.use("/icons", express.static(path.resolve(__dirname, "public/icons")));
  app.use(express.static(path.resolve(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "dist", "index.html"));
  });
  return app;
}
async function handler(req, res) {
  const app = createApp();
  return new Promise((resolve) => {
    app(req, res, () => resolve());
  });
}
export {
  createApp,
  handler as default
};
