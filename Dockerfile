
FROM node:18
RUN sed -i s/deb.debian.org/mirrors.aliyun.com/g /etc/apt/sources.list
RUN apt update && apt install -y cmake
WORKDIR /app
RUN npm config set registry https://registry.npm.taobao.org/
RUN npm config set @ttk:registry http://pc10.yff.me:8081/repository/yff/
RUN npm config set @yff:registry http://pc10.yff.me:8081/repository/yff/
RUN npm config set metrics-registry https://registry.npm.taobao.org/
COPY package*.json ./
RUN npm ci
COPY . ./
WORKDIR /app/packages/editor/
RUN npm exec sn build
CMD npm exec sn start
