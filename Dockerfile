# Builds the app by pulling the repo straight from GitHub, so the image
# always contains the code from the remote — no local checkout needed.
FROM node:22-alpine

RUN apk add --no-cache git

ARG REPO_URL=https://github.com/workuseonly-dev/bharat-sutra.git
ARG BRANCH=main

WORKDIR /app
RUN git clone --depth 1 --branch ${BRANCH} ${REPO_URL} . \
 && npm ci --omit=dev \
 && npm cache clean --force

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV PORT=8080 DATA_DIR=/data UPDATE_ON_START=0
VOLUME /data
EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
