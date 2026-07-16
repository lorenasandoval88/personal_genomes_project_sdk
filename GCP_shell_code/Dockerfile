FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "--expose-gc", "--max-old-space-size=28672", "index.js"]

