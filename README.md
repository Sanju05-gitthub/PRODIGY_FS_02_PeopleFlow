# PeopleFlow — Employee Management System

**Prodigy InfoTech Full-Stack Web Development Internship — Task 02 (PRODIGY_FS_02)**

A responsive, admin-only employee management application using React, Express, Node.js and MongoDB.

## Features
- Administrator login with hashed password, JWT and HTTP-only session cookie
- Create, read, update and delete employee records
- Server-side validation, duplicate email checks and protected API routes
- Search, department filtering, workforce statistics and annual payroll summary
- Responsive dashboard, confirmation before deleting and error messages

## Requirements
- Node.js and npm
- MongoDB Community Server running locally (default port 27017)

## Setup (Windows PowerShell)

1. Open the project folder in VS Code.
2. In terminal 1:

```powershell
cd backend
Copy-Item .env.example .env
notepad .env
```

Edit `.env`: set `ADMIN_EMAIL`, a strong `ADMIN_PASSWORD` (at least 12 characters), and a random `JWT_SECRET` (at least 32 characters). Generate the secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Never upload `.env` or share real passwords.** Then run:

```powershell
npm install
npm start
```

3. In terminal 2 (from the root project folder):

```powershell
cd frontend
npm install
npm run dev
```

4. Visit **http://localhost:5173** and log in using the administrator email and password from `.env`. The administrator is automatically created on first backend startup. If you change the admin password later, it does not automatically update the existing MongoDB account.

5. Add employee records from the dashboard. Test create, edit, search, filter and delete. Check logout and verify protected records are inaccessible without login.

**Note:** If Task 01 is still using ports 5000 or 5173, stop those old terminal servers first (Ctrl+C). This app uses the same ports.

## API
- `POST /api/auth/login` — admin login
- `GET /api/auth/me` — current admin (protected)
- `POST /api/auth/logout` — logout
- `GET /api/employees` — list employees (protected)
- `POST /api/employees` — create employee (protected)
- `PUT /api/employees/:id` — update employee (protected)
- `DELETE /api/employees/:id` — delete employee (protected)

## Security note
This is a local internship demonstration project, not a production deployment. Protect your local database, keep secrets out of GitHub, and apply HTTPS, secure deployment settings, CSRF defenses appropriate to deployment, monitoring and further security review before using real employee data. Use fictional employee records for screenshots and demonstrations.

## Screenshots
Add your dashboard, add-employee form and login screenshots to a `screenshots/` folder after testing.
