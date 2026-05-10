FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3003
ENV NODE_ENV=production
CMD ["node_modules/.bin/tsx", "server/index.ts"]
