FROM nginx:1.25-alpine

# Generate the self-signed x509 certificate at build time. Generating it in the
# entrypoint delayed nginx from listening for several seconds on loaded CI
# runners, which made the first TLS connection attempts fail with ECONNRESET.
RUN apk add --no-cache openssl \
    && openssl req -new -newkey rsa:2048 -x509 -sha256 -days 3650 -nodes \
        -subj "/C=US/ST=Test/L=Test/O=Test/CN=localhost" \
        -out /etc/ssl/certs/dummy.crt \
        -keyout /etc/ssl/private/dummy.key

# Copy all configuraiton files
COPY rootfs/ /
