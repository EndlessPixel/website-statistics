# ---- 构建阶段：安装依赖 ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---- 运行阶段：最小镜像 ----
FROM node:20-alpine
WORKDIR /app

# 系统层安全与瘦身：不创建默认 node 用户（我们会自己建），清掉多余包
RUN addgroup -S appuser && adduser -S appuser -G appuser \
    && rm -rf /var/cache/apk/*

# 拷贝构建产物与源码
COPY --from=build /app/node_modules ./node_modules
COPY server.js server.json ./
COPY public ./public

# 运行时配置：监听端口、数据目录（SQLite + keys.json 持久化）
ENV NODE_ENV=production \
    PORT=8000
EXPOSE 8000

# 持久化卷：数据库与密钥放在同一目录，方便一键备份
VOLUME ["/app/data"]

# 给运行用户权限并切换到非 root
RUN chown -R appuser:appuser /app
USER appuser

HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:8000/login',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node","server.js"]
