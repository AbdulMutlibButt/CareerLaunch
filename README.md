# CareerLaunch

A full-stack job and internship platform built with Next.js, React, Tailwind CSS, Axios, Node.js, Express and MongoDB/Mongoose.

## Run it

Install Node.js 22 or newer. In this folder:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. The Express API listens on http://127.0.0.1:4000. Use the same hostname throughout because authentication uses cookies. One command starts both services.

Without database configuration, the app starts in an explicitly labelled local demo mode. Data is persisted to `server/data/demo.json`; this is a single-process development store, not a production database. A fresh demo creates nine fictional jobs and supporting identities with a generated, non-recoverable password. Register applicant and employer accounts through the UI to explore authenticated workflows. If you deliberately need reusable seeded logins, set `DEMO_PASSWORD` only in your ignored local environment before the first seed; never add it to an environment template or tracked file.

## Features

- Registration, login, logout and signed JWT sessions in HTTP-only cookies.
- Applicant and employer dashboards with server-enforced roles and ownership.
- Public job discovery with keyword, location, skills, job type and workplace filters, URL query parameters, sorting and pagination.
- Company profiles and applicant profiles with skills, education, experience and a résumé link.
- Employers can post, edit, close, reopen and soft-delete listings.
- Applicants can save jobs, submit cover letters and résumé links, track applications and withdraw pending applications.
- Employers can inspect applicant details, filter applications and move them from Pending to Reviewing to Accepted/Rejected. Pending applications can also be rejected directly; terminal states cannot be changed.
- Duplicate applications and saves are blocked by unique MongoDB indexes (and matching checks in local demo mode).
- Responsive layouts, accessible field labels, keyboard focus, loading/empty/error states, toasts and native confirmation dialogs.
- Input and environment validation, bcrypt password hashing with timing-safe unknown-user handling, authentication rate limits, origin checks, restrictive browser headers and protected cookies.

## Connect MongoDB

Copy `server/.env.example` to `server/.env`. Set `MONGODB_URI` to your own local MongoDB or Atlas connection string and `JWT_SECRET` to a cryptographically random secret of at least 32 characters. Keep credentials out of Git. Blank optional values use documented development defaults; malformed values fail at startup instead of being silently accepted. Restart the app.

```env
PORT=4000
NODE_ENV=development
APP_ORIGIN=http://127.0.0.1:3000
MONGODB_URI=mongodb://127.0.0.1:27017/careerlaunch
JWT_SECRET=replace-with-your-own-long-random-secret
# Optional and development-only; leave unset for normal use.
DEMO_PASSWORD=
```

MongoDB mode starts with an empty database. Create accounts through the UI, or deliberately run `npm run seed` in a development environment to add the fictional demo dataset. Local demo data is not automatically migrated into MongoDB.

## Architecture

```text
Browser → Vercel Next.js + Axios → same-origin /api rewrite → Render Express → MongoDB
                                                                         ↘ local JSON demo (development only)
```

`client/components/CareerLaunch.jsx` implements the screens and routes. `server/src/app.js` implements the API and its security boundaries. `server/src/store.js` defines the five MongoDB models and the local demo adapter. The frontend's navigation is not an authorization boundary: all protected API operations verify the session, role and ownership.

The model collections are users, profiles (applicant/company fields), jobs, applications and saved jobs. Profiles reference users; jobs reference employers; applications reference jobs and applicants; saved jobs reference users and jobs. MongoDB uses UUID strings as IDs. Password hashes are excluded from normal store reads and can only be requested through the authentication-specific secret read. Soft deletion preserves application history.

## API and Postman

Import `postman/CareerLaunch.postman_collection.json`. The default base URL is `http://127.0.0.1:4000/api`. Set the collection's empty `password` variable locally before using authentication requests, and never export its current value. Postman retains the session cookie after login. Job and application variables are captured by the corresponding create requests. Log in as the correct role before each group.

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | /auth/register, /auth/login, /auth/logout | Public |
| GET | /auth/me | Signed in |
| GET, PATCH | /profile | Signed in |
| GET | /jobs, /jobs/:id | Public |
| POST | /jobs | Employer |
| PATCH, DELETE | /jobs/:id | Owning employer |
| POST, DELETE | /jobs/:id/save | Applicant |
| GET | /saved-jobs | Applicant |
| POST | /jobs/:id/apply | Applicant |
| GET | /applications/me | Applicant |
| PATCH | /applications/:id/withdraw | Owning applicant |
| GET | /employer/jobs | Employer |
| GET | /employer/jobs/:id/applications | Owning employer |
| PATCH | /applications/:id/status | Owning employer |

