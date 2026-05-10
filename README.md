# Admin

Internal admin dashboard for managing merchants across the View-in-Room platform. No database — all data proxied from backoffice and visualizer via internal APIs.

## Ports

| Process | Port | Command |
|---------|------|---------|
| Express API | 3003 | `npm run server` |
| Vite dev server | 5175 | `npm run dev` |
| Both | — | `npm run dev:full` |

## Key env vars

```
PORT=3003
ADMIN_SECRET=...          # single password for login
SESSION_SECRET=...        # session cookie signing key
BACKOFFICE_URL=...        # backoffice Express URL (e.g. http://localhost:3002)
VISUALIZER_URL=...        # visualizer Express URL (e.g. http://localhost:3001)
INTERNAL_SECRET=...       # forwarded as x-internal-secret to downstream services
```

## API surface

All endpoints except `/api/login` require an active session cookie.

### Auth
```
POST /api/login      { password } → sets session cookie (8h expiry)
POST /api/logout     Destroy session
GET  /api/me         Returns { ok: true } if authenticated
```

### Merchant management (proxied from backoffice)
```
GET   /api/merchants                    List all installed stores
PATCH /api/merchants/:shop/active       Enable or disable a merchant
```

### Model config (proxied from visualizer)
```
GET   /api/model-config      Current default + fallback image generation models
PATCH /api/model-config      Update models
GET   /api/model-usage       Usage stats by model and shop
```

### Asset config (proxied from backoffice)
```
GET   /api/asset-config      Current Gemini model used for cutout generation
PATCH /api/asset-config      Update asset model
GET   /api/asset-stats       Asset processing stats by day and model
```

## Key architectural decisions

- **Stateless proxy**: admin has no DB. It forwards all requests to backoffice (`/api/internal/*`) or visualizer (`/api/internal/*`) with `x-internal-secret` added.
- **Single-password auth**: session-based, not per-user. Intended for internal operators only.
- **No CORS complexity**: admin is same-origin (Vite proxies `/api` to Express), so no cross-origin setup needed.
