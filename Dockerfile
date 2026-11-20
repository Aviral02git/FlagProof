FROM mcr.microsoft.com/playwright:v1.65.1-jammy
WORKDIR /app
COPY package.json package-lock.json ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci
COPY . .
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node","src/server.mjs"]
