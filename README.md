# FixMyCity — Full-Stack Civic Issue Reporting Platform

FixMyCity is a portfolio-ready full-stack web application for reporting and tracking local civic issues such as potholes, broken streetlights, garbage accumulation, water leakage, and damaged public infrastructure.

Citizens can create accounts, submit reports with optional photographs, and follow status updates. Administrators can review all reports, set priority, assign departments, and update progress. A public community feed provides limited, non-sensitive report information.

> **Project status:** Educational portfolio starter. Review the security and deployment notes before using it with real users or sensitive information.

## Features

### Citizen
- Register and sign in using email and password.
- Create reports with title, description, category, and location.
- Optionally attach JPG, PNG, or WEBP images (maximum 5 MB).
- View personal reports and status history.
- Search and filter reports by status, title, category, or location.
- Open report details and view its progress timeline.

### Administrator
- Access all reports.
- Change issue status and priority.
- Assign reports to departments.
- View summary statistics.
- View registered users through a protected endpoint.

### Public
- Browse a public feed of reported issues.
- Search and filter public reports.
- Public responses omit reporter email and other account details.

### Engineering
- React + Vite frontend.
- FastAPI REST API with automatically generated Swagger documentation.
- SQLAlchemy ORM.
- SQLite by default for quick local setup; PostgreSQL is supported through `DATABASE_URL`.
- JWT bearer-token authentication and password hashing.
- Role-based authorization.
- Pagination for the authenticated issue list.
- Input validation and basic API error handling.
- Responsive UI for desktop and mobile.
- Pytest can be added for automated tests; see the improvements section.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, JavaScript |
| UI | CSS, Lucide icons |
| HTTP client | Axios |
| Backend | Python, FastAPI |
| ORM | SQLAlchemy 2 |
| Database | SQLite by default; PostgreSQL configurable |
| Authentication | JWT, Passlib password hashing |
| API docs | FastAPI Swagger UI |

## Folder structure

```text
FixMyCity/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   └── uploads/              # Created automatically at runtime
├── frontend/
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       ├── main.jsx
│       └── styles.css
├── .gitignore
└── README.md
```

## Requirements

Install these before running the project:

1. **Python 3.11 or newer** — check with `python --version`.
2. **Node.js 20 or newer (LTS recommended)** — check with `node --version`.
3. **npm** — check with `npm --version`.
4. Git is optional, but recommended.

The default setup uses SQLite, so you do **not** need to install PostgreSQL just to run the application locally.

---

# Run on Windows (PowerShell)

The instructions below are for Windows and do not require Docker.

## 1. Extract the ZIP

Extract `FixMyCity.zip` to a folder, for example:

```text
F:\projects\FixMyCity
```

Open PowerShell and change into the project directory:

```powershell
cd F:\projects\FixMyCity
```

Use the actual folder path where you extracted the ZIP.

## 2. Configure the backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

If PowerShell blocks activation, run this for the current PowerShell session, then activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Open `backend\.env` and replace `SECRET_KEY` with a long random secret before using the app beyond local experimentation. The example secret is for development only.

Start the API:

```powershell
uvicorn main:app --reload
```

Keep this terminal open. The backend should be available at:

- API root: http://127.0.0.1:8000/
- Health check: http://127.0.0.1:8000/api/health
- Swagger API documentation: http://127.0.0.1:8000/docs

On first startup, the app creates the SQLite database (`fixmycity.db`) and seeds example department records.

## 3. Start the React frontend

Open a **second** PowerShell terminal:

```powershell
cd F:\projects\FixMyCity\frontend
npm install
npm run dev
```

Use the actual extracted path. Vite will print a local address, normally:

http://localhost:5173

Open that address in your browser. Keep both the backend and frontend terminals running while you use the application.

## 4. Create a citizen account

1. Open the frontend URL.
2. Click **Sign in to report**.
3. Choose **Create an account**.
4. Enter your name, email, and password (at least 8 characters).
5. Sign in and submit a test issue.

Citizen registration never allows a user to choose the admin role.

