/**
 * Cloudflare Pages Function: POST /api/screenshot
 * 使用 Cloudflare Browser Rendering (Puppeteer API) 在云端截取网页长图。
 * 前端同源调用，无需 PAT、无 2000 分钟限制。
 */
export const onRequestPost = async ({ request, env }) => {
  // CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  let params;
  try {
    params = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON 格式错误" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" }
    });
  }

  const targetUrl = (params.url || "").trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    return new Response(JSON.stringify({ error: "请输入有效网址（含 http:// 或 https://）" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" }
    });
  }

  const format   = (params.format || "jpg").toLowerCase();
  const fullPage = params.fullPage !== false;
  const quality  = Math.min(1, Math.max(0.1, parseFloat(params.quality) || 0.92));
  const scale    = Math.min(3, Math.max(1, parseFloat(params.scale) || 2));
  const waitMs   = Math.min(30000, Math.max(0, parseInt(params.wait) || 1500));

  const viewports = { desktop: [1280, 900], tablet: [768, 1024], mobile: [375, 812] };
  const device = params.device || "desktop";
  let width = parseInt(params.width) || 1280;
  let height = parseInt(params.height) || 900;
  if (device !== "custom" && viewports[device]) {
    [width, height] = viewports[device];
  } else if (device === "custom") {
    width = Math.min(3840, Math.max(200, width));
    height = Math.min(21600, Math.max(200, height));
  }

  console.log(`[截图] ${targetUrl} | ${device} ${format} ${fullPage ? "整页" : "视口"}`);

  try {
    const browser = await env.BROWSER.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });

    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: scale,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    });

    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 35000 }).catch(() => {});
    await page.waitForTimeout(waitMs);

    // 等待图片加载
    try {
      await page.evaluate(() =>
        Promise.all(
          Array.from(document.images)
            .filter(i => !i.src.startsWith("data:"))
            .map(i => i.complete ? Promise.resolve() : new Promise(r => { i.onload = r; i.onerror = r; setTimeout(r, 5000); }))
        )
      );
    } catch (_) {}

    const type = format === "jpg" ? "jpeg" : format;
    const buffer = await page.screenshot({
      fullPage,
      type,
      quality: format === "png" ? undefined : Math.round(quality * 100),
      encoding: "binary"
    });

    await browser.close();

    const ct = format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    return new Response(buffer, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": ct,
        "Content-Length": String(buffer.byteLength)
      }
    });
  } catch (err) {
    console.error("[截图错误]", err.message);
    return new Response(JSON.stringify({
      error: "截图失败: " + err.message,
      tip: "检查网址是否可访问、网络是否正常"
    }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" }
    });
  }
};

// OPTIONS 预检
export const onRequestOptions = () => new Response(null, {
  status: 204,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  }
});
