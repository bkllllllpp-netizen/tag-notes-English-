# Project Overview

This repository contains a tag-first notebook prototype. The UI provides three core views (tag overview, note list, and editor) and supports switching between rich-text keyboard input and handwriting.

# Installation & Workflow

## Requirements
- Node.js ≥ 18
- Supabase project (Postgres)
- Modern browser for local preview

## Environment Variables
- Frontend (`client/.env` optional):
  ```dotenv
  VITE_API_BASE_URL=http://localhost:8787/api
  ```
- Backend (`server/.env`, see example file):
  ```dotenv
  PORT=8787
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=service-role-key
  SUPABASE_ANON_KEY=anon-public-key
  CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
  ```

## Install Dependencies
```bash
npm install --prefix client
npm install --prefix server
```

## Local Development
```bash
npm run client:dev    # start Vite dev server
npm run server:dev    # start Express API
```
Run `server/db/schema.sql` inside Supabase SQL editor to initialise the `notes` table. Point the frontend to the backend via `VITE_API_BASE_URL`.

## Build & Deploy
- Frontend build: `npm run client:build` (output in `client/dist/`).
- Preview build: `npm run client:preview`.
- Package static bundle: `npm run client:deploy` (creates `client/deploy/<timestamp>/`).
- Backend deploy: Deploy `server/` to any Node.js host (Render, Railway, Fly.io, etc.) with Supabase credentials set.

# Directory Layout
```
├─ AGENTS.md
├─ plan.md
├─ package.json              # root scripts delegating to client/server
├─ client/
│  ├─ index.html             # SPA entry
│  ├─ styles.css             # global styles
│  ├─ app.js                 # frontend state & interactions
│  ├─ package.json           # frontend scripts & deps
│  └─ scripts/deploy-static.js
└─ server/
   ├─ package.json           # backend scripts & deps
   ├─ .env.example
   ├─ db/schema.sql          # Supabase schema
   └─ src/                   # Express routes, services, models
```

# API Summary
- `GET /api/notes` – list notes
- `GET /api/notes/:id` – note detail
- `POST /api/notes` – create note
- `PATCH /api/notes/:id` – update note
- `DELETE /api/notes/:id` – delete note
- `GET /api/tags` – tag stats
- `GET /api/tags/:name/notes` – notes associated with a tag

# Tech Stack
- Frontend: Vanilla JS + Vite
- Backend: Node.js + Express, Supabase (Postgres)
- Deployment: static hosting for frontend (Vercel/Netlify/etc.), Node host for backend
