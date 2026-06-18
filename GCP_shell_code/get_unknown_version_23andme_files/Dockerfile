FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index_unknwn_version.mjs"]
