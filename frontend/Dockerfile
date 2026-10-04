# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy the built application from the previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy a custom Nginx configuration to handle routing and API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (inside container)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
