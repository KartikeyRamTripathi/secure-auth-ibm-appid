# Secure User Authentication for Web Apps with IBM Cloud App ID

A complete, working Node.js + Express application that implements secure user
authentication using **IBM Cloud App ID** (OAuth 2.0 / OpenID Connect), with
a custom branded login page, IBM's hosted sign-in screen, and a protected
dashboard that displays the logged-in user's profile.

## Tech Stack
- Node.js + Express
- `ibmcloud-appid` (official IBM SDK) + Passport.js — `WebAppStrategy`
- EJS templates
- express-session for session management

## Project Structure
```
project/
├── server.js              # All routes + App ID/Passport config
├── package.json
├── .env.example            # Copy to .env and fill in your credentials
├── views/
│   ├── login.ejs           # Branded landing/login page
│   ├── dashboard.ejs       # Protected page, shows user profile
│   └── error.ejs
└── public/css/style.css    # Gradient card UI styling
```

## Step 1 — Create the IBM Cloud App ID service
1. Log into https://cloud.ibm.com
2. Catalog → search **"App ID"** → create an instance (Lite plan is free)
3. Open the instance → **Manage Authentication** → enable **Cloud Directory**
   (and optionally Google/Facebook if you want social login)
4. Go to **Identity Providers → Cloud Directory** and make sure
   "Email verification" / sign-up options are configured how you like
5. Go to **Authentication Settings** and add a **Redirect URL**:
   ```
   http://localhost:3000/ibm/cloud/appid/callback
   ```
   (add your production URL too when you deploy)
6. Go to **Service Credentials → New Credential** and copy:
   - `tenantId`
   - `clientId`
   - `secret`
   - `oauthServerUrl`

## Step 2 — Configure the app
```bash
cp .env.example .env
```
Paste the 4 values above into `.env`, plus a random `SESSION_SECRET`.

## Step 3 — Install & run
```bash
npm install
npm start
```
Open **http://localhost:3000**

## How the flow works
1. `/` — custom gradient login card (matches your reference UI)
2. Click **Login with IBM App ID** → `/login` triggers
   `passport.authenticate('appid-webapp-strategy')`, redirecting the
   browser to IBM's hosted, encrypted login page
3. IBM redirects back to `/ibm/cloud/appid/callback` with an auth code;
   Passport exchanges it for tokens and creates the session
4. `/dashboard` (protected by `ensureAuthenticated` middleware) reads
   `req.user` and displays name, email, identity provider, and subject ID
5. `/logout` calls `WebAppStrategy.logout(req)` and destroys the local
   session — this also clears IBM's SSO cookie

## Security notes already implemented
- No passwords ever touch this app — IBM App ID handles credential storage
- Session cookies are `httpOnly`, and `secure` automatically turns on when
  `NODE_ENV=production` (put the app behind HTTPS in production)
- `/dashboard` and `/api/profile` are guarded by `ensureAuthenticated`
- `.env` is git-ignored so secrets never get committed

## Deploying
Any Node host works (IBM Cloud Foundry/Kubernetes, Render, Railway, etc.)
Just set the same environment variables from `.env` in your host's config,
and remember to add the **production callback URL** to App ID's
Authentication Settings → Redirect URLs.

## Troubleshooting
| Problem | Fix |
|---|---|
| Redirects to IBM but comes back with an error | Check the redirect URL in App ID dashboard matches `APPID_REDIRECT_URI` **exactly**, including `http/https` and trailing slashes |
| "Missing environment variables" warning on startup | You haven't filled in `.env` yet — see Step 2 |
| Login loops back to `/` | Session cookie isn't persisting — check `SESSION_SECRET` is set and, if deployed behind a proxy, add `app.set('trust proxy', 1)` |
