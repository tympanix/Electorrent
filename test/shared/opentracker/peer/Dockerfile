FROM alpine:latest

RUN apk add --no-cache aria2 bash coreutils mktorrent
COPY ./rootfs /
RUN chmod +x /usr/local/bin/*
ENTRYPOINT ["/usr/local/bin/gen-torrent"]
