# Frontend skeleton

React + TypeScript + Vite, with React Router and TanStack Query. The Task 1.1
routes remain placeholders. Task 1.2 adds an API connection panel that calls the
local FastAPI health endpoint, with pending, success, error, and retry states.
There is no authentication or product-data functionality yet.

From this directory, run `npm ci` then `npm run dev`. Checks are `npm run lint`,
`npm run format:check`, `npm run typecheck`, `npm test`, and `npm run build`.

Task 2.1 provides `.env.example`. Copy it to ignored `.env.local` without
overwriting an existing file, then fill the public URL/key locally from the
existing development Supabase project. Vite loads `.env.local`; restart Vite
after changing it. Every `VITE_` value is public browser configuration.
Never add database credentials, a service-role/secret key, or an access token.
Only `VITE_API_BASE_URL` is currently consumed; the Supabase fields are reserved
for later authentication work.

See the [repository README](../../readme.md) for prerequisites, routes, backend
setup, and task boundaries.
