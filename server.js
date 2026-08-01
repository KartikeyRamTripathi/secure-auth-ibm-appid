/**
 * Secure User Authentication for Web Apps with IBM Cloud App ID
 * -----------------------------------------------------------------
 * Full working Express app using the official IBM Cloud App ID
 * Node.js SDK + Passport.js (OpenID Connect / OAuth 2.0 flow).
 *
 * Flow:
 *   1. User lands on "/"  -> custom branded login page
 *   2. Clicks "Login with IBM App ID" -> redirected to IBM's
 *      hosted login (Cloud Directory / Google / Facebook, etc.
 *      depending on what you enabled in the App ID dashboard)
 *   3. IBM redirects back to /ibm/cloud/appid/callback
 *   4. Passport verifies the token, session is created
 *   5. User lands on protected "/dashboard" showing their profile
 *   6. "/logout" clears the session (WebAppStrategy.logout)
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const WebAppStrategy = require('ibmcloud-appid').WebAppStrategy;

const app = express();

// ---------- Basic config validation ----------
const REQUIRED_ENV = [
  'APPID_TENANT_ID',
  'APPID_CLIENT_ID',
  'APPID_SECRET',
  'APPID_OAUTH_SERVER_URL',
  'APPID_REDIRECT_URI',
  'SESSION_SECRET'
];

const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn(
    `\n⚠️  Missing environment variables: ${missing.join(', ')}\n` +
    `   Copy .env.example to .env and fill in your IBM Cloud App ID credentials.\n` +
    `   The app will still start so you can view the UI, but login will fail until configured.\n`
  );
}

// ---------- View engine ----------
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));

// ---------- Session (required by WebAppStrategy) ----------
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-in-.env',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // set true behind HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24h
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// ---------- Passport + App ID strategy ----------
passport.use(new WebAppStrategy({
  tenantId: process.env.APPID_TENANT_ID,
  clientId: process.env.APPID_CLIENT_ID,
  secret: process.env.APPID_SECRET,
  oauthServerUrl: process.env.APPID_OAUTH_SERVER_URL,
  redirectUri: process.env.APPID_REDIRECT_URI
}));

passport.serializeUser((user, cb) => cb(null, user));
passport.deserializeUser((user, cb) => cb(null, user));

// ---------- Middleware ----------
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.redirect('/');
}

// ---------- Routes ----------

// Landing / custom login page (matches the gradient card UI)
app.get('/', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('login', {
    configured: missing.length === 0,
    error: req.query.error || null
  });
});

// Kick off the IBM App ID OAuth flow
app.get('/login', passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
  successRedirect: '/dashboard',
  forceLogin: true
}));

// IBM App ID redirects back here after the user signs in
app.get('/ibm/cloud/appid/callback',
  passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
    failureRedirect: '/?error=auth_failed'
  })
);

// Protected dashboard — shows the authenticated user's profile
app.get('/dashboard', ensureAuthenticated, (req, res) => {
  const identity = req.user || {};
  res.render('dashboard', {
    name: identity.name || identity.given_name || identity.email || 'User',
    email: identity.email || 'Not provided',
    picture: identity.picture || null,
    identityProvider: (identity.identities && identity.identities[0] &&
      identity.identities[0].provider) || 'cloud_directory',
    subject: identity.sub || 'N/A'
  });
});

// Sample protected "API" route to demonstrate token-based protection
app.get('/api/profile', ensureAuthenticated, (req, res) => {
  res.json({ user: req.user });
});

// Logout — clears local session AND IBM App ID SSO session
app.get('/logout', (req, res) => {
  WebAppStrategy.logout(req);
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    code: 404,
    message: 'Page not found'
  });
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    code: 500,
    message: 'Something went wrong. Check server logs.'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀  Server running at http://localhost:${PORT}`);
  console.log(`   Login page:  http://localhost:${PORT}/`);
});
