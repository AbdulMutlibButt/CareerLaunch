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
Browser → Next.js pages + Axios → same-origin /api proxy → Express → MongoDB
                                                               ↘ local JSON demo
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
npm run build
```

The integration tests cover the hiring flow, authorization, forged ownership fields, duplicate applications/saves, status transition rules, closed/deleted listings, origin rejection, logout, protected production cookies, environment validation, password-hash minimization and persistent local storage. MongoDB connectivity can be verified with a read-only administrative ping before starting the application.

## Production setup

This project uses a conventional Node.js backend with the native MongoDB driver. It is not a Cloudflare Workers/Sites deployment. Run both Node services behind an HTTPS reverse proxy (or deploy the frontend and API to compatible Node hosts). Set `API_URL` for the Next.js proxy before building, and set `MONGODB_URI`, a strong `JWT_SECRET`, `NODE_ENV=production` and an HTTPS `APP_ORIGIN` on the API. The API intentionally refuses production startup without these settings. It listens on loopback by default, suitable for a same-host reverse proxy; configure `HOST=0.0.0.0` only for a container host that requires it. Never publish the demo accounts with real user data.

Build with `npm run build`, then run `npm run start -w server` and `npm run start -w client` under your process manager. Host availability and free-tier limits must be checked when selecting deployment providers. No live deployment or database account is included.

## Known limits and future improvements

Résumés use user-provided shareable links, not file uploads. Email verification, password reset, email notifications and admin moderation are not included. Search currently filters database results in the API process; add indexed database queries for a large job catalogue. Rate limits are per process; use a shared store for multiple API instances. Keep one demo API process running at a time. Applicant profiles are current at review time while submitted cover letters and résumé links are preserved per application. Branding uses text initials rather than uploaded avatars/logos. Dark mode was optional and is not included.

## Portfolio handoff

After connecting your database and deploying, add your live URL and screenshots to this README. Do not claim unmeasured user counts or performance gains. Suggested résumé wording:

> Built a full-stack job and internship platform with Next.js, Express and MongoDB, featuring JWT authentication, role-based dashboards, searchable listings and an application review workflow.
