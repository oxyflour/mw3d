FROM nvidia/opengl:1.2-glvnd-devel-ubuntu20.04
RUN sed -i s/archive.ubuntu.com/mirrors.aliyun.com/g /etc/apt/sources.list
RUN sed -i s/security.ubuntu.com/mirrors.aliyun.com/g /etc/apt/sources.list
RUN apt update
RUN DEBIAN_FRONTEND=noninteractive \
	apt-get install -yq --no-install-suggests --no-install-recommends \
		git libx11-xcb1 libxcb-dri3-0 libxtst6 libnss3 libatk-bridge2.0-0 libgtk-3-0 libxss1 libasound2 \
		xvfb nodejs npm
RUN apt-get clean

WORKDIR /root
RUN npm config set strict-ssl false
COPY ./ ./
RUN npm config set @yff:registry http://pc10.yff.me:8081/repository/yff/
RUN ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm i
CMD npx electron --no-sandbox dist/cli/index.js cast
