import 'dotenv/config'
import express from 'express'
import session from 'express-session'

const app = express()
const PORT = Number(process.env.PORT ?? 3003)
const BACKOFFICE_URL = process.env.BACKOFFICE_URL ?? 'http://localhost:3002'
const VISUALIZER_URL = process.env.VISUALIZER_URL ?? 'http://localhost:3001'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? ''
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

declare module 'express-session' {
  interface SessionData { authed?: boolean }
}

app.use(express.json())
app.use(session({
  secret: process.env.SESSION_SECRET ?? 'admin-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 },
}))

// ─── Auth ─────────────────────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { password } = req.body as { password?: string }
  if (!ADMIN_SECRET || password !== ADMIN_SECRET) {
    res.status(401).json({ error: 'Invalid password' }); return
  }
  req.session.authed = true
  res.json({ ok: true })
})

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }))
})

app.get('/api/me', (req, res) => {
  res.json({ authed: req.session.authed === true })
})

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!req.session.authed) { res.status(401).json({ error: 'Not authenticated' }); return }
  next()
}

// ─── Merchants ────────────────────────────────────────────────────────────────

function backofficeHeaders() {
  return INTERNAL_SECRET ? { 'x-internal-secret': INTERNAL_SECRET } : {}
}

app.get('/api/merchants', requireAuth, async (_req, res) => {
  try {
    const upstream = await fetch(`${BACKOFFICE_URL}/api/internal/merchants`, {
      headers: backofficeHeaders(),
    })
    res.status(upstream.status).json(await upstream.json())
  } catch {
    res.status(502).json({ error: 'Backoffice unavailable' })
  }
})

app.patch('/api/merchants/:shop/active', requireAuth, async (req, res) => {
  const shop = req.params['shop'] as string
  const { active } = req.body as { active: boolean }
  try {
    const upstream = await fetch(`${BACKOFFICE_URL}/api/internal/merchants/${encodeURIComponent(shop)}/active`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...backofficeHeaders() },
      body: JSON.stringify({ active }),
    })
    res.status(upstream.status).json(await upstream.json())
  } catch {
    res.status(502).json({ error: 'Backoffice unavailable' })
  }
})

// ─── Model config ─────────────────────────────────────────────────────────────

function visualizerHeaders() {
  return INTERNAL_SECRET ? { 'x-internal-secret': INTERNAL_SECRET } : {}
}

app.get('/api/model-config', requireAuth, async (_req, res) => {
  try {
    const upstream = await fetch(`${VISUALIZER_URL}/api/internal/model-config`, {
      headers: visualizerHeaders(),
    })
    res.status(upstream.status).json(await upstream.json())
  } catch {
    res.status(502).json({ error: 'Visualizer unavailable' })
  }
})

app.patch('/api/model-config', requireAuth, async (req, res) => {
  try {
    const upstream = await fetch(`${VISUALIZER_URL}/api/internal/model-config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...visualizerHeaders() },
      body: JSON.stringify(req.body),
    })
    res.status(upstream.status).json(await upstream.json())
  } catch {
    res.status(502).json({ error: 'Visualizer unavailable' })
  }
})

app.get('/api/model-usage', requireAuth, async (req, res) => {
  const since = req.query.since as string | undefined
  const url = `${VISUALIZER_URL}/api/internal/model-usage${since ? `?since=${encodeURIComponent(since)}` : ''}`
  try {
    const upstream = await fetch(url, { headers: visualizerHeaders() })
    res.status(upstream.status).json(await upstream.json())
  } catch {
    res.status(502).json({ error: 'Visualizer unavailable' })
  }
})

// ─── Asset config ─────────────────────────────────────────────────────────────

app.get('/api/asset-config', requireAuth, async (_req, res) => {
  try {
    const upstream = await fetch(`${BACKOFFICE_URL}/api/internal/asset-config`, {
      headers: backofficeHeaders(),
    })
    res.status(upstream.status).json(await upstream.json())
  } catch {
    res.status(502).json({ error: 'Backoffice unavailable' })
  }
})

app.patch('/api/asset-config', requireAuth, async (req, res) => {
  try {
    const upstream = await fetch(`${BACKOFFICE_URL}/api/internal/asset-config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...backofficeHeaders() },
      body: JSON.stringify(req.body),
    })
    res.status(upstream.status).json(await upstream.json())
  } catch {
    res.status(502).json({ error: 'Backoffice unavailable' })
  }
})

app.get('/api/asset-stats', requireAuth, async (req, res) => {
  const since = req.query.since as string | undefined
  const url = `${BACKOFFICE_URL}/api/internal/asset-stats${since ? `?since=${encodeURIComponent(since)}` : ''}`
  try {
    const upstream = await fetch(url, { headers: backofficeHeaders() })
    res.status(upstream.status).json(await upstream.json())
  } catch {
    res.status(502).json({ error: 'Backoffice unavailable' })
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.info(`[admin] server listening on http://localhost:${PORT}`)
})
