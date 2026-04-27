import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Merchant {
  shopDomain: string
  shopName?: string
  shopEmail?: string
  active: boolean
  installedAt?: string
  enabledCollections: number
  totalCollections: number
}

interface ModelOption {
  id: string
  label: string
}

interface ModelConfig {
  defaultModel: string
  fallbackModel: string
  availableModels: ModelOption[]
}

interface ModelUsagePoint {
  day: string
  render_model: string
  count: number
}

interface AssetModelOption {
  id: string
  label: string
}

interface AssetConfig {
  assetModel: string
  availableAssetModels: AssetModelOption[]
}

interface AssetStatPoint {
  day: string
  model: string
  count: number
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) { setError('Invalid password'); return }
      onLogin()
    } catch {
      setError('Could not reach server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">VIR Admin</div>
        <form onSubmit={submit}>
          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="login-error">{error}</p>}
          <button className="login-btn" type="submit" disabled={loading || !password}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Merchants table ──────────────────────────────────────────────────────────

function MerchantsPanel({ }: object) {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/merchants')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json() as { merchants: Merchant[] }
      setMerchants(data.merchants)
    } catch {
      setError('Could not load merchants')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle(merchant: Merchant) {
    setToggling(prev => new Set(prev).add(merchant.shopDomain))
    try {
      const res = await fetch(`/api/merchants/${encodeURIComponent(merchant.shopDomain)}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !merchant.active }),
      })
      if (!res.ok) throw new Error()
      setMerchants(prev =>
        prev.map(m => m.shopDomain === merchant.shopDomain ? { ...m, active: !m.active } : m)
      )
    } catch {
      setError('Failed to update merchant')
    } finally {
      setToggling(prev => { const s = new Set(prev); s.delete(merchant.shopDomain); return s })
    }
  }

  return (
    <div>
      <div className="page-title-row">
        <h1 className="page-title">Merchants</h1>
        <button className="btn-outline" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <div className="empty">Loading…</div>
      ) : merchants.length === 0 ? (
        <div className="empty">No merchants connected yet.</div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Store</th>
                <th>Domain</th>
                <th>Collections</th>
                <th>Installed</th>
                <th>Widget</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map(m => (
                <tr key={m.shopDomain} className={m.active ? '' : 'row-inactive'}>
                  <td>
                    <div className="store-name">{m.shopName ?? m.shopDomain}</div>
                    {m.shopEmail && <div className="store-email">{m.shopEmail}</div>}
                  </td>
                  <td className="mono">{m.shopDomain}</td>
                  <td>
                    {m.totalCollections === 0
                      ? <span className="muted">—</span>
                      : <><strong>{m.enabledCollections}</strong> / {m.totalCollections} enabled</>
                    }
                  </td>
                  <td className="muted">
                    {m.installedAt ? new Date(m.installedAt).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <label className="toggle" title={m.active ? 'Disable widget' : 'Enable widget'}>
                      <input
                        type="checkbox"
                        checked={m.active}
                        disabled={toggling.has(m.shopDomain)}
                        onChange={() => toggle(m)}
                      />
                      <span className="toggle-track" />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Model config panel ───────────────────────────────────────────────────────

function ModelConfigPanel() {
  const [config, setConfig] = useState<ModelConfig | null>(null)
  const [usage, setUsage] = useState<ModelUsagePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)

  const [pendingDefault, setPendingDefault] = useState('')
  const [pendingFallback, setPendingFallback] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [configRes, usageRes] = await Promise.all([
        fetch('/api/model-config'),
        fetch('/api/model-usage'),
      ])
      if (!configRes.ok) throw new Error('Failed to load model config')
      const cfg = await configRes.json() as ModelConfig
      setConfig(cfg)
      setPendingDefault(cfg.defaultModel)
      setPendingFallback(cfg.fallbackModel)

      if (usageRes.ok) {
        const u = await usageRes.json() as { usage: ModelUsagePoint[] }
        setUsage(u.usage)
      }
    } catch {
      setError('Could not load model configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/model-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultModel: pendingDefault, fallbackModel: pendingFallback }),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated = await res.json() as ModelConfig
      setConfig(prev => prev ? { ...prev, ...updated } : updated)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2000)
    } catch {
      setError('Failed to save model config')
    } finally {
      setSaving(false)
    }
  }

  // Build per-model totals and per-day series for the simple table
  const modelTotals = usage.reduce<Record<string, number>>((acc, pt) => {
    acc[pt.render_model] = (acc[pt.render_model] ?? 0) + pt.count
    return acc
  }, {})

  // Get unique sorted days for the timeline table
  const days = [...new Set(usage.map(p => p.day))].sort()
  const models = [...new Set(usage.map(p => p.render_model))].sort()
  const byDayModel = usage.reduce<Record<string, Record<string, number>>>((acc, pt) => {
    if (!acc[pt.day]) acc[pt.day] = {}
    acc[pt.day][pt.render_model] = pt.count
    return acc
  }, {})

  const isDirty = config && (pendingDefault !== config.defaultModel || pendingFallback !== config.fallbackModel)

  if (loading) return <div className="empty">Loading…</div>
  if (!config) return <div className="alert">{error ?? 'Could not load config'}</div>

  return (
    <div>
      <div className="page-title-row">
        <h1 className="page-title">Image Model</h1>
        <button className="btn-outline" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      {error && <div className="alert">{error}</div>}

      {/* Current config */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-section-title">Active Configuration</div>
        <div className="config-grid">
          <div className="config-field">
            <label className="config-label">Default model</label>
            <select
              className="config-select"
              value={pendingDefault}
              onChange={e => setPendingDefault(e.target.value)}
            >
              {config.availableModels.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="config-field">
            <label className="config-label">Fallback model</label>
            <select
              className="config-select"
              value={pendingFallback}
              onChange={e => setPendingFallback(e.target.value)}
            >
              {config.availableModels.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="config-actions">
          <button
            className="btn-primary"
            onClick={save}
            disabled={saving || !isDirty}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {savedMsg && <span className="saved-badge">Saved</span>}
        </div>
      </div>

      {/* Per-model totals */}
      {Object.keys(modelTotals).length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-section-title">Requests by Model (last 30 days)</div>
          <table className="table">
            <thead>
              <tr>
                <th>Model</th>
                <th style={{ textAlign: 'right' }}>Requests</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(modelTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([model, count]) => (
                  <tr key={model}>
                    <td className="mono">{model}</td>
                    <td style={{ textAlign: 'right' }}><strong>{count}</strong></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Daily breakdown */}
      {days.length > 0 && (
        <div className="card">
          <div className="card-section-title">Daily Breakdown</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  {models.map(m => <th key={m} style={{ textAlign: 'right' }} className="mono">{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {days.map(day => (
                  <tr key={day}>
                    <td className="muted">{day}</td>
                    {models.map(m => (
                      <td key={m} style={{ textAlign: 'right' }}>
                        {byDayModel[day]?.[m] ?? <span className="muted">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {days.length === 0 && (
        <div className="empty">No render jobs recorded yet.</div>
      )}
    </div>
  )
}

// ─── Asset processing panel ───────────────────────────────────────────────────

function AssetProcessingPanel() {
  const [config, setConfig] = useState<AssetConfig | null>(null)
  const [stats, setStats] = useState<AssetStatPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)
  const [pendingModel, setPendingModel] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [configRes, statsRes] = await Promise.all([
        fetch('/api/asset-config'),
        fetch('/api/asset-stats'),
      ])
      if (!configRes.ok) throw new Error('Failed to load asset config')
      const cfg = await configRes.json() as AssetConfig
      setConfig(cfg)
      setPendingModel(cfg.assetModel)
      if (statsRes.ok) {
        const s = await statsRes.json() as { stats: AssetStatPoint[] }
        setStats(s.stats)
      }
    } catch {
      setError('Could not load asset configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/asset-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetModel: pendingModel }),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated = await res.json() as AssetConfig
      setConfig(prev => prev ? { ...prev, ...updated } : updated)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2000)
    } catch {
      setError('Failed to save asset config')
    } finally {
      setSaving(false)
    }
  }

  const modelTotals = stats.reduce<Record<string, number>>((acc, pt) => {
    acc[pt.model] = (acc[pt.model] ?? 0) + pt.count
    return acc
  }, {})

  const days = [...new Set(stats.map(p => p.day))].sort()
  const models = [...new Set(stats.map(p => p.model))].sort()
  const byDayModel = stats.reduce<Record<string, Record<string, number>>>((acc, pt) => {
    if (!acc[pt.day]) acc[pt.day] = {}
    acc[pt.day][pt.model] = pt.count
    return acc
  }, {})

  const isDirty = config && pendingModel !== config.assetModel

  if (loading) return <div className="empty">Loading…</div>
  if (!config) return <div className="alert">{error ?? 'Could not load config'}</div>

  return (
    <div>
      <div className="page-title-row">
        <h1 className="page-title">Asset Processing</h1>
        <button className="btn-outline" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-section-title">Background Removal Model</div>
        <div className="config-grid">
          <div className="config-field">
            <label className="config-label">Active model</label>
            <select
              className="config-select"
              value={pendingModel}
              onChange={e => setPendingModel(e.target.value)}
            >
              {config.availableAssetModels.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="config-actions">
          <button className="btn-primary" onClick={save} disabled={saving || !isDirty}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {savedMsg && <span className="saved-badge">Saved</span>}
        </div>
      </div>

      {Object.keys(modelTotals).length > 0 ? (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-section-title">Requests by Model (last 30 days)</div>
            <table className="table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th style={{ textAlign: 'right' }}>Cutouts generated</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(modelTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([model, count]) => (
                    <tr key={model}>
                      <td className="mono">{model}</td>
                      <td style={{ textAlign: 'right' }}><strong>{count}</strong></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {days.length > 0 && (
            <div className="card">
              <div className="card-section-title">Daily Breakdown</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      {models.map(m => <th key={m} style={{ textAlign: 'right' }} className="mono">{m}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(day => (
                      <tr key={day}>
                        <td className="muted">{day}</td>
                        {models.map(m => (
                          <td key={m} style={{ textAlign: 'right' }}>
                            {byDayModel[day]?.[m] ?? <span className="muted">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="empty">No asset processing requests recorded yet.</div>
      )}
    </div>
  )
}

// ─── Dashboard (tabs) ─────────────────────────────────────────────────────────

type Tab = 'merchants' | 'model' | 'assets'

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('merchants')

  async function logout() {
    await fetch('/api/logout', { method: 'POST' })
    onLogout()
  }

  return (
    <div className="page">
      <header className="header">
        <span className="header-logo">VIR Admin</span>
        <nav className="header-nav">
          <button
            className={`nav-tab ${tab === 'merchants' ? 'nav-tab-active' : ''}`}
            onClick={() => setTab('merchants')}
          >
            Merchants
          </button>
          <button
            className={`nav-tab ${tab === 'model' ? 'nav-tab-active' : ''}`}
            onClick={() => setTab('model')}
          >
            Image Model
          </button>
          <button
            className={`nav-tab ${tab === 'assets' ? 'nav-tab-active' : ''}`}
            onClick={() => setTab('assets')}
          >
            Asset Processing
          </button>
        </nav>
        <button className="btn-ghost" onClick={logout}>Sign out</button>
      </header>

      <main className="main">
        {tab === 'merchants' && <MerchantsPanel />}
        {tab === 'model'     && <ModelConfigPanel />}
        {tab === 'assets'    && <AssetProcessingPanel />}
      </main>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json() as Promise<{ authed: boolean }>)
      .then(d => setAuthed(d.authed))
      .catch(() => setAuthed(false))
  }, [])

  if (authed === null) return null
  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />
  return <Dashboard onLogout={() => setAuthed(false)} />
}
