FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Create data directory
RUN mkdir -p data

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]