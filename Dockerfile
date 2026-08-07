FROM mcr.microsoft.com/playwright:v1.61.0-noble

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./

RUN npm ci --include=dev

COPY prisma ./prisma

RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]