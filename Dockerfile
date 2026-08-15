# LongShot 常驻版镜像
FROM node:20-slim

WORKDIR /app

# 系统依赖（Playwright Chromium 需要的库）
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg ca-certificates && rm -rf /var/lib/apt/lists/*

# 安装 npm 依赖
COPY package.json ./
RUN npm install --omit=dev

# 安装 Chromium 浏览器及其系统依赖
RUN npx playwright install --with-deps chromium

# 拷贝应用代码
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
