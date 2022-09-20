#!/bin/sh

set -e

openssl req -new -newkey rsa:4096 -x509 -sha256 -days 365 -nodes \
    -subj "/C=US/ST=Test/L=Test/O=Test/CN=localhost" \
    -out /etc/ssl/certs/dummy.crt \
    -keyout /etc/ssl/private/dummy.key
