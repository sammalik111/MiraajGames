# Auth

NextAuth (Auth.js) with a Postgres-backed users table, plus two server-side guard helpers used by every protected route.

## Architecture

- **Client**: `useAuth()` (`src/lib/useAuth.ts`) wraps NextAuth's `useSession()` and exposes `{ userId, authed, loading, user, ... }`. Use this anywhere on the client to check auth state.
- **Server**: `requireUser()` and `requireAdmin()` are the gatekeepers for protected API routes. They run on every request.
- **Storage**: passwords are bcrypt-hashed and stored in `users.password_hash`. Never the plaintext.




## `requireUser()` SERVER SIDE AUTH

`src/lib/requireUser.ts`. Returns either the user id string (success) or a `NextResponse` 401 (failure). Calling pattern:

```ts
import { requireUser } from "@/lib/requireUser";

export async function POST(req: Request) {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;  
  // ... userId is guaranteed; do the work
}
```



## `requireAdmin()` ADMIN AUTH WRAPPER ON REQUIREUSER

`src/lib/requireAdmin.ts`. Layers on top of `requireUser()` and additionally checks the user id against `process.env.ADMIN_IDS`. Returns the user id string or a 403 `NextResponse`.

```ts
const adminId = await requireAdmin();
if (typeof adminId !== "string") return adminId;
```



## `useAuth()` CLIENT SIDE AUTH 

`src/lib/useAuth.ts`. uses the useSession() function provided by NextAuth. server side can use the JWT token in server to call `await auth()` to get credentials. calling it in client would require exposing the server token to the client. thats unacceptable so instead useSession() securely asks server for session details. 

```ts
import { useAuth } from "@/lib/useAuth";
const { userId, authed, loading } = useAuth();
if (!authed) return;
```




### Why not store admin in the DB?

It's a deployment-level concern, not a user-managed one. Putting it in env means:
- The admin list is part of your infrastructure config (managed by whoever has SSH/secrets access)
- A compromised admin account can't grant admin to others without also having env access
- The DB stays free of "permissions" concerns


## Useful auth files

| File                      | What it does                        |
|---------------------------|-------------------------------------|
| `src/auth.ts`             |  NextAuth config + providers        |
| `src/lib/useAuth.ts`      | Client hook                         |
| `src/lib/requireUser.ts`  | Server guard for authed routes      |
| `src/lib/requireAdmin.ts` | Server guard for admin-only routes  |