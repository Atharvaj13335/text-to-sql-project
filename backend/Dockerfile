# Production Dockerfile for Financial Text-to-SQL Node.js Backend
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "server.js"]
