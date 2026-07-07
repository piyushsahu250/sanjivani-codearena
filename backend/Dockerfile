FROM node:20-slim

# Toolchains needed by the judge for C, C++, Java and Python submissions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    default-jdk \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push --skip-generate && (npm run seed || true) && npm start"]