## Validation

```sh
npm test
API_URL=https://api.example.com npm run build
```

The build command above uses a safe public placeholder because production compilation intentionally requires `API_URL`; replace it with the Render origin for a deployment build. In PowerShell, set `$env:API_URL` first and then run `npm run build`. The integration tests cover the hiring flow, authorization, forged ownership fields, duplicate applications/saves, status transition rules, closed/deleted listings, origin rejection, logout, protected production cookies, environment validation, password-hash minimization, persistent local storage and the Vercel/Render deployment boundaries. MongoDB connectivity can be verified with a read-only administrative ping before starting the application.

## Vercel frontend and Render backend

The production architecture keeps the existing Next.js frontend on Vercel and runs the persistent Express API as a Render web service. Browser requests remain same-origin at `/api/*`; Next.js rewrites them server-side to the public Render origin.

### Why `/api/health` failed on Vercel

The previous Next.js configuration used `http://127.0.0.1:4000` whenever `API_URL` was absent. In Vercel production that loopback address is inside the Vercel runtime, not the CareerLaunch backend. Vercel blocks external rewrites whose destination resolves to a private address and returns `DNS_HOSTNAME_RESOLVED_PRIVATE`. Production builds now require `API_URL`, require HTTPS, and reject local, private, credential-bearing or path-bearing destinations.

### 1. Create the Render API

[`render.yaml`](render.yaml) is a safe Blueprint for the backend. Automatic deploys are disabled until you deliberately enable them. It installs only the server workspace, starts the Express service, and checks `/api/health`.

Configure these Render variables during Blueprint creation:

| Variable | Configuration |
| --- | --- |
| `NODE_ENV` | `production` (declared in the Blueprint) |
| `HOST` | `0.0.0.0` (declared in the Blueprint) |
| `PORT` | `10000` (declared in the Blueprint; the server reads `PORT`) |
| `APP_ORIGIN` | Exact public Vercel frontend origin, using HTTPS and no trailing path |
| `MONGODB_URI` | MongoDB connection string, entered only in Render's secret prompt |
| `JWT_SECRET` | Generated securely by Render from the Blueprint |

Keep MongoDB network access restricted to the backend wherever your hosting plan permits. Do not seed demo users in production. After the service starts, verify its public `https://<service>.onrender.com/api/health` endpoint before changing Vercel.

### 2. Point Vercel at Render

Keep the Vercel project Root Directory set to `client`. Add this server-side environment variable to the Vercel Production environment:

```env
API_URL=https://<service>.onrender.com
```

Use the public Render HTTPS origin only: do not include `/api`, credentials, a query string, localhost, a private IP or a Render private-network hostname. `API_URL` intentionally does not use the `NEXT_PUBLIC_` prefix because it is consumed by Next.js server configuration and does not need to be bundled into browser JavaScript.

Vercel applies environment changes only to new deployments. After saving `API_URL`, create a new deployment and verify the Vercel `/api/health` route. If Preview deployments also use the Render API, their browser origins must be accounted for by the backend's origin policy; the default production configuration permits only the exact `APP_ORIGIN`.

### Other Node hosting

For a same-host reverse proxy, set `API_URL` to the backend origin before running `npm run build`, then run `npm run start -w server` and `npm run start -w client` under a process manager. The API defaults to loopback for local and same-host operation; public container platforms must bind it to `0.0.0.0` and their assigned `PORT`.

## Known limits and future improvements

Résumés use user-provided shareable links, not file uploads. Email verification, password reset, email notifications and admin moderation are not included. Search currently filters database results in the API process; add indexed database queries for a large job catalogue. Rate limits are per process; use a shared store for multiple API instances. Keep one demo API process running at a time. Applicant profiles are current at review time while submitted cover letters and résumé links are preserved per application. Branding uses text initials rather than uploaded avatars/logos. Dark mode was optional and is not included.

## Portfolio handoff

After connecting your database and deploying, add your live URL and screenshots to this README. Do not claim unmeasured user counts or performance gains. Suggested résumé wording:

> Built a full-stack job and internship platform with Next.js, Express and MongoDB, featuring JWT authentication, role-based dashboards, searchable listings and an application review workflow.