## 5. Create an administrator account

For this starter, administrator creation is intentionally a manual local-development operation. Register a normal user through the UI first, then stop the backend with `Ctrl+C`.

From the `backend` directory, with the virtual environment active, run:

```powershell
python
```

Paste the following Python code into the interactive prompt, replacing the email with the account you registered:

```python
from main import SessionLocal, User

with SessionLocal() as db:
    user = db.query(User).filter(User.email == "admin@example.com").first()
    if user is None:
        print("User not found. Register this email in the app first.")
    else:
        user.role = "admin"
        db.commit()
        print("Admin role enabled for", user.email)
```

Exit Python:

```python
exit()
```

Restart the backend:

```powershell
uvicorn main:app --reload
```

Sign out of the frontend, then sign in with that account again. The app stores the role in the login response, so signing in again refreshes the role in the browser. The administrator can now open **All issues** and manage reports.

**Never expose this manual role-promotion workflow as a public endpoint.** For a production system, use a secure, audited administrator provisioning process.

---

# Optional: Use PostgreSQL

SQLite is the default to keep first-time setup simple. To use PostgreSQL locally:

1. Install PostgreSQL and create a database named `fixmycity`.
2. Activate the backend virtual environment.
3. Install a PostgreSQL driver:

```powershell
pip install "psycopg[binary]"
```

4. Edit `backend\.env`:

```dotenv
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/fixmycity
SECRET_KEY=replace-with-a-long-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=1440
FRONTEND_ORIGIN=http://localhost:5173
UPLOAD_DIR=uploads
```

Replace `YOUR_PASSWORD` with your local PostgreSQL password. If the password contains URL-reserved characters, URL-encode them.

5. Restart the backend. SQLAlchemy will connect and create the application tables on startup.

**Database note:** This starter creates tables using `Base.metadata.create_all()`. For an evolving or production database, use Alembic migrations instead. Do not change database engines while reusing an old database file without planning a data migration.

---

# Main API endpoints

The base API URL is `http://127.0.0.1:8000`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| GET | `/api/meta` | Public | Categories, statuses, priorities |
| POST | `/api/auth/register` | Public | Create citizen account |
| POST | `/api/auth/login` | Public | Sign in and receive JWT |
| GET | `/api/auth/me` | Signed-in user | Current user profile |
| GET | `/api/departments` | Public | List departments |
| POST | `/api/departments` | Admin | Create department |
| POST | `/api/issues` | Signed-in user | Create issue |
| GET | `/api/issues` | Signed-in user | List own issues; admin sees all |
| GET | `/api/issues/public` | Public | Limited public issue feed |
| GET | `/api/issues/{id}` | Owner or admin | Issue details and history |
| PATCH | `/api/issues/{id}` | Admin | Update status, priority, department |
| POST | `/api/issues/{id}/image` | Owner or admin | Upload issue photo |
| GET | `/api/admin/stats` | Admin | Summary statistics |
| GET | `/api/admin/users` | Admin | List users |

For full schemas and the interactive request tester, open `http://127.0.0.1:8000/docs`.

## Example API workflow

1. Register using `POST /api/auth/register`.
2. Sign in using `POST /api/auth/login`.
3. Copy the `access_token` from the response.
4. In Swagger, click **Authorize** and enter the bearer token as requested by the dialog.
5. Create an issue with `POST /api/issues`.
6. Retrieve your issues with `GET /api/issues`.
7. Promote a development account to admin using the local-only procedure above.
8. As admin, update an issue with `PATCH /api/issues/{id}`.

Example issue JSON:

```json
{
  "title": "Large pothole near the bus stop",
  "description": "A deep pothole is present near the main bus stop and may be hazardous to two-wheelers.",
  "category": "Roads & Potholes",
  "location": "Main Road, near Central Bus Stop"
}
```

Example admin update JSON:

```json
{
  "status": "In Progress",
  "priority": "High",
  "department_id": 1,
  "comment": "Assigned to the roads maintenance team."
}
```

## Status workflow

The supported statuses are:

