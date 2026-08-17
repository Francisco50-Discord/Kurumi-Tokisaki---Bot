FROM node:20

RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    webp \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json .
RUN npm install --network-timeout=100000

COPY . .

EXPOSE 3000
# El proveedor puede sustituir PORT (por ejemplo, 7860 en Hugging Face).

CMD ["npm", "start"]
