import './App.css'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LayoutDashboard, Rocket, FileText, Settings, Search, CheckCircle, Clock,
  BarChart3, PieChart as PieChartIcon, ArrowRight, ExternalLink, Download,
  ArrowLeft, BookOpen, User, Target, Zap, Shield, TrendingUp, ChevronDown,
  Wand2, Activity, AlertTriangle, Coffee, BarChart2, SortAsc, SortDesc,
  X, Link, ChevronRight, Filter, RefreshCw
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, FunnelChart, Funnel, LabelList, LineChart, Line,
  CartesianGrid
} from 'recharts'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ─── Helpers ────────────────────────────────────────────────────────────────

const CANONICAL_STATUSES = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP']

/** Parse "4.5/5", "4.5", or numeric score values safely */
function parseScore(raw) {
  if (!raw) return NaN
  const s = String(raw)
  const slashIdx = s.indexOf('/')
  const num = slashIdx !== -1 ? parseFloat(s.slice(0, slashIdx)) : parseFloat(s)
  return isNaN(num) ? NaN : num
}

function scoreColor(score) {
  if (score >= 4.5) return '#a6e3a1'  // green
  if (score >= 4.0) return '#89b4fa'  // blue
  if (score >= 3.5) return '#cba6f7'  // mauve
  if (score >= 3.0) return '#f9e2af'  // yellow
  return '#a6adc8'                     // subtext0
}

function scoreBadgeClass(score) {
  if (score >= 4.0) return 'badge badge-green'
  if (score >= 3.5) return 'badge badge-blue'
  if (score >= 3.0) return 'badge badge-yellow'
  return 'badge badge-dim'
}

/** Split story-bank markdown into named sections at ## headings */
function splitStoryBankSections(md) {
  if (!md) return []
  const lines = md.split('\n')
  const sections = []
  let current = null
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current)
      current = { title: line.slice(3).trim(), body: '' }
    } else if (current) {
      current.body += line + '\n'
    }
  }
  if (current) sections.push(current)
  return sections
}

// ─── Toast ──────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" onClick={() => onDismiss(t.id)}><X size={12} /></button>
        </div>
      ))}
    </div>
  )
}

let _toastId = 0
function useToast() {
  const [toasts, setToasts] = useState([])
  const add = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_toastId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])
  const dismiss = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), [])
  return { toasts, add, dismiss }
}

