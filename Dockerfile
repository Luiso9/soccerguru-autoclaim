FROM mcr.microsoft.com/playwright:v1.53.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npx playwright install --with-deps
RUN npm ci

COPY . .

ENV NODE_ENV=production

CMD ["node", "index.js"]
