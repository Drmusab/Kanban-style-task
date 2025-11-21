# Build the KanbanApp custom nodes for n8n
FROM node:18-alpine AS builder
WORKDIR /workdir

# Copy package metadata and source files
COPY package.json package-lock.json tsconfig.json ./
COPY index.ts ./
COPY credentials ./credentials
COPY nodes ./nodes
COPY types ./types

# Install dependencies, build the TypeScript sources and prune dev dependencies
RUN npm ci && \
    npm run build && \
    npm prune --omit=dev

# Final image based on the official n8n image
FROM n8nio/n8n:1.63.1

USER root

# Copy the built custom node into the location read by n8n
COPY --from=builder /workdir /custom/n8n-nodes-kanban-app

RUN mkdir -p /home/node/.n8n/custom \
    && cp -R /custom/n8n-nodes-kanban-app /home/node/.n8n/custom/n8n-nodes-kanban-app \
    && chown -R node:node /home/node/.n8n

ENV N8N_CUSTOM_EXTENSIONS="/home/node/.n8n/custom"

USER node