// ─── Main App ────────────────────────────────────────────────────────────────

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 780)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [data, setData] = useState([])
  const [pipelineData, setPipelineData] = useState({ items: [] })
  const [profile, setProfile] = useState(null)
  const [reports, setReports] = useState([])
  const [preps, setPreps] = useState([])
  const [diagnostics, setDiagnostics] = useState(null)
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportContent, setReportContent] = useState('')
  const [storyBank, setStoryBank] = useState('')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [tailoringId, setTailoringId] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [paletteIndex, setPaletteIndex] = useState(0)

  // Tracker controls
  const [trackerSearch, setTrackerSearch] = useState('')
  const [trackerStatus, setTrackerStatus] = useState('all')
  const [trackerSort, setTrackerSort] = useState({ key: 'id', dir: 'asc' })

  // Story bank open sections
  const [openSections, setOpenSections] = useState({})

  const { toasts, add: addToast, dismiss: dismissToast } = useToast()
  const paletteInputRef = useRef(null)

  // ── Data fetching ──────────────────────────────────────────────

  const fetchData = useCallback(() => {
    Promise.all([
      fetch('/api/applications').then(r => r.json()),
      fetch('/api/pipeline').then(r => r.json()),
      fetch('/api/reports').then(r => r.json()),
      fetch('/api/profile').then(r => r.json()),
      fetch('/api/story-bank').then(r => r.ok ? r.text() : '').catch(() => ''),
      fetch('/api/interview-prep').then(r => r.json()),
      fetch('/api/diagnostics').then(r => r.json()),
    ])
      .then(([apps, pipeline, reportsList, profileData, stories, prepList, health]) => {
        setData(Array.isArray(apps) ? apps : [])
        setPipelineData(pipeline || { items: [] })
        setReports(Array.isArray(reportsList) ? reportsList : [])
        setProfile(profileData)
        setStoryBank(stories)
        setPreps(Array.isArray(prepList) ? prepList : [])
        setDiagnostics(health)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch data:', err)
        setLoading(false)
      })
  }, [])

  // ── SSE live-reload ───────────────────────────────────────────

  useEffect(() => {
    fetchData()

    // Periodic health check
    const timer = setInterval(() => {
      fetch('/api/diagnostics').then(r => r.json()).then(setDiagnostics).catch(() => {})
    }, 30000)

    // SSE — refresh data on scan-complete or status-changed events
    let evtSource
    try {
      evtSource = new EventSource('/api/events')
      evtSource.addEventListener('scan-complete', () => {
        fetchData()
        addToast('Scan complete — pipeline refreshed', 'success')
      })
      evtSource.addEventListener('status-changed', () => fetchData())
      evtSource.onerror = () => evtSource.close()
    } catch (e) { /* SSE not available in all environments */ }

    // Theme sync
    if (theme === 'light') document.documentElement.classList.add('light-theme')
    else document.documentElement.classList.remove('light-theme')
    localStorage.setItem('theme', theme)

    // Responsive sidebar
    const onResize = () => setSidebarOpen(window.innerWidth > 780)
    window.addEventListener('resize', onResize)

    // Command Palette hotkey
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(prev => !prev)
        setPaletteIndex(0)
        setSearchQuery('')
      }
      if (e.key === 'Escape') setShowCommandPalette(false)
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearInterval(timer)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', onResize)
      if (evtSource) evtSource.close()
    }
  }, [fetchData, addToast, theme])

  // ── Command palette keyboard nav ──────────────────────────────

  const searchResults = searchQuery.length > 1 ? [
    ...data.filter(a => a.company?.toLowerCase().includes(searchQuery.toLowerCase())).map(a => ({ type: 'app', label: a.company, sub: a.role, id: a.id, report: a.report })),
    ...reports.filter(r => r.name?.toLowerCase().includes(searchQuery.toLowerCase())).map(r => ({ type: 'report', label: r.name, sub: 'Evaluation Report' })),
    ...preps.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase())).map(p => ({ type: 'prep', label: p.name.split('-')[0].toUpperCase(), sub: 'Interview Intelligence', name: p.name })),
  ].slice(0, 8) : []

  const handlePaletteKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteIndex(i => Math.min(i + 1, searchResults.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && searchResults[paletteIndex]) activatePaletteResult(searchResults[paletteIndex])
  }

  const activatePaletteResult = (res) => {
    setShowCommandPalette(false)
    setSearchQuery('')
    if (res.type === 'app') { setActiveTab('tracker'); setSelectedReport(null) }
    else if (res.type === 'report') { loadReport(res.label) }
    else if (res.type === 'prep') { loadReport(res.name, 'interview-prep') }
  }

  useEffect(() => { setPaletteIndex(0) }, [searchQuery])

  // ── Actions ───────────────────────────────────────────────────

  const handleStatusUpdate = (id, newStatus) => {
    setUpdatingId(id)
    fetch(`/api/applications/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
      .then(r => r.json())
      .then(() => { setUpdatingId(null); fetchData() })
      .catch(() => setUpdatingId(null))
  }

  const handleTailor = (id) => {
    setTailoringId(id)
    fetch(`/api/tailor/${id}`, { method: 'POST' })
      .then(r => r.json())
      .then(() => { setTailoringId(null); fetchData(); addToast(`Assets generated for ${id}! Check /output folder.`, 'success') })
      .catch(() => { setTailoringId(null); addToast('Tailoring failed — check server logs', 'error') })
  }

  const handlePrepForm = (id) => {
    fetch(`/api/prep-form/${id}`, { method: 'POST' })
      .then(r => r.json())
      .then(() => addToast(`Autonomous agent launched for ${id}!`, 'info'))
      .catch(() => addToast('Prep form launch failed', 'error'))
  }

  const handleScan = () => {
    setScanning(true)
    fetch('/api/scan', { method: 'POST' })
      .then(() => { setScanning(false); fetchData(); addToast('Scan triggered — results will appear shortly.', 'info') })
      .catch(() => { setScanning(false); addToast('Scan failed — check server logs', 'error') })
  }

  const loadReport = (filename, type = 'reports') => {
    setSelectedReport(filename)
    setShowCommandPalette(false)
    fetch(`/api/${type}/${encodeURIComponent(filename)}`)
      .then(r => r.text())
      .then(content => setReportContent(content))
      .catch(err => { console.error('Failed to load report:', err); addToast('Could not load report', 'error') })
  }

  // ── Tracker filter + sort ─────────────────────────────────────

  const filteredData = data
    .filter(a => {
      const matchSearch = !trackerSearch ||
        a.company?.toLowerCase().includes(trackerSearch.toLowerCase()) ||
        a.role?.toLowerCase().includes(trackerSearch.toLowerCase())
      const matchStatus = trackerStatus === 'all' || a.status?.includes(trackerStatus)
      return matchSearch && matchStatus
    })
    .sort((a, b) => {
      const dir = trackerSort.dir === 'asc' ? 1 : -1
      if (trackerSort.key === 'score') {
        return (parseScore(a.score) - parseScore(b.score)) * dir
      }
      if (trackerSort.key === 'date') {
        return ((a.date || '') > (b.date || '') ? 1 : -1) * dir
      }
      return ((a[trackerSort.key] || '') > (b[trackerSort.key] || '') ? 1 : -1) * dir
    })

  const toggleSort = (key) => {
    setTrackerSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  const SortIcon = ({ col }) => {
    if (trackerSort.key !== col) return <SortAsc size={12} style={{ opacity: 0.3 }} />
    return trackerSort.dir === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />
  }

  // ── Analytics data ────────────────────────────────────────────

  const scoreData = [
    { name: '4.5+',    value: data.filter(a => parseScore(a.score) >= 4.5).length, color: '#a6e3a1' },
    { name: '4.0–4.4', value: data.filter(a => { const s = parseScore(a.score); return s >= 4 && s < 4.5 }).length, color: '#89b4fa' },
    { name: '3.5–3.9', value: data.filter(a => { const s = parseScore(a.score); return s >= 3.5 && s < 4 }).length, color: '#cba6f7' },
    { name: '3.0–3.4', value: data.filter(a => { const s = parseScore(a.score); return s >= 3 && s < 3.5 }).length, color: '#f9e2af' },
    { name: '< 3.0',   value: data.filter(a => parseScore(a.score) < 3 && !isNaN(parseScore(a.score))).length, color: '#a6adc8' },
  ]

  const funnelData = [
    { name: 'Evaluated', value: data.filter(a => !a.status?.includes('SKIP')).length,                       fill: '#89b4fa' },
    { name: 'Applied',   value: data.filter(a => /applied|enviada/i.test(a.status)).length,                fill: '#cba6f7' },
    { name: 'Responded', value: data.filter(a => /responded|respuesta/i.test(a.status)).length,             fill: '#f5c2e7' },
    { name: 'Interview', value: data.filter(a => /interview/i.test(a.status)).length,                       fill: '#a6e3a1' },
    { name: 'Offer',     value: data.filter(a => /offer|oferta/i.test(a.status)).length,                    fill: '#f9e2af' },
  ]

  // Company frequency (top 8)
  const companyCounts = Object.entries(
    data.reduce((acc, a) => { acc[a.company] = (acc[a.company] || 0) + 1; return acc }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }))

  // Apps by date (last 14 days)
  const today = new Date()
  const dateRange = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (13 - i))
    return d.toISOString().slice(0, 10)
  })
  const appsByDate = dateRange.map(date => ({
    date: date.slice(5),
    count: data.filter(a => a.date === date).length,
  }))

  const isHealthy = diagnostics && Object.values(diagnostics).every(v => v === true || v === 'OK')

  const storySections = splitStoryBankSections(storyBank)

  // ─── Render ───────────────────────────────────────────────────

  if (loading) return (
    <div className="loading-screen">
      <Rocket size={32} className="spin" />
      <span>Career-OPS loading…</span>
      <div style={{ display: 'flex', gap: 16, marginTop: 24, flexWrap: 'wrap', maxWidth: 600 }}>
        <div className="skeleton-card" style={{ flex: '1 1 200px', minHeight: 100 }} />
        <div className="skeleton-card" style={{ flex: '1 1 200px', minHeight: 100 }} />
        <div className="skeleton-card" style={{ flex: '1 1 100%', minHeight: 80 }} />
        <div className="skeleton-card" style={{ flex: '1 1 100%', minHeight: 140 }} />
      </div>
    </div>
  )

  return (
    <div className={`dashboard ${theme === 'light' ? 'light-theme' : ''}`}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Command Palette */}
      {showCommandPalette && (
        <div className="command-palette-overlay" onClick={() => setShowCommandPalette(false)}>
          <div className="command-palette card glass" onClick={e => e.stopPropagation()}>
            <div className="search-pill full">
              <Search size={20} />
              <input
                ref={paletteInputRef}
                autoFocus
                type="text"
                placeholder="Search apps, reports, intel…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handlePaletteKeyDown}
              />
              {searchQuery && <button className="clear-search" onClick={() => setSearchQuery('')}><X size={14} /></button>}
            </div>
            <div className="results-list">
              {searchResults.length > 0 ? searchResults.map((res, i) => (
                <div key={i} className={`result-item ${i === paletteIndex ? 'result-active' : ''}`} onClick={() => activatePaletteResult(res)}>
                  <div className="result-icon">
                    {res.type === 'app' && <Shield size={16} />}
                    {res.type === 'report' && <FileText size={16} />}
                    {res.type === 'prep' && <Zap size={16} />}
                  </div>
                  <div className="result-info">
                    <span className="result-label">{res.label}</span>
                    <span className="result-sub">{res.sub}</span>
                  </div>
                  <ArrowRight size={14} className="faint" />
                </div>
              )) : searchQuery.length > 1 && <div className="no-results">No matches for "{searchQuery}"</div>}
              {searchQuery.length === 0 && (
                <div className="palette-hints">
                  <div className="hint-row"><kbd>Ctrl K</kbd> Open/close</div>
                  <div className="hint-row"><kbd>↑ ↓</kbd> Navigate</div>
                  <div className="hint-row"><kbd>Enter</kbd> Select</div>
                </div>
              )}
            </div>
            <div className="palette-footer">
              <span>ESC to close</span><span>↑↓ navigate</span><span>↵ select</span>
            </div>
          </div>
        </div>
      )}

      {/* Hamburger */}
      <button className="hamburger" onClick={() => setSidebarOpen(prev => !prev)} title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}>
        {sidebarOpen ? <X size={20} /> : <LayoutDashboard size={20} />}
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
        <div style={{ marginBottom: '24px' }}>
          <h2 className="logo-text">CAREER<span className="logo-sep">-</span><span className="logo-highlight">OPS</span></h2>
          <p className="logo-tagline">Elite Intelligence v3.0</p>
        </div>

        {profile && (
          <div className="profile-mini card glass">
            <div className="profile-header"><User size={14} /><span>{profile.name || 'Candidate'}</span></div>
            <div className="profile-stat"><Target size={11} /><span className="stat-label">Target:</span><span className="stat-val">{profile.target?.role || profile.roles?.[0] || 'SWE'}</span></div>
            <div className="profile-stat"><TrendingUp size={11} /><span className="stat-label">Range:</span><span className="stat-val">{profile.config?.comp_range || 'N/A'}</span></div>
          </div>
        )}

        <nav className="nav-menu">
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={16} />, label: 'Overview' },
            { id: 'analytics', icon: <BarChart2 size={16} />, label: 'Analytics' },
            { id: 'tracker',   icon: <Shield size={16} />, label: `Tracker (${data.length})` },
            { id: 'inbox',     icon: <Zap size={16} />, label: 'Pipeline' },
            { id: 'interview', icon: <Activity size={16} />, label: 'Interview Ready' },
            { id: 'stories',   icon: <BookOpen size={16} />, label: 'Story Bank' },
            { id: 'reports',   icon: <FileText size={16} />, label: 'Reports' },
          ].map(({ id, icon, label }) => (
            <button key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`}
              onClick={() => { setActiveTab(id); setSelectedReport(null) }}>
              {icon} {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <span>☀️</span> : <span>🌙</span>}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <div className={`health-widget card glass ${isHealthy ? 'healthy' : 'warning'}`}>
            <div className="health-header">
              {isHealthy ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
              <span>System {isHealthy ? 'Healthy' : 'Degraded'}</span>
              <div className={`pulse ${isHealthy ? 'blue' : 'red'}`} />
            </div>
          </div>
          <button className="badge-btn scan-btn" onClick={handleScan} disabled={scanning}>
            {scanning ? <Clock className="spin" size={15} /> : <Search size={15} />}
            {scanning ? 'Scanning…' : 'Scan Portals'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {selectedReport && (
          <div className="slide-over-overlay" onClick={() => setSelectedReport(null)}>
            <div className="slide-over-panel" onClick={e => e.stopPropagation()}>
              <header className="slide-over-header">
                <h3>{selectedReport}</h3>
                <button className="close-btn" onClick={() => setSelectedReport(null)}><X size={18} /></button>
              </header>
              <div className="slide-over-body markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportContent}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        <>
          <header className="content-intro">
              <div>
                <h1>
                  {activeTab === 'dashboard'  && 'Elite Market Intel'}
                  {activeTab === 'analytics'  && 'Analytics'}
                  {activeTab === 'tracker'    && 'Application Command'}
                  {activeTab === 'inbox'      && 'Priority Discovery'}
                  {activeTab === 'interview'  && 'Interview Intelligence'}
                  {activeTab === 'stories'    && 'STAR Narrative Bank'}
                  {activeTab === 'reports'    && 'Reports Archive'}
                </h1>
                <p className="subtitle">
                  {activeTab === 'dashboard'  && `Strategic overview · ${data.filter(a => parseScore(a.score) >= 4).length} elite matches`}
                  {activeTab === 'analytics'  && `${data.length} total opportunities · ${data.filter(a => /interview/i.test(a.status)).length} active interviews`}
                  {activeTab === 'tracker'    && `Managing ${data.length} opportunities · ${filteredData.length} shown`}
                  {activeTab === 'interview'  && `${preps.length} company-specific prep modules ready`}
                  {activeTab === 'reports'    && `${reports.length} evaluation reports`}
                </p>
              </div>
              <button className="search-pill glass" onClick={() => { setShowCommandPalette(true); setSearchQuery('') }} title="Ctrl+K">
                <Search size={15} /><span style={{ fontSize: 13 }}>Search…</span><kbd className="kbd">⌘K</kbd>
              </button>
            </header>

            {/* ─── OVERVIEW ──────────────────────────────── */}
            {activeTab === 'dashboard' && (
              <div className="bento-grid">
                {/* Elite Matches */}
                <div className="bento-item card glass col-span-2 mesh-gradient">
                  <div className="stat-box">
                    <Rocket className="icon-blue" size={32} />
                    <div className="stat-content">
                      <div className="stat-num">{data.filter(a => parseScore(a.score) >= 4).length}</div>
                      <div className="stat-desc">Elite Matches (4.0+)</div>
                    </div>
                  </div>
                  <div className="mini-chart">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${data.length ? (data.filter(a => /applied|enviada/i.test(a.status)).length / data.length) * 100 : 0}%`, background: 'var(--ctp-green)' }} />
                    </div>
                    <div className="progress-label">{data.filter(a => /applied|enviada/i.test(a.status)).length} Applied / {data.length} Tracked</div>
                  </div>
                </div>

                {/* Active Interviews */}
                <div className="bento-item card glass">
                  <div className="stat-box">
                    <Activity className="icon-lavender" size={28} />
                    <div className="stat-content">
                      <div className="stat-num">{data.filter(a => /interview/i.test(a.status)).length}</div>
                      <div className="stat-desc">Active Interviews</div>
                    </div>
                  </div>
                </div>

                {/* Score Distribution */}
                <div className="bento-item card glass">
                  <div className="stat-box">
                    <BarChart2 className="icon-green" size={28} />
                    <div className="stat-content">
                      <div className="stat-num">{data.filter(a => parseScore(a.score) >= 4.5).length}</div>
                      <div className="stat-desc">Top-tier (4.5+)</div>
                    </div>
                  </div>
                </div>

                {/* Funnel Pie */}
                <div className="bento-item card glass row-span-2">
                  <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--ctp-subtext1)' }}>Conversion Funnel</h3>
                  <div style={{ height: '200px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={funnelData.filter(f => f.value > 0)} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" paddingAngle={3}>
                          {funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface1)', borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-legend-mini">
                    {funnelData.filter(f => f.value > 0).map((f, i) => (
                      <div key={i} className="legend-row">
                        <div className="dot" style={{ background: f.fill }} /> {f.name} <span className="legend-val">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Score dist bar */}
                <div className="bento-item card glass col-span-2">
                  <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--ctp-subtext1)' }}>Score Distribution</h3>
                  <div style={{ height: '110px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={scoreData} barSize={22}>
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--ctp-subtext0)' }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip contentStyle={{ background: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface1)', borderRadius: 8 }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {scoreData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Upcoming Prep */}
                <div className="bento-item card glass col-span-2">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 14, color: 'var(--ctp-subtext1)' }}>Upcoming Prep</h3>
                    <Coffee size={13} className="faint" />
                  </div>
                  <div className="mini-list">
                    {preps.slice(0, 4).map((item, i) => (
                      <div key={i} className="mini-list-item clickable" onClick={() => loadReport(item.name, 'interview-prep')}>
                        <span className="item-company">{item.name.split('-')[0].toUpperCase()}</span>
                        <span className="item-role">{item.name.split('-').slice(1).join(' ').replace('.md', '')}</span>
                        <ArrowRight size={11} className="faint" />
                      </div>
                    ))}
                    {preps.length === 0 && <div className="faint" style={{ fontSize: 12 }}>No prep files yet — move an app to "Interview" to generate one.</div>}
                  </div>
                </div>
              </div>
            )}

            {/* ─── ANALYTICS ─────────────────────────────── */}
            {activeTab === 'analytics' && (
              <div className="analytics-grid">
                {/* Funnel */}
                <div className="analytics-card card glass">
                  <h3 className="analytics-title">Application Funnel</h3>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={funnelData} layout="vertical" barSize={18}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--ctp-subtext1)' }} axisLine={false} tickLine={false} width={72} />
                        <Tooltip contentStyle={{ background: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface1)', borderRadius: 8 }} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Score histogram */}
                <div className="analytics-card card glass">
                  <h3 className="analytics-title">Score Distribution</h3>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={scoreData} barSize={26}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--ctp-subtext0)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--ctp-subtext0)' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface1)', borderRadius: 8 }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {scoreData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Apps by day (last 14 days) */}
                <div className="analytics-card analytics-wide card glass">
                  <h3 className="analytics-title">Applications Added — Last 14 Days</h3>
                  <div style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={appsByDate}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--ctp-subtext0)' }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--ctp-subtext0)' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface1)', borderRadius: 8 }} />
                        <Line type="monotone" dataKey="count" stroke="var(--ctp-blue)" strokeWidth={2} dot={{ fill: 'var(--ctp-blue)', r: 3 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top companies */}
                <div className="analytics-card analytics-wide card glass">
                  <h3 className="analytics-title">Top Companies by Volume</h3>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={companyCounts} barSize={18}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--ctp-subtext0)' }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--ctp-subtext0)' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface1)', borderRadius: 8 }} />
                        <Bar dataKey="value" fill="var(--ctp-mauve)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Summary stats */}
                <div className="analytics-stats-row">
                  {[
                    { label: 'Total Tracked', value: data.length, color: 'var(--ctp-blue)' },
                    { label: 'Applied', value: data.filter(a => /applied|enviada/i.test(a.status)).length, color: 'var(--ctp-green)' },
                    { label: 'In Interview', value: data.filter(a => /interview/i.test(a.status)).length, color: 'var(--ctp-lavender)' },
                    { label: 'Offers', value: data.filter(a => /offer/i.test(a.status)).length, color: 'var(--ctp-yellow)' },
                    { label: 'Avg Score', value: (data.reduce((s, a) => { const sc = parseScore(a.score); return s + (isNaN(sc) ? 0 : sc) }, 0) / (data.filter(a => !isNaN(parseScore(a.score))).length || 1)).toFixed(2), color: 'var(--ctp-peach)' },
                  ].map((stat, i) => (
                    <div key={i} className="analytics-stat-card card glass">
                      <div className="analytics-stat-val" style={{ color: stat.color }}>{stat.value}</div>
                      <div className="analytics-stat-label">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── TRACKER ───────────────────────────────── */}
            {activeTab === 'tracker' && (
              <div>
                <div className="filter-bar">
                  <div className="filter-search glass">
                    <Search size={14} />
                    <input
                      type="text"
                      placeholder="Filter by company or role…"
                      value={trackerSearch}
                      onChange={e => setTrackerSearch(e.target.value)}
                    />
                    {trackerSearch && <button onClick={() => setTrackerSearch('')}><X size={12} /></button>}
                  </div>
                  <div className="filter-pills">
                    {['all', 'Applied', 'Interview', 'Evaluated', 'Discarded', 'SKIP'].map(s => (
                      <button key={s} className={`filter-pill ${trackerStatus === s ? 'active' : ''}`}
                        onClick={() => setTrackerStatus(s)}>{s === 'all' ? 'All' : s}</button>
                    ))}
                  </div>
                  <button className="filter-refresh" onClick={fetchData} title="Refresh"><RefreshCw size={14} /></button>
                </div>
                <div className="card glass datatable-container">
                  <table className="datatable">
                    <thead>
                      <tr>
                        <th onClick={() => toggleSort('id')} className="sortable"># <SortIcon col="id" /></th>
                        <th onClick={() => toggleSort('date')} className="sortable">Date <SortIcon col="date" /></th>
                        <th onClick={() => toggleSort('company')} className="sortable">Company <SortIcon col="company" /></th>
                        <th>Role</th>
                        <th onClick={() => toggleSort('score')} className="sortable">Score <SortIcon col="score" /></th>
                        <th>Status</th>
                        <th>Action</th>
                        <th>Intel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((app, i) => {
                        const sc = parseScore(app.score)
                        return (
                          <tr key={i} className={updatingId === app.id ? 'row-updating' : ''}>
                            <td className="faint" style={{ fontSize: 12 }}>{app.id}</td>
                            <td className="faint" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{app.date || '—'}</td>
                            <td className="company-cell clickable-cell" onClick={() => app.report && loadReport(app.report)}>{app.company}</td>
                            <td className="role-cell clickable-cell" onClick={() => app.report && loadReport(app.report)}>{app.role}</td>
                            <td>
                              <span className={scoreBadgeClass(sc)} style={{ background: isNaN(sc) ? undefined : scoreColor(sc) + '22', color: isNaN(sc) ? undefined : scoreColor(sc), border: `1px solid ${isNaN(sc) ? 'transparent' : scoreColor(sc) + '44'}` }}>
                                {app.score || '—'}
                              </span>
                            </td>
                            <td>
                              <div className="status-select-wrap">
                                <select
                                  className="status-select"
                                  value={app.status?.trim()}
                                  onChange={e => handleStatusUpdate(app.id, e.target.value)}
                                  disabled={updatingId === app.id}
                                >
                                  {CANONICAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <ChevronDown size={11} className="select-icon" />
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  className={`magic-btn ${tailoringId === app.id ? 'spinning' : ''}`}
                                  onClick={() => handleTailor(app.id)}
                                  disabled={!!tailoringId}
                                  title="Magic Tailor CV/CL"
                                >
                                  {tailoringId === app.id ? <Clock size={14} /> : <Wand2 size={14} />}
                                  <span>{tailoringId === app.id ? 'Tailoring…' : 'Tailor'}</span>
                                </button>
                                <button
                                  className="magic-btn"
                                  style={{ background: 'linear-gradient(90deg, var(--ctp-peach), var(--ctp-red))' }}
                                  onClick={() => handlePrepForm(app.id)}
                                  title="Autonomous Form Prep"
                                >
                                  <Rocket size={14} /><span>Prep</span>
                                </button>
                              </div>
                            </td>
                            <td className="actions-cell">
                              {app.report && app.report !== '-' && (
                                <button className="icon-btn" onClick={() => loadReport(app.report.match(/\((.*?)\)/)?.[1]?.split('/').pop() || app.report)} title="View Report">
                                  <FileText size={15} />
                                </button>
                              )}
                              {app.pdf && app.pdf !== '❌' && app.pdf !== '-' && (
                                <a href={`/api/pdf/${encodeURIComponent(app.pdf)}`} target="_blank" rel="noopener noreferrer" className="icon-btn" title="View PDF">
                                  <Download size={15} />
                                </a>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {filteredData.length === 0 && (
                        <tr><td colSpan={8} className="faint" style={{ textAlign: 'center', padding: 32 }}>No applications match your filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── PIPELINE ──────────────────────────────── */}
            {activeTab === 'inbox' && (
              <div className="card glass datatable-container">
                <table className="datatable">
                  <thead>
                    <tr>
                      <th>#</th><th>Company</th><th>Role</th><th>Score</th><th>URL</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineData.items?.map((item, i) => {
                      const sc = parseScore(item.score)
                      return (
                        <tr key={i}>
                          <td className="faint" style={{ fontSize: 12 }}>{item.id}</td>
                          <td className="company-cell">{item.company}</td>
                          <td className="role-cell">{item.role}</td>
                          <td>
                            <span className={scoreBadgeClass(sc)} style={{ background: isNaN(sc) ? undefined : scoreColor(sc) + '22', color: isNaN(sc) ? undefined : scoreColor(sc) }}>
                              {item.score || '—'}
                            </span>
                          </td>
                          <td>
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="icon-btn" title="Open JD">
                                <Link size={14} />
                              </a>
                            )}
                          </td>
                          <td>
                            <button className="badge-btn badge-blue action-btn" onClick={() => {
                              // If there's a matching report, open it; otherwise switch to tracker
                              const match = reports.find(r => r.name?.toLowerCase().includes(item.company?.toLowerCase()))
                              if (match) loadReport(match.name)
                              else { setActiveTab('tracker'); setTrackerSearch(item.company || '') }
                            }}>
                              <Zap size={13} /> Evaluate
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {(!pipelineData.items || pipelineData.items.length === 0) && (
                      <tr><td colSpan={6} className="faint" style={{ textAlign: 'center', padding: 32 }}>Pipeline empty — run a scan to populate it.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ─── INTERVIEW READY ───────────────────────── */}
            {activeTab === 'interview' && (
              <div className="reports-grid">
                {preps.map((prep, i) => (
                  <div key={i} className="card glass report-card prep-card" onClick={() => loadReport(prep.name, 'interview-prep')}>
                    <div className="report-icon bg-green"><Zap size={22} /></div>
                    <div className="report-info">
                      <div className="report-name">{prep.name.replace('.md', '').replace(/-/g, ' ')}</div>
                      <div className="report-meta">Company-Specific Intel</div>
                    </div>
                    <ArrowRight size={15} className="chevron" />
                  </div>
                ))}
                {preps.length === 0 && <div className="card glass faint-card">No active interview preps found. Move an application to "Interview" to trigger intel generation.</div>}
              </div>
            )}

            {/* ─── STORY BANK ────────────────────────────── */}
            {activeTab === 'stories' && (
              <div className="story-bank-container">
                {storySections.length > 0 ? (
                  storySections.map((section, i) => (
                    <div key={i} className="story-section card glass">
                      <button
                        className="story-section-header"
                        onClick={() => setOpenSections(prev => ({ ...prev, [i]: !prev[i] }))}
                      >
                        <BookOpen size={15} style={{ color: 'var(--ctp-green)', flexShrink: 0 }} />
                        <span className="story-title">{section.title}</span>
                        <ChevronRight size={15} className={`story-chevron ${openSections[i] ? 'open' : ''}`} />
                      </button>
                      {openSections[i] && (
                        <div className="story-body markdown-body">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="card glass markdown-viewer markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{storyBank || '# No story bank found\n\nCreate `interview-prep/story-bank.md` to get started.'}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}

            {/* ─── REPORTS ───────────────────────────────── */}
            {activeTab === 'reports' && (
              <div className="reports-grid">
                {reports.map((report, i) => {
                  const parts = report.name.replace('.md', '').split('-')
                  const num = parts[0]
                  const company = parts[1] || ''
                  const date = parts[parts.length - 1] || ''
                  return (
                    <div key={i} className="card glass report-card" onClick={() => loadReport(report.name)}>
                      <div className="report-icon"><FileText size={20} /></div>
                      <div className="report-info">
                        <div className="report-name">#{num} {company.replace(/-/g, ' ')}</div>
                        <div className="report-meta">{date}</div>
                      </div>
                      <ArrowRight size={15} className="chevron" />
                    </div>
                  )
                })}
                {reports.length === 0 && <div className="card glass faint-card">No evaluation reports yet — paste a job URL in your AI agent to generate one.</div>}
              </div>
            )}
        </>
      </main>
    </div>
  )
}

export default App
