# Frontend

React + TypeScript + Vite, with React Router, TanStack Query, and Supabase Auth.
Task 1.2 adds an API connection panel that calls the
local FastAPI health endpoint, with pending, success, error, and retry states.
Task 2.2 implements email/password login, logout, session restoration, and SDK
token refresh. Product-data pages remain placeholders.

From this directory, run `npm ci` then `npm run dev`. Checks are `npm run lint`,
`npm run format:check`, `npm run typecheck`, `npm test`, and `npm run build`.

Task 2.1 provides `.env.example`. Copy it to ignored `.env.local` without
overwriting an existing file, then fill the public URL/key locally from the
existing development Supabase project. Vite loads `.env.local`; restart Vite
after changing it. Every `VITE_` value is public browser configuration.
Never add database credentials, a service-role/secret key, or an access token.
The app consumes `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, and a public key.
Use `VITE_SUPABASE_PUBLISHABLE_KEY` as shown in the current Supabase React dialog,
or `VITE_SUPABASE_ANON_KEY` as specified in the execution plan/template.
Both accept a public key; a nonempty publishable-key variable takes precedence
when both are supplied.

## Instructor authentication

Open `/login` and enter the owner-created development account's email/password.
No account is provisioned, prefilled, or hard-coded by the frontend. If Supabase
reports that the email is unconfirmed, confirm the development identity in the
dashboard before trying again. Missing configuration, restoration failures,
invalid credentials, and logout errors are shown explicitly.

The SDK persists the Auth session in browser storage and refreshes access tokens
automatically while managing browser visibility. Reloading restores the session;
**Logout** calls Supabase sign-out and returns protected instructor routes to
login. Auth event listeners are unsubscribed on unmount. Switching accounts or
signing out removes cached non-public query data, preserving the public health
query. Student-link routes remain outside the instructor login guard.

These route guards are UX only, not server-side authorization. Session data
returned by `getSession` is client state, not verified backend identity.
Backend JWT validation and protected API calls belong to Task 2.3; database
connectivity checks belong to Task 2.4. The current `/health` call remains public
and carries no access token. No signup, password recovery, or role administration
is implemented here.

The development test password previously appeared in the committed execution
plan. Removing it from the current file does not erase Git history: rotate that
password in Supabase before using the account. Keep the replacement out of Git,
chat, browser bundles, and logs.

To verify with your real project, restart Vite, sign in, reload the page and check
that the instructor workspace remains visible, then click **Logout** and verify
the login form returns. Automated tests use synthetic credentials and mocked
Auth responses, never the owner's account or backend secrets.

See the [repository README](../../readme.md) for prerequisites, routes, backend
setup, and task boundaries.
