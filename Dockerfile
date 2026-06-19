# Minimal image for Glama introspection (stdio MCP server, zero runtime deps)
FROM node:20-slim
WORKDIR /app
COPY . .
# jp-pint-mcp is a zero-dependency stdio JSON-RPC MCP server
CMD ["node", "server.js"]
