FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY server.js ./

ENV PORT=3000

CMD ["node", "server.js"]
