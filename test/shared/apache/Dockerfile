FROM httpd:2.4-alpine

RUN apk add --no-cache gettext

COPY rootfs/ /

RUN chmod +x /docker-entrypoint.sh /docker-entrypoint.d/*.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["httpd-foreground"]
