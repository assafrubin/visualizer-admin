import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Merchant {
  shopDomain: string
  shopName?: string
  shopEmail?: string
  active: boolean
  connected: boolean
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
  const [deleting, setDeleting] = useState<string | null>(null)
  const [settingToken, setSettingToken] = useState<string | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [savingToken, setSavingToken] = useState(false)
  const [tokenError, setTokenError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addDomain, setAddDomain] = useState('')
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

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

  async function addMerchant(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch('/api/merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopDomain: addDomain, shopName: addName || undefined, shopEmail: addEmail || undefined }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setAddError(data.error ?? 'Failed to add merchant'); return }
      setShowAdd(false)
      setAddDomain('')
      setAddName('')
      setAddEmail('')
      await load()
    } catch {
      setAddError('Could not reach server')
    } finally {
      setAdding(false)
    }
  }

  async function saveToken(shopDomain: string) {
    setSavingToken(true)
    setTokenError('')
    try {
      const res = await fetch(`/api/merchants/${encodeURIComponent(shopDomain)}/token`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: tokenInput }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setTokenError(data.error ?? 'Failed to save token'); return }
      setSettingToken(null)
      setTokenInput('')
      await load()
    } catch {
      setTokenError('Could not reach server')
    } finally {
      setSavingToken(false)
    }
  }

  async function confirmDelete(merchant: Merchant) {
    if (!window.confirm(`Delete "${merchant.shopName ?? merchant.shopDomain}"?\n\nThis removes all their data and immediately disables the widget on their store.`)) return
    setDeleting(merchant.shopDomain)
    try {
      const res = await fetch(`/api/merchants/${encodeURIComponent(merchant.shopDomain)}`, { method: 'DELETE' })
      if (!res.ok) { setError('Failed to delete merchant'); return }
      setMerchants(prev => prev.filter(m => m.shopDomain !== merchant.shopDomain))
    } catch {
      setError('Could not reach server')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <div className="page-title-row">
        <h1 className="page-title">Merchants</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" onClick={() => setShowAdd(v => !v)}>+ Add merchant</button>
          <button className="btn-outline" onClick={load} disabled={loading}>↻ Refresh</button>
        </div>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14 }}>Add merchant</h3>
          <form onSubmit={addMerchant} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              className="login-input"
              placeholder="Shop domain (e.g. my-store.myshopify.com)"
              value={addDomain}
              onChange={e => setAddDomain(e.target.value)}
              required
              autoFocus
            />
            <input
              className="login-input"
              placeholder="Store name (optional)"
              value={addName}
              onChange={e => setAddName(e.target.value)}
            />
            <input
              className="login-input"
              placeholder="Email (optional)"
              type="email"
              value={addEmail}
              onChange={e => setAddEmail(e.target.value)}
            />
            {addError && <p className="login-error" style={{ margin: 0 }}>{addError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="login-btn" type="submit" disabled={adding || !addDomain.trim()} style={{ flex: 1 }}>
                {adding ? 'Adding…' : 'Add merchant'}
              </button>
              <button type="button" className="btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

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
                <th>Status</th>
                <th>Collections</th>
                <th>Installed</th>
                <th>Widget</th>
                <th></th>
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
                    {m.connected
                      ? <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: 13 }}>✓ Connected</span>
                      : settingToken === m.shopDomain
                        ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
                            <input
                              className="login-input"
                              placeholder="shpat_..."
                              value={tokenInput}
                              onChange={e => setTokenInput(e.target.value)}
                              autoFocus
                              style={{ fontSize: 12, padding: '4px 8px' }}
                            />
                            {tokenError && <span style={{ fontSize: 11, color: 'var(--color-error, #e53e3e)' }}>{tokenError}</span>}
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn-outline" style={{ fontSize: 11, padding: '2px 8px' }} disabled={savingToken || !tokenInput.trim()} onClick={() => saveToken(m.shopDomain)}>
                                {savingToken ? '…' : 'Save'}
                              </button>
                              <button className="btn-outline" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => { setSettingToken(null); setTokenInput(''); setTokenError('') }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        )
                        : (
                          <button className="btn-outline" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => { setSettingToken(m.shopDomain); setTokenInput(''); setTokenError('') }}>
                            Set access token
                          </button>
                        )
                    }
                  </td>
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
                  <td>
                    <button
                      className="btn-outline"
                      style={{ fontSize: 12, padding: '3px 10px', color: 'var(--color-error, #e53e3e)' }}
                      disabled={deleting === m.shopDomain}
                      onClick={() => confirmDelete(m)}
                    >
                      {deleting === m.shopDomain ? '…' : 'Delete'}
                    </button>
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

// ─── Render timings panel ─────────────────────────────────────────────────────