- `Submitted`
- `Under Review`
- `In Progress`
- `Resolved`
- `Rejected`

Priorities are `Low`, `Medium`, `High`, and `Urgent`.

New issues start with `Submitted` status and `Medium` priority. Each status/administrative update is recorded in the issue history.

## Image upload behavior

- Allowed content types: JPEG, PNG, WEBP.
- Maximum file size: 5 MB.
- Images are saved in the backend `uploads/` folder.
- The database stores a relative image path.
- Only the issue owner or an administrator can upload an image for an issue.

For production, also validate image contents rather than trusting the browser-provided MIME type, generate safe storage keys, and use a dedicated object store or private media service if appropriate.

---

# Troubleshooting

### `python` is not recognized
Install Python from the official Python website and ensure the Python launcher is available. Close and reopen PowerShell after installation.

### `npm` is not recognized
Install the current Node.js LTS release and reopen PowerShell.

### PowerShell says scripts are disabled
Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in the current terminal and activate the virtual environment again.

### `ModuleNotFoundError`
Confirm the backend virtual environment is activated and run:

```powershell
pip install -r requirements.txt
```

### Frontend says Network Error
- Verify the backend is running at `http://127.0.0.1:8000`.
- Visit `http://127.0.0.1:8000/api/health`.
- Ensure the frontend is running at `http://localhost:5173`.
- Check the browser developer console for details.

### Port 8000 is already in use
Run the backend on another port:

```powershell
uvicorn main:app --reload --port 8001
```

If you do this, set `VITE_API_URL=http://127.0.0.1:8001/api` in `frontend/.env` and restart Vite.

### Login does not reflect a newly granted admin role
Sign out and sign back in so the browser receives a new user profile and token.

### Need a clean local database
Stop the backend, back up any data you want to keep, and delete `backend/fixmycity.db`. The app recreates the database on next startup. This deletes all local users, issues, and issue history.

---

# Security and production checklist

This is a learning/portfolio project, not a security-audited civic service. Before production use:

- Set a unique, high-entropy `SECRET_KEY` in environment configuration.
- Use HTTPS and secure deployment configuration.
- Add database migrations and backups.
- Add automated tests and continuous monitoring.
- Add rate limiting and abuse/spam controls.
- Validate uploaded image content and consider malware scanning.
- Add pagination to public feeds and limits to upload/request sizes at the server level.
- Review CORS settings for the exact deployed frontend origin.
- Avoid returning precise private addresses or personal data in public responses.
- Add a formal administrator provisioning and audit process.
- Add account recovery, email verification, and privacy/retention policies.
- Use a production-grade database and hosting setup.

## Suggested next improvements

1. Add a map picker and map-based issue discovery.
2. Add issue assignment to individual staff members.
3. Add email notifications for status changes.
4. Add department management UI.
5. Add automated tests for authentication, authorization, and issue workflows.
6. Add a proper deployment guide and screenshots to the GitHub README.

## Portfolio description

**FixMyCity — Full-Stack Civic Issue Reporting Platform**

Developed a responsive civic issue reporting platform using React, FastAPI, and SQLAlchemy, with SQLite/PostgreSQL database support. Implemented JWT-based authentication, role-based authorization, issue reporting with image uploads, administrative status and priority management, department assignment, search/filtering, and public issue visibility. Documented REST APIs with FastAPI Swagger UI.

## License

You may use and modify this project for learning and portfolio purposes. Add a formal open-source license if you plan to publish it publicly.

## Map-based issue locations

The report form includes an OpenStreetMap-powered location picker. A citizen can allow browser location access with **Use my current location**, click anywhere on the map, or drag the pin to the actual issue. The selected latitude and longitude are stored with the issue in SQLite and shown in issue details with a link to OpenStreetMap. Browser geolocation requires permission and a secure context (localhost is allowed during development). If permission is denied, users can still choose a location manually.

The frontend uses `leaflet` and `react-leaflet`; run `npm install` in `frontend/` after pulling the updated project. Map tiles are provided by OpenStreetMap, so the browser needs an internet connection to display the map.
