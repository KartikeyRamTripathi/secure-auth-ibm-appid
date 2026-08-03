require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const WebAppStrategy = require('ibmcloud-appid').WebAppStrategy;

const app = express();

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
    `Missing env vars: ${missing.join(', ')}. Copy .env.example to .env and fill it in — login won't work until you do.`
  );
}

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-in-.env',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24h
  }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new WebAppStrategy({
  tenantId: process.env.APPID_TENANT_ID,
  clientId: process.env.APPID_CLIENT_ID,
  secret: process.env.APPID_SECRET,
  oauthServerUrl: process.env.APPID_OAUTH_SERVER_URL,
  redirectUri: process.env.APPID_REDIRECT_URI
}));

passport.serializeUser((user, cb) => cb(null, user));
passport.deserializeUser((user, cb) => cb(null, user));

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.redirect('/');
}

app.get('/', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('login', {
    configured: missing.length === 0,
    error: req.query.error || null
  });
});

// forceLogin makes IBM always show the login screen instead of
// silently reusing an existing SSO session — handy while testing
app.get('/login', passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
  successRedirect: '/dashboard',
  forceLogin: true
}));

app.get('/ibm/cloud/appid/callback',
  passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
    failureRedirect: '/?error=auth_failed'
  })
);

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

app.get('/api/profile', ensureAuthenticated, (req, res) => {
  res.json({ user: req.user });
});

app.get('/logout', (req, res) => {
  WebAppStrategy.logout(req);
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.use((req, res) => {
  res.status(404).render('error', {
    code: 404,
    message: 'Page not found'
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    code: 500,
    message: 'Something went wrong. Check server logs.'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});