# Step 1: build the static site from content/ and public/ into dist/ (no dependencies).
FROM node:22-alpine AS build
WORKDIR /app
COPY build.mjs ./
COPY content/ content/
COPY public/ public/
# Set CMS_URL as a build variable in Coolify to include content from Directus.
ARG CMS_URL=""
ENV CMS_URL=$CMS_URL
RUN node build.mjs

# Step 2: serve it with unprivileged nginx (runs as non-root, listens on 8080).
FROM nginxinc/nginx-unprivileged:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