interface TimingAggregates {
  count: number
  avg_queue_wait_ms: number | null
  avg_cutout_fetch_ms: number | null
  avg_provider_ms: number | null
  avg_total_server_ms: number | null
  avg_brief_ms: number | null
  avg_submit_ms: number | null
  avg_poll_wait_ms: number | null
  avg_total_client_ms: number | null
}
interface TimingByDay { day: string; count: number; avg_server_ms: number | null; avg_client_ms: number | null }
interface TimingRow {
  job_id: string; shop_domain: string | null; model: string | null; status: string
  queue_wait_ms: number | null; cutout_fetch_ms: number | null; provider_ms: number | null; total_server_ms: number | null
  brief_ms: number | null; submit_ms: number | null; poll_wait_ms: number | null; total_client_ms: number | null
  created_at: string
}
interface TimingStats { aggregates: TimingAggregates; byDay: TimingByDay[]; recent: TimingRow[] }

function fmtMs(v: number | null | undefined): string {
  if (v == null) return '—'
  return v < 1000 ? `${Math.round(v)}ms` : `${(v / 1000).toFixed(2)}s`
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '12px 16px', minWidth: 130 }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function RenderTimingsPanel() {
  const [stats, setStats] = useState<TimingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/render-timings')
      if (!res.ok) throw new Error('Failed to load')
      setStats(await res.json() as TimingStats)
    } catch { setError('Could not load render timings') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="empty">Loading…</div>
  if (error || !stats) return <div className="alert">{error ?? 'No data'}</div>

  const { aggregates: agg, byDay, recent } = stats

  return (
    <div>
      <div className="page-title-row">
        <h1 className="page-title">Render Timings</h1>
        <button className="btn-outline" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      {agg.count === 0 ? <div className="empty">No completed renders recorded yet.</div> : (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-section-title">Server stages — avg over {agg.count} succeeded renders (last 30 days)</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
              <StatCard label="Queue wait"   value={fmtMs(agg.avg_queue_wait_ms)}   sub="job created → processing" />
              <StatCard label="Cutout fetch" value={fmtMs(agg.avg_cutout_fetch_ms)} sub="fetch PNG from backoffice" />
              <StatCard label="Provider"     value={fmtMs(agg.avg_provider_ms)}     sub="Gemini API call" />
              <StatCard label="Server total" value={fmtMs(agg.avg_total_server_ms)} sub="queue → image written" />
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-section-title">Client stages — user-perceived latency</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
              <StatCard label="Brief"        value={fmtMs(agg.avg_brief_ms)}        sub="confirm → brief returned" />
              <StatCard label="Submit"       value={fmtMs(agg.avg_submit_ms)}       sub="render job POST roundtrip" />
              <StatCard label="Poll wait"    value={fmtMs(agg.avg_poll_wait_ms)}    sub="submitted → succeeded" />
              <StatCard label="Client total" value={fmtMs(agg.avg_total_client_ms)} sub="confirm click → job ready" />
            </div>
          </div>

          {byDay.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-section-title">Daily averages</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead><tr><th>Date</th><th style={{ textAlign: 'right' }}>Renders</th><th style={{ textAlign: 'right' }}>Server total</th><th style={{ textAlign: 'right' }}>Client total</th></tr></thead>
                  <tbody>
                    {byDay.map(d => (
                      <tr key={d.day}>
                        <td className="muted">{d.day}</td>
                        <td style={{ textAlign: 'right' }}>{d.count}</td>
                        <td style={{ textAlign: 'right' }}>{fmtMs(d.avg_server_ms)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtMs(d.avg_client_ms)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div className="card">
              <div className="card-section-title">Recent renders (last 30)</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Job</th><th>Shop</th><th>Status</th>
                      <th style={{ textAlign: 'right' }}>Queue</th>
                      <th style={{ textAlign: 'right' }}>Cutout</th>
                      <th style={{ textAlign: 'right' }}>Provider</th>
                      <th style={{ textAlign: 'right' }}>Server</th>
                      <th style={{ textAlign: 'right' }}>Brief</th>
                      <th style={{ textAlign: 'right' }}>Submit</th>
                      <th style={{ textAlign: 'right' }}>Poll</th>
                      <th style={{ textAlign: 'right' }}>Client</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(r => (
                      <tr key={r.job_id} className={r.status === 'failed' ? 'row-inactive' : ''}>
                        <td className="mono" style={{ fontSize: 11 }}>{r.job_id.slice(0, 8)}</td>
                        <td className="muted" style={{ fontSize: 11 }}>{r.shop_domain ?? '—'}</td>
                        <td><span style={{ color: r.status === 'succeeded' ? '#16a34a' : r.status === 'failed' ? '#dc2626' : '#888' }}>{r.status}</span></td>
                        <td style={{ textAlign: 'right' }}>{fmtMs(r.queue_wait_ms)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtMs(r.cutout_fetch_ms)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtMs(r.provider_ms)}</td>
                        <td style={{ textAlign: 'right' }}><strong>{fmtMs(r.total_server_ms)}</strong></td>
                        <td style={{ textAlign: 'right' }}>{fmtMs(r.brief_ms)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtMs(r.submit_ms)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtMs(r.poll_wait_ms)}</td>
                        <td style={{ textAlign: 'right' }}><strong>{fmtMs(r.total_client_ms)}</strong></td>
                        <td className="muted" style={{ fontSize: 11 }}>{new Date(r.created_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Users panel ─────────────────────────────────────────────────────────────

interface BackofficeUser {
  id: string
  email: string
  role: string
  status: 'pending' | 'active'
  stores: string[]
  createdAt: string
}

function UsersPanel() {
  const [users, setUsers] = useState<BackofficeUser[]>([])
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newStores, setNewStores] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStores, setEditStores] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [usersRes, merchantsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/merchants-list'),
      ])
      if (!usersRes.ok) throw new Error('Failed to load users')
      const ud = await usersRes.json() as { users: BackofficeUser[] }
      setUsers(ud.users)
      if (merchantsRes.ok) {
        const md = await merchantsRes.json() as { merchants: Merchant[] }
        setMerchants(md.merchants)
      }
    } catch { setError('Could not load users') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setError(null)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, shopDomains: newStores }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? 'Failed to create user')
      }
      setNewEmail(''); setNewStores([])
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally { setCreating(false) }
  }

  async function resendInvite(userId: string) {
    await fetch(`/api/users/${encodeURIComponent(userId)}/resend-invite`, { method: 'POST' })
    alert('Invite resent')
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`Delete user ${email}?`)) return
    await fetch(`/api/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })
    await load()
  }

  function startEdit(user: BackofficeUser) {
    setEditingId(user.id)
    setEditStores([...user.stores])
  }

  async function saveEdit() {
    if (!editingId) return
    setSaving(true)
    try {
      await fetch(`/api/users/${encodeURIComponent(editingId)}/stores`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopDomains: editStores }),
      })
      setEditingId(null)
      await load()
    } finally { setSaving(false) }
  }

  function toggleNewStore(domain: string) {
    setNewStores(prev => prev.includes(domain) ? prev.filter(d => d !== domain) : [...prev, domain])
  }

  function toggleEditStore(domain: string) {
    setEditStores(prev => prev.includes(domain) ? prev.filter(d => d !== domain) : [...prev, domain])
  }

  return (
    <div>
      <div className="page-title-row">
        <h1 className="page-title">Merchant Users</h1>
        <button className="btn-outline" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      {error && <div className="alert">{error}</div>}

      {/* Create user form */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-section-title">Invite new merchant</div>
        <form onSubmit={createUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="config-label">Email address</label>
            <input
              className="config-select"
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              required
              placeholder="merchant@example.com"
              style={{ width: '100%' }}
            />
          </div>
          {merchants.length > 0 && (
            <div>
              <label className="config-label">Grant access to stores</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {merchants.map(m => (
                  <label key={m.shopDomain} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={newStores.includes(m.shopDomain)} onChange={() => toggleNewStore(m.shopDomain)} />
                    {m.shopName ?? m.shopDomain} <span className="muted">({m.shopDomain})</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <button className="btn-primary" type="submit" disabled={creating || !newEmail}>
              {creating ? 'Sending invite…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>

      {/* Users table */}
      {loading ? (
        <div className="empty">Loading…</div>
      ) : users.length === 0 ? (
        <div className="empty">No merchant users yet.</div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Stores</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>
                    <span style={{ color: user.status === 'active' ? '#16a34a' : '#888' }}>
                      {user.status === 'active' ? 'Active' : 'Pending invite'}
                    </span>
                  </td>
                  <td>
                    {editingId === user.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {merchants.map(m => (
                          <label key={m.shopDomain} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                            <input type="checkbox" checked={editStores.includes(m.shopDomain)} onChange={() => toggleEditStore(m.shopDomain)} />
                            {m.shopName ?? m.shopDomain}
                          </label>
                        ))}
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                          <button className="btn-primary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={saveEdit} disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button className="btn-outline" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>
                        {user.stores.length === 0 ? 'None' : user.stores.join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {editingId !== user.id && (
                        <button className="btn-outline" style={{ fontSize: 12, padding: '3px 8px' }} onClick={() => startEdit(user)}>Edit stores</button>
                      )}
                      {user.status === 'pending' && (
                        <button className="btn-outline" style={{ fontSize: 12, padding: '3px 8px' }} onClick={() => resendInvite(user.id)}>Resend invite</button>
                      )}
                      <button className="btn-outline" style={{ fontSize: 12, padding: '3px 8px', color: '#dc2626', borderColor: '#dc2626' }} onClick={() => deleteUser(user.id, user.email)}>Delete</button>
                    </div>
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

// ─── Dashboard (tabs) ─────────────────────────────────────────────────────────

type Tab = 'merchants' | 'users' | 'model' | 'assets' | 'timings'

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
            className={`nav-tab ${tab === 'users' ? 'nav-tab-active' : ''}`}
            onClick={() => setTab('users')}
          >
            Users
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
          <button
            className={`nav-tab ${tab === 'timings' ? 'nav-tab-active' : ''}`}
            onClick={() => setTab('timings')}
          >
            Render Timings
          </button>
        </nav>
        <button className="btn-ghost" onClick={logout}>Sign out</button>
      </header>

      <main className="main">
        {tab === 'merchants' && <MerchantsPanel />}
        {tab === 'users'     && <UsersPanel />}
        {tab === 'model'     && <ModelConfigPanel />}
        {tab === 'assets'    && <AssetProcessingPanel />}
        {tab === 'timings'   && <RenderTimingsPanel />}
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
