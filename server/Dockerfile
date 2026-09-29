FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build && cp src/schema.sql dist/schema.sql
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
