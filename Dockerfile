FROM ubuntu:18.04

RUN apt -y update
RUN apt -y install curl git wget make build-essential libusb-1.0-0-dev bc
RUN apt install -y software-properties-common && add-apt-repository ppa:deadsnakes/ppa && apt update && apt install -y python3.8
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3 1
SHELL ["/bin/bash", "-c"]
RUN curl -sL https://deb.nodesource.com/setup_16.x | bash
RUN apt -y install nodejs
RUN wget https://github.com/ethereum/solidity/releases/download/v0.8.13/solc-static-linux -O /usr/bin/solc && chmod +x /usr/bin/solc

RUN mkdir -p /usr/app
WORKDIR /usr/app

# First add deps
RUN npm install -g yarn

COPY package.json /usr/app/package.json
COPY yarn.lock /usr/app/yarn.lock

RUN yarn install

ADD . /usr/app

CMD while :; do sleep 2073600; done
