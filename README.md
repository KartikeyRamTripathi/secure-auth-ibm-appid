# Secure Auth with IBM Cloud App ID

I built this to figure out how IBM Cloud App ID's OAuth 2.0 / OIDC flow
actually works end to end — a custom login page, IBM's hosted sign-in
screen, and a dashboard that pulls back the logged-in user's profile.

No passwords are handled by this app at all — IBM App ID does all of that,
which is really the whole point of using it.

## Stack

Node + Express, `ibmcloud-appid` (IBM's official SDK) wired up through
Passport's `WebAppStrategy`, EJS for views, and `express-session` for
keeping people logged in.

## Layout

```
project/
├── server.js         # routes + App ID / Passport setup
├── package.json
├── .env.example      # copy to .env and fill in your own IBM credentials
├── views/
│   ├── login.ejs
│   ├── dashboard.ejs
│   └── error.ejs
└── public/css/style.css
```

## Setting it up

1. Log into [cloud.ibm.com](https://cloud.ibm.com), go to Catalog, and
   spin up an **App ID** instance (the Lite plan is free).
2. In the instance, go to **Manage Authentication** and turn on
   **Cloud Directory** (add Google/Facebook too if you want social login).
3. Under **Authentication Settings**, add this redirect URL:
   ```
   http://localhost:3000/ibm/cloud/appid/callback
   ```
4. Under **Service Credentials**, create a new credential and grab
   `tenantId`, `clientId`, `secret`, and `oauthServerUrl`.
5. Copy `.env.example` to `.env` and paste those four values in, plus a
   random string for `SESSION_SECRET`.
6. Install and run:
   ```bash
   npm install
   npm start
   ```
7. Open `http://localhost:3000`.

## What happens under the hood

Landing on `/` shows a custom login card. Hitting login kicks off
Passport's `WebAppStrategy`, which redirects you to IBM's hosted sign-in.
IBM sends you back to `/ibm/cloud/appid/callback` with an auth code,
Passport exchanges it for tokens, and a session gets created. From there
`/dashboard` is gated behind an `ensureAuthenticated` check and reads
`req.user` for the profile info. `/logout` clears both the local session
and IBM's SSO cookie via `WebAppStrategy.logout(req)`.

## Notes

- Session cookies are `httpOnly`, and `secure` flips on automatically
  once `NODE_ENV=production` — so put this behind HTTPS if you deploy it.
- `.env` is git-ignored on purpose; only `.env.example` (placeholder
  values) is committed.

## Deploying

Works on any Node host — IBM Cloud, Render, Railway, whatever. Just set
the same env vars from `.env` on the host, and don't forget to add the
production callback URL to App ID's redirect list too.

## Common snags

Redirect coming back with an error usually means the redirect URL in the
App ID dashboard doesn't match `APPID_REDIRECT_URI` exactly (http vs
https, trailing slash, etc). If login just loops back to `/`, the session
cookie probably isn't persisting — check `SESSION_SECRET` is actually set,
and if you're behind a reverse proxy, add `app.set('trust proxy', 1)`.