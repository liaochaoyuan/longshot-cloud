export const onRequestGet = () => Response.json({
  status: "ok",
  engine: "Cloudflare Browser Rendering (Puppeteer)",
  platform: "Cloudflare Pages + Workers",
  formats: ["png", "jpg", "webp"],
  devices: ["desktop", "tablet", "mobile", "custom"]
});
