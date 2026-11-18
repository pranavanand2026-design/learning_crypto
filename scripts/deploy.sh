#!/usr/bin/env bash
# Deploy CryptoDash to Google Cloud Run and print its URL.
#
#   ./scripts/deploy.sh [PROJECT_ID]
#
# Optional environment:
#   REGION         Cloud Run region (default us-central1)
#   GOOGLE_CLIENT_ID  OAuth web client id to enable "Sign in with Google".
#   DATABASE_URL   Postgres URL to keep data between restarts. Without it the
#                  app uses SQLite inside the container, which resets whenever
#                  Cloud Run replaces the instance (fine for a demo).
set -euo pipefail

PROJECT="${1:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
SERVICE="cryptodash"
SECRET="cryptodash-django-secret-key"

if [[ -z "$PROJECT" ]]; then
  echo "Pass a project id: ./scripts/deploy.sh my-project-id" >&2
  exit 1
fi
cd "$(dirname "$0")/.."
echo "Deploying $SERVICE to $PROJECT ($REGION)"
gcloud config set project "$PROJECT" >/dev/null

echo "Enabling services (first run only takes a minute)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com >/dev/null

# A stable secret key, kept in Secret Manager so redeploys don't log everyone out.
if ! gcloud secrets describe "$SECRET" >/dev/null 2>&1; then
  python3 -c 'import secrets; print(secrets.token_urlsafe(50), end="")' |
    gcloud secrets create "$SECRET" --replication-policy=automatic --data-file=- >/dev/null
  echo "Created secret $SECRET"
fi
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding "$SECRET" \
  --member="serviceAccount:${RUNTIME_SA}" --role=roles/secretmanager.secretAccessor >/dev/null

SECRETS="DJANGO_SECRET_KEY=${SECRET}:latest"
if [[ -n "${DATABASE_URL:-}" ]]; then
  if ! gcloud secrets describe cryptodash-database-url >/dev/null 2>&1; then
    printf '%s' "$DATABASE_URL" | gcloud secrets create cryptodash-database-url --data-file=- >/dev/null
  else
    printf '%s' "$DATABASE_URL" | gcloud secrets versions add cryptodash-database-url --data-file=- >/dev/null
  fi
  gcloud secrets add-iam-policy-binding cryptodash-database-url \
    --member="serviceAccount:${RUNTIME_SA}" --role=roles/secretmanager.secretAccessor >/dev/null
  SECRETS="${SECRETS},DATABASE_URL=cryptodash-database-url:latest"
  MAX_INSTANCES=3
else
  # SQLite lives inside one container, so keep a single instance.
  MAX_INSTANCES=1
fi

echo "Building and deploying (about 4 minutes)"
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 512Mi \
  --max-instances "$MAX_INSTANCES" \
  --set-secrets "$SECRETS" \
  --set-env-vars "^@^DEBUG=False@ALLOWED_HOSTS=.run.app@CSRF_TRUSTED_ORIGINS=https://*.run.app@CORS_ALLOWED_ORIGINS=@GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}" \
  --quiet

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo
echo "CryptoDash is live: $URL"
