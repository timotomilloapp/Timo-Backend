FROM node:22-slim AS base

# Install OpenSSL (required by Prisma)
RUN apt-get update -y && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files and lockfile
COPY package.json pnpm-lock.yaml ./

# Copy Prisma schema before installing dependencies
# because "pnpm install" triggers "prisma generate" in postinstall
COPY prisma ./prisma
COPY prisma.config.ts ./

# Prisma generate during build doesn't need a real DB connection, 
# but prisma.config.ts requires DIRECT_DATABASE_URL to be defined.
# We set a dummy URL just for the build phase.
ENV DIRECT_DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Install all dependencies (ignoring scripts to bypass pnpm 10 strict policies)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Generate Prisma Client manually since postinstall is ignored
RUN npx prisma generate

# Copy everything else
COPY . .

# Build NestJS app
RUN pnpm run build

# Start the application
CMD [ "sh", "-c", "npx prisma migrate deploy && node dist/main" ]
