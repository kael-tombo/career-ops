FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev 2>&1 || echo 'npm failed but continuing'
RUN echo 'npm done'
