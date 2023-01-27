FROM node:18
RUN sed -i s/deb.debian.org/mirrors.aliyun.com/g /etc/apt/sources.list
RUN apt update && apt install -y cmake
WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com/
COPY package*.json ./
RUN NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node/ npm ci -d
COPY packages ./packages
RUN npm run build
WORKDIR /app/packages/editor/
CMD npm exec sn start
ENV STORE_REDIS_HOST pc10.yff.me
