FROM nginx:1.25-alpine

# Install openssl to generate x509 certs on startup
RUN apk add openssl

# Copy all configuraiton files
COPY rootfs/ /
