FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js openapi.json merge-observations.js ./

ENV PORT=3000
EXPOSE 3000

CMD ["node", "index.js"]
