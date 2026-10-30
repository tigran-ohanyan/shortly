FROM node:24-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public

ENV NODE_ENV=production PORT=3000 DB_PATH=/app/data/shortly.db
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "src/server.js"]
