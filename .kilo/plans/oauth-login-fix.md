# OAuth Login Fix

## Issues Discovered

1. **`.env.production` has incorrect redirect URI** - Points to `http://10.42.0.1:3002` without `/bot` path and wrong IP/port, causing OAuth callback to fail.

2. **`.env.example` has incorrect redirect URI** - Points to `http://10.42.0.1:3002/redirect` without `/bot` path and wrong IP/port.

3. **`allowedDevOrigins` missing localhost** - `next.config.js` only includes IP addresses, missing `localhost` needed for local development.

## Fixes Applied

### 1. Fixed `.env.production` redirect URI
Changed from:
```
NEXT_PUBLIC_DERIV_REDIRECT_URI=http://10.42.0.1:3002
```
To:
```
NEXT_PUBLIC_DERIV_REDIRECT_URI=http://10.42.0.131:3000/bot
```

### 2. Fixed `.env.example` redirect URI
Changed from:
```
NEXT_PUBLIC_DERIV_REDIRECT_URI=http://10.42.0.1:3002/redirect
```
To:
```
NEXT_PUBLIC_DERIV_REDIRECT_URI=http://10.42.0.131:3000/bot
```

### 3. Added localhost to allowedDevOrigins
Changed from:
```js
allowedDevOrigins: ['10.42.0.1', '10.42.0.131']
```
To:
```js
allowedDevOrigins: ['localhost', '10.42.0.1', '10.42.0.131']
```

## Validation

- Dev server starts successfully
- OAuth flow properly redirects to `/bot` endpoint