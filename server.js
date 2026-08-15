/**
 * LongShot 常驻版后端 — Node + Playwright(Chromium)
 * 同时托管前端(index.html) 与 /api/screenshot，同源调用，无需 PAT。
 * 设计给 Docker 部署：监听 0.0.0.0:PORT（平台注入 PORT，默认 8080）。
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { chromium } = require("playwright");

const PORT = parseInt(process.env.PORT || "8080", 10);
const ROOT = __dirname;

const MIME = {
  ".html": "text/html;charset=utf-8", ".css": "text/css;charset=utf-8",
  ".js": "text/javascript;charset=utf-8", ".json": "application/json;charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon"
};

const VIEWPORTS = {
  desktop: { w: 1280, h: 900 },
  tablet:  { w: 768,  h: 1024 },
  mobile:  { w: 375,  h: 812 }
};
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function serveStatic(req, res) {
  const pathname = url.parse(req.url).pathname || "/";
  const filePath = pathname === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not Found"); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

async function handleScreenshot(req, res) {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "请用 POST 请求" }));
  }
  let body = "";
  await new Promise(r => { req.on("data", c => body += c); req.on("end", r); });
  let params;
  try { params = JSON.parse(body); } catch (e) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "JSON 格式错误" }));
  }

  const targetUrl = (params.url || "").trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "请输入有效网址（含 http:// 或 https://）" }));
  }

  const device   = params.device || "desktop";
  const fullPage = params.fullPage !== false;
  const format   = (params.format || "jpg").toLowerCase();
  const quality  = Math.min(1, Math.max(0.1, parseFloat(params.quality) || 0.92));
  const scale    = Math.min(3, Math.max(1, parseFloat(params.scale) || 2));
  const waitMs   = Math.min(30000, Math.max(0, parseInt(params.wait) || 1500));
  const width    = Math.min(3840, Math.max(200, parseInt(params.width) || 1280));

  const vp = VIEWPORTS[device] || VIEWPORTS.desktop;
  if (device === "custom") {
    vp.w = width;
    vp.h = Math.min(21600, Math.max(200, parseInt(params.height) || 900));
  }

  console.log("[截图]", targetUrl, "|", device, format, fullPage ? "整页" : "视口");

  let browser;
  try {
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--no-first-run"]
    });
    const page = await browser.newPage({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: scale,
      userAgent: UA
    });

    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 35000 }).catch(() => {});
    await page.waitForTimeout(waitMs);

    // 等待图片加载完
    try {
      await page.evaluate(() => Promise.all(
        Array.from(document.images)
          .filter(i => !i.src.startsWith("data:"))
          .map(i => i.complete ? Promise.resolve() : new Promise(r => { i.onload = r; i.onerror = r; setTimeout(r, 5000); }))
      ));
    } catch (_) {}

    const type = format === "jpg" ? "jpeg" : format;
    const buffer = await page.screenshot({
      fullPage,
      type,
      quality: format === "png" ? undefined : Math.round(quality * 100),
      animations: "disabled"
    });
    await browser.close();

    const ct = format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    res.writeHead(200, { "Content-Type": ct, "Content-Length": buffer.length, "Access-Control-Allow-Origin": "*" });
    res.end(buffer);
    console.log("[完成]", buffer.length, "bytes |", format);
  } catch (err) {
    console.error("[错误]", err.message);
    try { if (browser) await browser.close(); } catch (_) {}
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "截图失败: " + err.message, tip: "检查网址是否可访问、网络是否正常" }));
  }
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (parsed.pathname === "/api/screenshot") return handleScreenshot(req, res);
  if (parsed.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", engine: "Playwright + Chromium", formats: ["png","jpg","webp"] }));
  }
  serveStatic(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("║  LongShot 常驻服务已启动 :" + PORT + "  ║");
});
