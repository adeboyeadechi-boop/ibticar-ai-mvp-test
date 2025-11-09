# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ibticar.AI MVP** - A Next.js 16 application serving as the backend API for Ibticar.AI. This project uses the App Router architecture with TypeScript and is configured primarily for backend services, though it retains minimal frontend structure.

## Key Technologies

- **Framework**: Next.js 16.0.1 (App Router) with React 19.2.0
- **Language**: TypeScript 5
- **Database**: PostgreSQL via Prisma ORM
- **Authentication**: NextAuth.js 4 with JWT sessions and credentials provider
- **Password Hashing**: bcrypt
- **Testing**: Jest 30 with ts-jest
- **Styling**: Tailwind CSS 4
- **Code Quality**: ESLint 9 + Prettier

## Development Commands

### Running the Application
```bash
npm run dev           # Start development server with automatic DB check
npm run dev:unsafe    # Start dev server WITHOUT DB check (faster, use if DB is already configured)
npm run build         # Build for production (includes Prisma client generation)
npm start             # Start production server with automatic DB check
npm start:unsafe      # Start prod server WITHOUT DB check
```

**Note**: `npm run dev` and `npm start` automatically verify and initialize the database before starting the server. They will:
1. Check if `DATABASE_URL` is configured
2. Generate Prisma Client if missing
3. Verify database connection
4. Apply pending migrations
5. Start the Next.js server

If you need to skip the database check (e.g., DB already configured), use `dev:unsafe` or `start:unsafe`.

### Testing
```bash
npm test             # Run all tests once
npm run test:watch   # Run tests in watch mode
```

### Code Quality
```bash
npm run lint         # Check code with ESLint
npm run lint:fix     # Auto-fix ESLint issues
npm run format       # Format code with Prettier
```

### Database Management
```bash
npm run db:check            # Verify and initialize database configuration
npm run db:migrate          # Create and apply a new migration (dev)
npm run db:migrate:deploy   # Apply pending migrations (production)
npm run db:generate         # Generate Prisma Client
npm run db:studio           # Open Prisma Studio (database GUI)
npm run db:seed             # Seed the database with initial data
```

**Automatic Database Initialization**: When you run `npm run dev` or `npm start`, the application automatically checks if the database is properly configured with Prisma. If not, it will:
- Generate the Prisma Client
- Verify database connectivity
- Apply any pending migrations

You can manually trigger this check with `npm run db:check`.

## Architecture & Structure

### Database Layer (Prisma)

- **Schema Location**: `prisma/schema.prisma`
- **Generated Client**: Output to `src/generated/prisma/` (not default `node_modules/.prisma`)
- **Client Singleton**: Use `prisma/client.ts` for database access (not direct imports)
- **Test Mock**: `prisma/singleton.ts` provides mocked Prisma client for Jest tests

**User Model Extensions**:
- `passwordHash`: Stores bcrypt-hashed passwords for credentials authentication
- `role`: Role-based access control field (default: "USER", options: "USER", "MANAGER", "ADMIN")

### Authentication Architecture

**Location**: `src/auth.ts` (central configuration)

**Strategy**: JWT-based sessions with Prisma adapter
- Uses `PrismaAdapter` for database persistence
- Session strategy: JWT (not database sessions)
- `trustHost: true` configured for decoupled deployment

**Provider**: Credentials-based authentication
- Email/password authentication via `bcrypt.compare()`
- Stored in `User.passwordHash` field
- Returns `null` for invalid credentials or missing users

**JWT/Session Callbacks**:
- `jwt` callback: Adds `user.id` and `user.role` to token
- `session` callback: Exposes `id` and `role` on `session.user` object

**API Route**: `src/app/api/auth/[...nextauth]/route.ts`
- Exports `handlers` as `GET` and `POST` from `src/auth.ts`
- Handles all NextAuth endpoints (`/api/auth/*`)

### Import Aliases

TypeScript path alias `@/*` maps to `src/*` (configured in `tsconfig.json`)

**Examples**:
```typescript
import prisma from "@/prisma/client"
import { auth } from "@/auth"
```

### Testing Configuration

- **Environment**: `node` (not jsdom) - suitable for backend testing
- **Setup File**: `prisma/singleton.ts` runs before all tests, providing mocked Prisma
- **Module Resolution**: Respects `@/*` alias via Jest's `moduleNameMapper`
- **Test Pattern**: Files in `src/__tests__/**/*.test.ts`

**Using Prisma in Tests**:
```typescript
import { prismaMock } from '../../../prisma/singleton'

test('example', async () => {
  prismaMock.user.findUnique.mockResolvedValue({ /* mock data */ })
  // Your test logic
})
```

### Next.js Configuration

- **React Compiler**: Enabled (`reactCompiler: true`) for optimized builds
- **App Router**: Using Next.js 15+ App Router structure (`src/app/`)

## Important Implementation Notes

### Prisma Client Usage

Always import the Prisma client from the singleton:
```typescript
import prisma from "@/prisma/client"  // ✓ Correct
// NOT from: @prisma/client or src/generated/prisma
```

### Database Schema Changes

After modifying `prisma/schema.prisma`:
1. Run `npx prisma migrate dev --name <description>` to create migration
2. Prisma Client regenerates automatically to `src/generated/prisma/`
3. Commit both schema and migration files

### Authentication Implementation

When protecting routes or API endpoints:
```typescript
import { auth } from "@/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }
  // Access session.user.id and session.user.role
}
```

### Environment Variables

Required variables (create `.env` or `.env.local`):
```
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"  # Your app URL
NEXTAUTH_SECRET="..."                  # Generate with: openssl rand -base64 32
```

## Code Style

- **ESLint**: Extends `next/core-web-vitals`, `next/typescript`, and `prettier`
- **Prettier**: Configured to work with ESLint (no conflicts)
- **Auto-format**: Run `npm run format` before commits
- **TypeScript**: Strict mode enabled

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   └── auth/          # NextAuth routes
│   ├── layout.tsx         # Root layout (minimal, backend-focused)
│   └── page.tsx           # Root page
├── auth.ts                # NextAuth configuration
├── generated/prisma/      # Generated Prisma Client (do not edit)
└── __tests__/             # Jest test files

prisma/
├── schema.prisma          # Database schema
├── client.ts              # Prisma singleton for app
├── singleton.ts           # Mocked Prisma for tests
└── migrations/            # Database migrations

scripts/
├── init-db.mjs            # Database initialization and verification script
└── start-with-db-check.mjs # Startup wrapper with DB check
```
