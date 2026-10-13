# FixMyCity — Civic Issue Reporting Platform

FixMyCity is a full-stack civic issue reporting and tracking application. It helps citizens report local problems—such as potholes, broken streetlights, garbage accumulation, water leakage, and damaged public infrastructure—and follow their progress. Administrators have a separate workspace to review platform-wide reports, manage issue status and priority, assign departments, and view registered users.

> **Project status:** Educational portfolio project. Review the security checklist before deploying it or using it with real citizens or sensitive information.

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Requirements](#requirements)
- [Run locally on Windows](#run-locally-on-windows-powershell)
- [Roles and dashboards](#roles-and-dashboards)
- [Promote a registered user to admin](#promote-a-registered-user-to-admin)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Issue lifecycle](#issue-lifecycle)
- [Map and image uploads](#map-and-image-uploads)
- [Troubleshooting](#troubleshooting)
- [Security checklist](#security-checklist)
- [Portfolio description](#portfolio-description)

## Features

### Citizen dashboard
- Register and sign in using an email address and password.
- Submit a civic issue with a title, description, category, and location.
- Attach an optional JPG, PNG, or WEBP image (maximum 5 MB).
- View and track personal reports and their status history.
- Search and filter issues using available report fields.
- View issue details and progress.
- Browse the public community feed, which should contain only limited, non-sensitive report information.

### Administrator dashboard
- Use a dedicated admin workspace separate from the citizen dashboard.
- View platform-wide issue statistics.
- View reports submitted by all users.
- Review issue details and update status and priority.
- Assign reports to departments.
- View registered users through a protected admin API.
- Review user information returned by the backend, including report counts if that field is implemented in the current version.
- Access administrative controls only when authenticated with an admin account.

### Maps and media
- Select a report location using the map, or use browser location when permission is granted.
- Store the selected location with the report and view it in issue details.
- Upload supported image formats for a report.

### Engineering
- React + Vite frontend.
- FastAPI REST API.
- SQLAlchemy ORM.
- SQLite for simple local development; PostgreSQL can be configured through `DATABASE_URL` if supported by the current backend configuration.
- JWT bearer-token authentication and password hashing.
- Role-based access control for protected API endpoints.
- Responsive interface for desktop and mobile.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, JavaScript |
| UI | CSS, Lucide icons |
| HTTP client | Axios |
| Backend | Python, FastAPI |
| ORM | SQLAlchemy |
| Database | SQLite by default; PostgreSQL configurable if configured |
| Authentication | JWT bearer tokens and password hashing |
| API documentation | FastAPI Swagger UI |
| Maps | Leaflet, React Leaflet, OpenStreetMap tiles |

## Project structure

```text
FixMyCity/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env                  # Local configuration; do not commit secrets
│   ├── fixmycity.db          # SQLite database, if SQLite is configured
│   └── uploads/              # Uploaded images; created/used at runtime
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── .env                  # Optional frontend environment configuration
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       ├── main.jsx
│       └── styles.css
├── .gitignore
└── README.md
```

The exact files may vary slightly by version. Do not commit `.env`, database files containing real data, uploaded user files, or secrets.

## Requirements

Install the following before running the project:

1. Python 3.11 or newer (check with `python --version`).
2. Node.js 20 or newer (LTS recommended; check with `node --version`).
3. npm (check with `npm --version`).
4. Git is optional.

The default SQLite setup does not require a separate database server. Docker is not required for local development.

## Run locally on Windows (PowerShell)

The examples below use `F:\projects\FixMyCity`. Replace this path with your own project location.

### 1. Open the project

```powershell
cd F:\projects\FixMyCity
```

### 2. Set up the backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell blocks virtual-environment activation, run this in the current terminal and activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Create or edit `backend\.env` using the variables expected by your current `main.py` and settings implementation. At minimum, set a unique, long random `SECRET_KEY` if the backend uses one. Do not use a sample secret in a deployed application. If your repository includes an `.env.example`, you can copy it to `.env`; otherwise create `.env` according to the settings used by your code.

Start the backend from the `backend` directory:

```powershell
uvicorn main:app --reload
```

Keep this terminal open. Common local addresses are:

- API root: `http://127.0.0.1:8000/`
- Health check (if enabled): `http://127.0.0.1:8000/api/health`
- Swagger UI (if enabled): `http://127.0.0.1:8000/docs`

On startup, the application may create database tables and seed initial department records, depending on the current backend code.

### 3. Set up and start the frontend

Open a second PowerShell terminal:

```powershell
cd F:\projects\FixMyCity\frontend
npm install
npm run dev
```

Open the local URL printed by Vite, commonly `http://localhost:5173`. Keep both terminals running while using the application.

If your frontend uses `VITE_API_URL`, make sure it points to the backend API base URL expected by `frontend/src/api.js`. Restart Vite after changing frontend environment variables.

### 4. Create a citizen account

1. Open the frontend in your browser.
2. Choose the sign-in or account-creation option.
3. Register with a name, email, and password.
4. Sign in.
5. Submit a test issue and confirm it appears in your citizen dashboard.

Public registration should assign the `citizen` role automatically. A registration form must not allow a user to choose their own role.

## Roles and dashboards

FixMyCity separates the user experience by role.

| Capability | Citizen | Admin |
|---|---:|---:|
| View personal reports | Yes | Yes |
| Submit a report | Yes | If enabled in the UI/API |
| Browse public community reports | Yes | Yes |
| View reports from all users | No | Yes |
| Change issue status and priority | No | Yes |
| Assign issues to departments | No | Yes |
| View registered users | No | Yes |
| View platform-wide statistics | No | Yes |
| See the API documentation link in the UI | Hidden for normal citizens | Visible only if the frontend condition enables it |

The frontend can hide navigation links and buttons according to the logged-in role. This is a usability feature, not a security boundary. The backend must independently check authorization for every admin-only endpoint.

## Promote a registered user to admin

The normal registration flow should create citizens. To promote an existing account, use the trusted local-development command if the `promote-admin` CLI code is present in your current `backend/main.py`.

### 1. Register the user first

Create the account through the application with the email address you want to promote.

### 2. Stop the backend

In the terminal running Uvicorn, press `Ctrl+C`.

### 3. Run the promotion command

Open PowerShell in the `backend` directory and activate the backend virtual environment if needed:

```powershell
cd F:\projects\FixMyCity\backend
.\.venv\Scripts\Activate.ps1
python main.py promote-admin user@example.com
```

Replace `user@example.com` with the registered user's email address.

Possible output:

```text
Success! user@example.com is now an admin.
```

If the email does not match an account in the database, the command should report that the user was not found. If the command prints no result, check that the CLI block is present at the bottom of `main.py` and that the database path is the same one used by Uvicorn.

### 4. Restart and sign in again

```powershell
uvicorn main:app --reload
```

Sign out of the frontend and sign in again with the promoted account so the frontend receives the updated role.

### Important security notes

- Run the promotion command only in a trusted local or deployment environment.
- Never expose an unauthenticated public endpoint that lets a user promote themselves.
- Do not accept `role: "admin"` from public registration requests.
- For production, use a controlled, audited administrator provisioning process and protect access to the host and database.
- Keep a backup before changing roles in a database containing important data.

## Configuration

Configuration names depend on the settings used by the current backend. Review `backend/main.py` and its settings class before adding or changing variables.

Common configuration items may include:

| Setting | Purpose |
|---|---|
| `SECRET_KEY` | Secret used for signing tokens or other security-sensitive operations |
| `DATABASE_URL` | Database connection string, if supported by the configured backend |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime, if supported |
| `FRONTEND_ORIGIN` | Allowed frontend origin for CORS, if used |
| `UPLOAD_DIR` | Directory for uploaded images, if configurable |
| `VITE_API_URL` | Frontend API base URL, if used by `frontend/src/api.js` |

Never publish real passwords, signing keys, access tokens, or private environment values in this README or in source control.

### Optional PostgreSQL setup

Use PostgreSQL only if the backend is configured to support it:

1. Install PostgreSQL and create a database.
2. Install the appropriate Python database driver required by the SQLAlchemy connection URL.
3. Set `DATABASE_URL` to the correct connection string.
4. Restart the backend and verify that it connects to the intended database.

Do not change database engines while reusing an existing SQLite database without planning a data migration. For a production application, use database migrations rather than relying only on automatic table creation.

## API reference

The base local API URL is commonly `http://127.0.0.1:8000`. Exact endpoints depend on the current `backend/main.py`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | Public, if enabled | Health check |
| `GET` | `/api/meta` | Public, if enabled | Categories, statuses, and priorities |
| `POST` | `/api/auth/register` | Public | Register a citizen |
| `POST` | `/api/auth/login` | Public | Sign in and receive an authentication token |
| `GET` | `/api/auth/me` | Authenticated | Current user profile |
| `GET` | `/api/departments` | Depends on backend configuration | List departments |
| `POST` | `/api/departments` | Admin | Create a department, if implemented |
| `POST` | `/api/issues` | Authenticated | Create an issue |
| `GET` | `/api/issues` | Authenticated | List issues; admins may receive all issues |
| `GET` | `/api/issues/public` | Public, if enabled | Public issue feed |
| `GET` | `/api/issues/{id}` | Owner or admin | Issue details and history |
| `PATCH` | `/api/issues/{id}` | Admin | Update status, priority, or department |
| `POST` | `/api/issues/{id}/image` | Owner or admin | Upload an issue image |
| `GET` | `/api/admin/stats` | Admin | Platform summary statistics |
| `GET` | `/api/admin/users` | Admin | List registered users |

Use the running backend's Swagger UI, when enabled, to confirm the exact request schemas and current endpoints. Hiding the documentation link in the frontend does not disable direct access to `/docs`. If the docs page must not be available, configure FastAPI to disable it or restrict it separately.

### Typical API workflow

1. Register through `POST /api/auth/register`.
2. Sign in through `POST /api/auth/login`.
3. Use the returned token for authenticated requests as a bearer token.
4. Submit an issue through `POST /api/issues`.
5. Retrieve permitted issues through `GET /api/issues`.
6. Use the local admin-promotion procedure for a development account.
7. As an admin, review all issues and update permitted fields.

### Example issue payload

Adapt field names to the schema shown by your running API:

```json
{
  "title": "Large pothole near the bus stop",
  "description": "A deep pothole is present near the main bus stop.",
  "category": "Roads & Potholes",
  "location": "Main Road, near Central Bus Stop"
}
```

### Example admin update payload

```json
{
  "status": "In Progress",
  "priority": "High",
  "department_id": 1,
  "comment": "Assigned to the roads maintenance team."
}
```

## Issue lifecycle

The statuses supported by the current starter may include:

- `Submitted`
- `Under Review`
- `In Progress`
- `Resolved`
- `Rejected`

Priorities may include `Low`, `Medium`, `High`, and `Urgent`. Confirm the accepted values in `backend/main.py` or the API metadata endpoint. Newly created issues commonly begin in `Submitted` status with `Medium` priority. Administrative changes should be recorded in issue history when that behavior is enabled.

## Map and image uploads

### Map locations
The report form uses a map picker powered by Leaflet/React Leaflet and OpenStreetMap tiles, if those packages and components are enabled in the current frontend. Users may choose a point manually or use browser geolocation after granting permission. Browser geolocation requires permission and a secure context; `localhost` is permitted for local development. If permission is denied, manual map selection can still be used when available.

OpenStreetMap tiles require an internet connection. Avoid exposing a citizen's precise home address or sensitive location in public issue responses.

### Image uploads
The current backend implementation may accept JPEG, PNG, and WEBP images with a maximum size of 5 MB. Confirm the rules in the upload endpoint before changing them.

For production, validate file contents instead of trusting only the browser-provided MIME type, use safe generated filenames, enforce size limits, and consider private object storage or malware scanning.

## Troubleshooting

### `python` is not recognized
Install Python and ensure it is available on `PATH`. Reopen PowerShell after installation.

### `npm` is not recognized
Install Node.js LTS and reopen PowerShell.

### PowerShell blocks virtual-environment activation
Run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### `ModuleNotFoundError`
Confirm the backend virtual environment is active, then run:

```powershell
pip install -r requirements.txt
```

### Frontend shows a network error
- Confirm the backend is running.
- Open the health endpoint if it exists.
- Check the API URL configured in `frontend/src/api.js` or `frontend/.env`.
- Check the browser console and backend terminal for errors.
- Verify CORS configuration if frontend and backend origins differ.

### Port 8000 is already in use
Run the backend on another port:

```powershell
uvicorn main:app --reload --port 8001
```

If the frontend uses `VITE_API_URL`, update it to the API URL expected by your app and restart Vite.

### Admin promotion prints no output
- Confirm the CLI function and `if __name__ == "__main__":` block exist in `backend/main.py`.
- Run the command from the `backend` directory.
- Make sure the registered email exists in the same database the application uses.
- Confirm `func` is imported from SQLAlchemy if the function uses `func.lower(...)`.

### Admin dashboard does not appear after promotion
Sign out and sign back in to refresh the frontend's user profile. Confirm the database role is `admin` and that admin-only API requests are authorized by the backend.

### Resetting the local database
Stop the backend and back up any data you want to keep. Deleting the SQLite database file removes local accounts, issues, and history. Only do this when you intentionally want a clean development database.

## Security checklist

Before deploying beyond local development:

- Use a unique, high-entropy secret and keep it outside source control.
- Use HTTPS and secure deployment settings.
- Enforce authorization in the backend, not only in the UI.
- Restrict administrator provisioning and audit administrative actions.
- Add database migrations, backups, and a recovery plan.
- Add rate limiting and abuse/spam controls.
- Validate uploaded file contents and enforce size limits.
- Review CORS against the exact deployed frontend origin.
- Avoid exposing private user information or precise sensitive locations in public responses.
- Add automated tests for authentication, role permissions, and issue workflows.
- Add account recovery, email verification, and privacy/retention policies where appropriate.
- Use production-grade database and hosting configuration.

## Suggested future improvements

1. Add automated tests for citizen/admin access boundaries.
2. Add staff assignment and richer department management.
3. Add notifications when issue status changes.
4. Add pagination and search for large admin user/issue tables.
5. Add audit logs for admin actions.
6. Add deployment instructions and screenshots.
7. Add a proper open-source license if publishing publicly.

## Portfolio description

**FixMyCity — Civic Issue Reporting Platform**

Built a responsive civic issue reporting platform using React, FastAPI, and SQLAlchemy. Implemented JWT authentication, role-based authorization, report submission with image uploads and map locations, issue status and priority management, department assignment, a public issue feed, and separate citizen and administrator dashboards with platform-wide issue and user visibility.

## License

This repository does not define a formal open-source license unless a separate license file is included. Add a license file before publishing the project with explicit reuse terms.
