#!/bin/sh

set -e

envsubst '${APACHE_AUTH_PORT} ${PROXY_HOST} ${PROXY_PORT}' \
  < /usr/local/apache2/conf/templates/httpd.conf.template \
  > /usr/local/apache2/conf/httpd.conf
