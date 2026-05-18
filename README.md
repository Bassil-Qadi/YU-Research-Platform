# Research Collaboration Platform

University-wide platform for discovering research projects, forming teams, and collaborating in a single authenticated environment.

## Tech stack (Phase 1)

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, React Query, Zustand
- **Auth:** Auth.js v5 (NextAuth) with MongoDB adapter, dev credentials, OAuth/SAML placeholders
- **Database:** MongoDB (Mongoose), Redis (docker-compose, Phase 2+)

## Prerequisites

- Node.js 20+
- Docker (for local MongoDB and Redis)

## Local setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Environment**

   ```bash
   cp .env.example .env.local
   ```

   Generate a secret:

   ```bash
   openssl rand -base64 32
   ```

   Set `AUTH_SECRET` (and optionally `NEXTAUTH_SECRET`) in `.env.local`.

3. **Start databases**

   ```bash
   docker compose up -d
   ```

4. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Development login

When `NODE_ENV=development` and `DEV_AUTH_ENABLED=true` (default):

| Field    | Value                 |
|----------|-----------------------|
| Email    | `demo@university.edu` |
| Password | `demo123456`          |

The demo user is created on first sign-in with the **Admin** role for testing protected routes.

## Scripts

| Command           | Description              |
|-------------------|--------------------------|
| `npm run dev`     | Start dev server         |
| `npm run build`   | Production build         |
| `npm run lint`    | ESLint                   |
| `npm run typecheck` | TypeScript check       |

## Project structure

```
app/
  (auth)/login/          # Login page
  (dashboard)/           # Dashboard, projects, messages, directory, profile
  admin/                 # Admin area (Admin role only)
  api/                   # API routes (stubs for Phase 2+)
components/ui/           # shadcn components
components/layout/       # Sidebar, header, placeholders
lib/db/                  # Mongoose connection & models
lib/auth/                # NextAuth config, RBAC, providers
lib/validations/         # Zod schemas
hooks/ store/ types/     # Shared client utilities
middleware.ts            # Auth & RBAC route protection
```

## CI

GitHub Actions runs lint, typecheck, and build on push/PR to `main`. See `.github/workflows/ci.yml`.

## Phase 2 (next)

- Project CRUD and MongoDB models
- Researcher directory search
- Socket.io messaging
- Email notifications (Resend)

## License

Private — YU Research Platform
