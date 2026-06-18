FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index_v3_v4_v5.mjs"]
