# --- Build the React app ---
FROM node:22-alpine AS web
WORKDIR /web
COPY web_app/frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY web_app/frontend/ ./
RUN npm run build

# --- Django + gunicorn ---
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080
WORKDIR /app
COPY requirements.txt requirements-prod.txt ./
RUN pip install --no-cache-dir -r requirements-prod.txt
COPY . .
COPY --from=web /web/dist web_app/frontend/dist
RUN DJANGO_SECRET_KEY=collectstatic-only python manage.py collectstatic --noinput -v0
CMD python manage.py migrate --noinput && \
    exec gunicorn config.wsgi --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 60
