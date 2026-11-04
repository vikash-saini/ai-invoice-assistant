# ==========================================
# Stage 1: Build React application
# ==========================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY . .

# Configure API URL for production
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build React application
RUN npm run build


# ==========================================
# Stage 2: Nginx production server
# ==========================================
FROM nginx:alpine AS production

# Remove default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Add our custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production frontend build
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]