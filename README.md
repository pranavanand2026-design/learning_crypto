# 📊 CryptoDash

**CryptoDash** is a simplified cryptocurrency learning platform built for beginners who want to practice trading and portfolio management without financial risk. 
 
This project was developed as part of **ELEC3609/ELEC9609 — Systems and Database Design** at the University of Sydney.  

---

## 🚀 Project Purpose
Most cryptocurrency apps are cluttered, risky, and difficult for beginners.  
CryptoDash provides a **safe, beginner-friendly environment** to:
- Experiment with trading using simulated portfolios.
- Track personalized watchlists.
- View simplified analytics of crypto markets.
- Learn without risking real money.

---

## ✨ Core Features
Based on our **functional requirements**, CryptoDash supports:

1. **User Authentication & Profile Management**  
   - Register, login, reset password, and edit profile details.  
   - Guest access for browsing without signing up.

2. **Watchlist Management**  
   - Add/remove coins.  
   - Real-time updates every 10 minutes from cached APIs.  
   - Sorting, searching, and filtering.  

3. **Portfolio Tracking**  
   - Create one simulated portfolio per user.  
   - View valuation reports and trends.  

4. **Simulation Management**  
   - Create, edit, and delete trading simulations.  
   - Track profit/loss and performance metrics.  

5. **Market Analytics**  
   - Top 100 crypto list with pagination.  
   - Coin detail pages with historical charts.  
   - Comparison and time-based returns.  

---

## 🛠️ Tech Stack
- **Frontend**: React (JS, CSS, HTML)  
- **Backend**: Django (Python), RESTful APIs, AJAX  
- **Database**: PostgreSQL (psql)  
- **Testing**: PyTest (unit tests), Postman (API testing),  
  E2E/integration, frontend smoke tests  

---

## 👥 Team & Roles
### Development Roles
- **Backend**: Muhammad Abdullah, Suryansh Shekhawat  
- **Frontend**: Ellis Mon, Pranav Anand, Elvern Keefe Chen  
- **Database**: Ellis Mon, Muhammad Abdullah  
- **Testing**: Suryansh Shekhawat, Elvern Keefe Chen  

### Agile Roles
- **Scrum Master**: Pranav Anand  
- **Developers**: Everyone  
- **Testers**: Everyone  

---

## 📧 Authors
- **Suryansh Shekhawat** (sshe0771)  
- **Elvern Keefe Chen** (eche8129)  
- **Muhammad Abdullah** (mabd8755)  
- **Ellis Mon** (emon0711)  
- **Pranav Anand** (pana0377)  

---

## Environment Setup
Before running the frontend, create a `.env.local` file in `web_app/frontend`.
At minimum set `VITE_API_BASE_URL`; optional overrides are shown below:

```
VITE_API_BASE_URL=http://localhost:8000/api
VITE_RECAPTCHA_SITE_KEY=6Ldu9vMrAAAAABrORQFSF9nsVNiJhxpoR2Jh4q49
```

The backend reads Google reCAPTCHA credentials from environment variables as well:

```
RECAPTCHA_SITE_KEY=6Ldu9vMrAAAAABrORQFSF9nsVNiJhxpoR2Jh4q49
RECAPTCHA_PROJECT_ID=crypto-dash-476008
RECAPTCHA_API_KEY=<google-cloud-api-key>
RECAPTCHA_MIN_SCORE=0.3
```

Default values matching the keys above are baked into `config/settings.py`, so teammates
can clone and run without extra setup. Define your own values to override them in other
environments.

With these defaults the login form uses reCAPTCHA Enterprise (score-based) via the Assessments API. If you
later swap to a challenge/checkbox experience, generate the appropriate key type in Google Cloud and update
the environment variables above—be sure to add your local development domains (`localhost`, `127.0.0.1`, etc.).

## Quick Start (Local Dev)

- Prereqs: Python 3.11+ (3.12 OK), Node 18+.

1) Backend
- Create venv and install deps (uses psycopg2-binary; Postgres not required for dev):
- macOS/Linux
  - `python3 -m venv venv`
  - `source venv/bin/activate`
  - `python -m pip install -U pip`
  - `python -m pip install -r requirements.txt`
- Windows (PowerShell)
  - `py -m venv venv`
  - `venv\Scripts\Activate.ps1`
  - `python -m pip install -U pip`
  - `python -m pip install -r requirements.txt`

- Apply migrations and run server:
  - `python manage.py migrate`
  - `python manage.py runserver`

2) Frontend
- `cd web_app/frontend`
- `npm install`
- `cp .env.local.example .env.local` (or ensure `VITE_API_BASE_URL=http://localhost:8000/api`)
- `npm run dev`

The app uses relative API calls. During dev, set `VITE_API_BASE_URL` to `http://localhost:8000/api` so the Vite dev server can talk to Django.

## What’s Fixed
- Watchlist add/remove: creates the FK `Coin` on add to avoid 403/constraint errors; uses CSRF-safe auth for POST/DELETE.
- Portfolio buy/sell: per-user endpoints at `/api/portfolio/` and `/api/portfolio/sell/` with proper holding updates and transaction logging.
- Portfolio chart: now shows unrealised P/L and the series is normalised to start at 0 for the selected period, so it reflects movement (delta) over time.

## Common Issues
- “No module named 'django'” on `manage.py` commands
  - Cause: `pip install -r requirements.txt` aborted (e.g. building `psycopg2`).
  - Fix: this repo uses `psycopg2-binary` for dev. Re-run the install commands above in an activated venv and then `python manage.py migrate`.

- “pg_config not found” during pip install
  - You’re likely installing `psycopg2` instead of `psycopg2-binary`. Ensure you’re using this repo’s `requirements.txt`.

- Accidentally committed `venv/` or build artefacts
  - `.gitignore` includes `venv/`, `.venv/`, `node_modules/`, and `dist/`. If already committed, remove from git history:
    - `git rm -r --cached venv node_modules dist`
    - `git commit -m "chore: stop tracking build/venv"`

## Git Workflow (suggested)
- Create a branch: `git checkout -b fix/portfolio-watchlist-created-at`
- Make changes, then: `git add -A && git commit -m "Fix portfolio/watchlist + chart normalisation"`
- Push: `git push -u origin fix/portfolio-watchlist-created-at`
- Open a PR; if you’re behind `main`, run: `git fetch origin && git rebase origin/main` (resolve conflicts), then push with `--force-with-lease`.
