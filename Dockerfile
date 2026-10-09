FROM node:22-alpine
WORKDIR /app
# Sin dependencias externas: no hace falta npm install.
COPY package.json ./
COPY server ./server
COPY lib ./lib
COPY public ./public
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 3000
USER node
CMD ["node", "server/local.mjs"]
