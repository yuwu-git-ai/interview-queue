# syntax=docker/dockerfile:1
# ================= Build stage：装全部依赖 + 编译前端到 dist =================
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
# 阿里云 ECS 上加速（npmmirror）
RUN npm config set registry https://registry.npmmirror.com
# 全量 ci：tailwindcss(core) 在 devDeps，vite 编译 CSS 需要
RUN npm ci

COPY . .
# build = vite build → dist/
RUN npm run build

# ================= Production stage：只带前端产物 + TS 源 + node_modules =================
FROM node:22-slim

ENV NODE_ENV=production \
    PORT=3002 \
    TZ=Asia/Shanghai \
    STATE_FILE=/app/data/state.json \
    STATIC_DIR=/app/dist

WORKDIR /app
COPY --from=build /app/dist ./dist
# 生产用 tsx 直接跑 TS 源，故 server/ 与 shared/ 必须拷进镜像
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
# node_modules 从 build 阶段整拷（零二次联网，确定性；含 devDeps 但不执行）
COPY --from=build /app/node_modules ./node_modules

RUN mkdir -p /app/data
EXPOSE 3002
CMD ["node_modules/.bin/tsx", "server/index.ts"]
