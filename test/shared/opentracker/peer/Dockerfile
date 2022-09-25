FROM debian:buster-slim

RUN apt-get update \
    && apt-get install ctorrent \
    && rm -rf /var/lib/apt/lists/*
COPY ./rootfs /
CMD ["/start"]
