# Astra OAuth setup

The backend uses direct OAuth 2.0 authorization-code flows. Google and Facebook can be configured independently. Create separate development and production apps where possible. Keep all client secrets in local `.env` or Render environment variables, never in Git or frontend JavaScript.

## Google

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), configure an OAuth consent screen and create an **OAuth client ID** of type **Web application**. Add test users while the consent screen is in testing mode.
2. Register exact authorized redirect URIs:
   - Local: `http://localhost:3000/api/v1/auth/google/callback`
   - Render: `https://ie104-r11-cnvn-group13-be.onrender.com/api/v1/auth/google/callback`
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` to the values for that environment. The callback URL must match the registered URI exactly.

Astra requests `openid email profile`. It links an existing Astra account by email only if Google returns `email_verified=true`. See [Google's OpenID Connect guide](https://developers.google.com/identity/openid-connect/openid-connect).

## Facebook

1. In [Meta for Developers](https://developers.facebook.com/apps/), create an app with **Facebook Login** for the web. Configure the app domain and privacy policy as required by Meta before public use, and add app testers while the app is in development mode.
2. In Facebook Login settings, register exact **Valid OAuth Redirect URIs**:
   - Local: `http://localhost:3000/api/v1/auth/facebook/callback` (if the app settings reject plain HTTP, use an HTTPS development tunnel and put its exact callback URL in `FACEBOOK_CALLBACK_URL`)
   - Render: `https://ie104-r11-cnvn-group13-be.onrender.com/api/v1/auth/facebook/callback`
3. Set `FACEBOOK_APP_ID`, `FACEBOOK_CLIENT_SECRET` (the app secret), `FACEBOOK_CALLBACK_URL`, and `FACEBOOK_GRAPH_VERSION` for that environment. The code requests `email,public_profile`; a Facebook account may still have no email available.

Meta's user endpoint supplies an email field but no verified-email signal that Astra can use for automatic account linking. If the email matches an existing Astra account, show the FE login prompt. Once signed in, start `/api/v1/auth/facebook/link`; the callback keeps the existing account's session and adds the provider link. See [Meta Graph API](https://developers.facebook.com/docs/graph-api/get-started/).

## FE and deployment

Set `FRONTEND_ORIGIN` to the exact FE origin and `FRONTEND_URL` to its page base URL. The FE deployment URL was not available in this workspace and must be supplied before deployment. Set `JWT_SECRET` to a new random value of at least 32 bytes. Use HTTPS for production FE and BE so Secure cookies can be stored. The FE calls API endpoints with `credentials: 'include'`; the server replies with `Access-Control-Allow-Credentials: true` only to the configured origin. OAuth start and callback are browser navigations; the callback redirects to the FE page. For an existing Facebook email, it redirects to `login.html?auth_error=ACCOUNT_LINK_REQUIRED&provider=facebook` and includes a `returnTo` parameter when the start request supplied one. The FE must render that state and, after successful Astra sign-in, navigate to the Facebook link endpoint.

The provider flow cannot be tested end to end without configured Google and Meta apps, their secrets, and a reachable callback URL. Do not put those secrets into test files or issue screenshots.
