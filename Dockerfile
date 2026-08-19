FROM mcr.microsoft.com/playwright:v1.61.0-noble

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PDF_BROWSER=playwright
ENV DISPLAY=:99
ENV PLAYWRIGHT_HEADLESS=false
ENV PLAYWRIGHT_DEBUG=false

COPY package*.json ./

RUN npm ci --include=dev

COPY prisma ./prisma

RUN npx prisma generate

COPY . .

RUN npm run build

COPY docker/start.sh /app/start.sh

RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["/app/start.sh"]