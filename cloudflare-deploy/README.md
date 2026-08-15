# ☁️ Cloudflare 常驻云端长截图

基于 **Cloudflare Browser Rendering** 的常驻云端长截图服务。部署在 Cloudflare Pages + Workers 上，绑定 `.dev` 域名，全球 CDN 加速，无 2000 分钟限制。

## 架构

```
用户浏览器 → https://你的域名.dev (Cloudflare CDN)
  → index.html (Pages 静态前端)
  → POST /api/screenshot (Pages Function)
    → env.BROWSER.launch() (Cloudflare Browser Rendering / Puppeteer API)
    → Chromium 无头浏览器截取目标网址
    → 返回图片二进制
```

## 文件说明

| 文件 | 作用 |
|------|------|
| `wrangler.toml` | Cloudflare 配置：Browser Rendering 绑定 |
| `index.html` | 前端界面（同源调用 `/api/screenshot`） |
| `functions/api/screenshot.js` | 截图 API（Browser Rendering） |
| `functions/api/health.js` | 健康检查 |

## 部署步骤（在 Cloudflare Dashboard 操作）

### 1. 创建 Pages 项目
1. 打开 Cloudflare Dashboard → **Workers 和 Pages**
2. 点 **Create** → **Pages** → **Connect to Git**
3. 选择仓库 `liaochaoyuan/longshot-cloud`
4. 构建设置：
   - **Framework preset**: None
   - **Build command**: 留空
   - **Build output directory**: `cloudflare-deploy`
   - **Root directory**: `cloudflare-deploy`
5. 点 **Save and Deploy**

### 2. 绑定自定义域名
1. 在项目 Settings → **Custom domains**
2. 添加你的 `.dev` 域名
3. DNS 自动配置（CNAME + SSL）

### 3. 添加 Browser Rendering 绑定
1. 项目 Settings → **Functions** → **Browser Rendering**
2. 启用 Browser Rendering（免费额度内）
3. 绑定名设为 `BROWSER`

## 使用

打开 `https://你的域名.dev` → 输入网址 → 选格式/设备 → 点「生成截图」→ 约 5~15 秒出图。

## 免费额度

- Cloudflare Pages: 500 次/天请求（足够个人使用）
- Browser Rendering: 有免费额度，超出后按量计费
- 无 GitHub Actions 的 2000 分钟/月限制
