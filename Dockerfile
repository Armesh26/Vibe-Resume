# Build stage for frontend
FROM node:18-slim AS frontend-builder

WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
# Build outputs to /app/static/react based on vite.config.js
RUN cd frontend && npm run build

# Production stage
FROM python:3.11-slim

# Install LaTeX and required packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-latex-recommended \
    texlive-font-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy backend code
COPY app.py .
COPY templates/ ./templates/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/static/react ./static

# Create necessary directories
RUN mkdir -p chat_histories

# Expose port (Render uses 10000 by default)
EXPOSE 10000

# Run with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:10000", "--timeout", "120", "--workers", "2", "app:app"]
