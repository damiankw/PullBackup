# Stage 1: Build React frontend
FROM node:18-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Python backend with embedded frontend
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    rsync \
    openssh-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Embed the compiled React app
COPY --from=frontend-build /frontend/build /app/frontend_build

RUN groupadd --gid 1000 pullbackup && \
    useradd --uid 1000 --gid 1000 --no-create-home pullbackup

RUN mkdir -p /app/data /app/data/ssh_keys /app/data/backups && \
    chmod 700 /app/data/ssh_keys && \
    chown -R pullbackup:pullbackup /app

USER pullbackup

EXPOSE 8000

CMD ["sh", "-c", "python init_db.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
