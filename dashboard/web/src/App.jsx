import { useState, useEffect } from 'react'
import { 
  LayoutDashboard, Rocket, FileText, Settings, Search, CheckCircle, Clock, 
  BarChart3, PieChart as PieChartIcon, ArrowRight, ExternalLink, Download, 
  ArrowLeft, BookOpen, User, Target, Zap, Shield, TrendingUp, ChevronDown, 
  Wand2, Activity, AlertTriangle, Coffee 
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const CANONICAL_STATUSES = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP'];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
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

  const fetchData = () => {
    Promise.all([
      fetch('/api/applications').then(res => res.json()),
      fetch('/api/pipeline').then(res => res.json()),
      fetch('/api/reports').then(res => res.json()),
      fetch('/api/profile').then(res => res.json()),
      fetch('/api/story-bank').then(res => res.text()),
      fetch('/api/interview-prep').then(res => res.json()),
      fetch('/api/diagnostics').then(res => res.json())
    ])
      .then(([apps, pipeline, reportsList, profileData, stories, prepList, health]) => {
        setData(apps)
        setPipelineData(pipeline)
        setReports(reportsList)
        setProfile(profileData)
        setStoryBank(stories)
        setPreps(prepList)
        setDiagnostics(health)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch data:', err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchData()
    // Periodic health check
    const timer = setInterval(() => {
        fetch('/api/diagnostics').then(res => res.json()).then(setDiagnostics)
    }, 30000)

    // Command Palette hotkey
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(prev => !prev)
      }
      if (e.key === 'Escape') setShowCommandPalette(false)
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearInterval(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleStatusUpdate = (id, newStatus) => {
    setUpdatingId(id)
    fetch(`/api/applications/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
      .then(res => res.json())
      .then(() => {
        setUpdatingId(null)
        fetchData()
      })
      .catch(() => setUpdatingId(null))
  }

  const handleTailor = (id) => {
    setTailoringId(id)
    fetch(`/api/tailor/${id}`, { method: 'POST' })
      .then(res => res.json())
      .then(() => {
        setTailoringId(null)
        fetchData()
        alert(`Assets generated for ${id}! Check /output folder.`)
      })
      .catch(() => setTailoringId(null))
  }

  const handlePrepForm = (id) => {
    // Immediate feedback since it's an async background agent
    fetch(`/api/prep-form/${id}`, { method: 'POST' })
      .then(res => res.json())
      .then(() => {
        alert(`Autonomous Agent launched for ${id}! Check your taskbar for a new browser window.`)
      })
  }

  const handleScan = () => {
    setScanning(true)
    fetch('/api/scan', { method: 'POST' })
      .then(() => {
        setScanning(false)
        fetchData()
      })
      .catch(() => setScanning(false))
  }

  const loadReport = (filename, type = 'reports') => {
    setSelectedReport(filename)
    setShowCommandPalette(false)
    fetch(`/api/${type}/${encodeURIComponent(filename)}`)
      .then(res => res.text())
      .then(content => setReportContent(content))
      .catch(err => console.error('Failed to load report:', err))
  }

  // Search logic for Command Palette
  const searchResults = searchQuery.length > 1 ? [
    ...data.filter(a => a.company.toLowerCase().includes(searchQuery.toLowerCase())).map(a => ({ type: 'app', label: a.company, sub: a.role, id: a.id, report: a.report })),
    ...reports.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())).map(r => ({ type: 'report', label: r.name, sub: 'Evaluation Report' })),
    ...preps.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => ({ type: 'prep', label: p.name.split('-')[0].toUpperCase(), sub: 'Interview Intelligence' }))
  ].slice(0, 6) : []

  if (loading) return <div className="loading-screen">Preparing Elite Intelligence v2.0...</div>

  // Analytics Helpers
  const scoreData = [
    { name: '4.5+', value: data.filter(a => parseFloat(a.score) >= 4.5).length, color: '#89b4fa' },
    { name: '4.0-4.4', value: data.filter(a => parseFloat(a.score) >= 4 && parseFloat(a.score) < 4.5).length, color: '#cba6f7' },
    { name: '3.0-3.9', value: data.filter(a => parseFloat(a.score) >= 3 && parseFloat(a.score) < 4).length, color: '#f38ba8' },
    { name: '< 3.0', value: data.filter(a => parseFloat(a.score) < 3).length, color: '#a6adc8' },
  ]

  const statusData = [
    { name: 'Sent', value: data.filter(a => a.status.includes('Applied') || a.status.includes('Enviada')).length },
    { name: 'Eval', value: data.filter(a => a.status.includes('Evaluated') || a.status.includes('Evaluada')).length },
    { name: 'Interview', value: data.filter(a => a.status.includes('Interview')).length },
  ]

  const isHealthy = diagnostics && Object.values(diagnostics).every(v => v === true || v === 'OK')

  return (
    <div className="dashboard">
      {/* Command Palette Modal */}
      {showCommandPalette && (
        <div className="command-palette-overlay" onClick={() => setShowCommandPalette(false)}>
          <div className="command-palette card glass" onClick={e => e.stopPropagation()}>
            <div className="search-pill full">
              <Search size={20} />
              <input 
                autoFocus 
                type="text" 
                placeholder="Search anything (apps, reports, intel)..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="results-list">
              {searchResults.length > 0 ? searchResults.map((res, i) => (
                <div key={i} className="result-item" onClick={() => {
                  if (res.type === 'app') {
                    setActiveTab('tracker');
                    setShowCommandPalette(false);
                  } else if (res.type === 'report') {
                    loadReport(res.label);
                  } else if (res.type === 'prep') {
                    loadReport(res.label, 'interview-prep');
                  }
                }}>
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
              )) : searchQuery.length > 1 && <div className="no-results">No elite matches found for "{searchQuery}"</div>}
            </div>
            <div className="palette-footer">
               <span>ESC to close</span>
               <span>Arrows to navigate</span>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ marginBottom: '30px' }}>
          <h2 className="logo-text">
            CAREER-OPS <span className="logo-highlight">ELITE</span>
          </h2>
        </div>

        {profile && (
          <div className="profile-mini card glass">
            <div className="profile-header">
              <User size={16} />
              <span>{profile.name || 'Candidate'}</span>
            </div>
            <div className="profile-stat">
              <Target size={12} />
              <span className="stat-label">Target:</span>
              <span className="stat-val">{profile.target?.role || 'SWE'}</span>
            </div>
            <div className="profile-stat">
              <TrendingUp size={12} />
              <span className="stat-label">Range:</span>
              <span className="stat-val">{profile.config?.comp_range || 'N/A'}</span>
            </div>
          </div>
        )}
        
        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setSelectedReport(null); }}>
            <LayoutDashboard size={18} /> Overview
          </button>
          <button className={`nav-item ${activeTab === 'tracker' ? 'active' : ''}`} onClick={() => { setActiveTab('tracker'); setSelectedReport(null); }}>
            <Shield size={18} /> Tracker
          </button>
          <button className={`nav-item ${activeTab === 'inbox' ? 'active' : ''}`} onClick={() => { setActiveTab('inbox'); setSelectedReport(null); }}>
            <Zap size={18} /> Pipeline
          </button>
          <button className={`nav-item ${activeTab === 'interview' ? 'active' : ''}`} onClick={() => { setActiveTab('interview'); setSelectedReport(null); }}>
            <Activity size={18} /> Interview Ready
          </button>
          <button className={`nav-item ${activeTab === 'stories' ? 'active' : ''}`} onClick={() => { setActiveTab('stories'); setSelectedReport(null); }}>
            <BookOpen size={18} /> Story Bank
          </button>
          <button className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => { setActiveTab('reports'); setSelectedReport(null); }}>
            <FileText size={18} /> Reports
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className={`health-widget card glass ${isHealthy ? 'healthy' : 'warning'}`}>
             <div className="health-header">
                {isHealthy ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                <span>System Health</span>
                <div className={`pulse ${isHealthy ? 'blue' : 'red'}`} />
             </div>
          </div>
          <button className="badge-btn scan-btn" onClick={handleScan} disabled={scanning}>
            {scanning ? <Clock className="spin" size={16} /> : <Search size={16} />}
            {scanning ? 'Scanning...' : 'Scan Portals'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {selectedReport ? (
          <div className="report-viewer">
            <header className="content-intro">
              <button className="back-btn" onClick={() => setSelectedReport(null)}>
                <ArrowLeft size={16} /> Back
              </button>
              <h2>{selectedReport}</h2>
            </header>
            <div className="report-content markdown-body card glass">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportContent}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <>
            <header className="content-intro">
              <div>
                <h1>
                  {activeTab === 'dashboard' && 'Elite Market Intel'}
                  {activeTab === 'tracker' && 'Application Command'}
                  {activeTab === 'inbox' && 'Priority Discovery'}
                  {activeTab === 'interview' && 'Interview Intelligence'}
                  {activeTab === 'stories' && 'STAR Narrative Bank'}
                  {activeTab === 'reports' && 'Reports Archive'}
                </h1>
                <p className="subtitle">
                  {activeTab === 'dashboard' && 'Strategic overview of your active search.'}
                  {activeTab === 'tracker' && `Managing ${data.length} curated opportunities.`}
                  {activeTab === 'interview' && `You have ${preps.length} company-specific prep modules ready.`}
                </p>
              </div>
              <div className="search-pill glass">
                <Search size={16} />
                <input type="text" placeholder="Global search..." />
              </div>
            </header>

            {activeTab === 'dashboard' && (
              <div className="bento-grid">
                <div className="bento-item card glass col-span-2 mesh-gradient">
                  <div className="stat-box">
                    <Rocket className="icon-blue" />
                    <div className="stat-content">
                      <div className="stat-num">{data.filter(a => parseFloat(a.score) >= 4).length}</div>
                      <div className="stat-desc">Elite Matches Ready</div>
                    </div>
                  </div>
                  <div className="mini-chart">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${(data.filter(a => a.status.includes('Applied')).length / data.length) * 100}%`, background: 'var(--ctp-green)' }} />
                    </div>
                    <div className="progress-label">{data.filter(a => a.status.includes('Applied')).length} Applied / {data.length} Tracked</div>
                  </div>
                </div>
                
                <div className="bento-item card glass animate-pulse">
                   <div className="stat-box">
                    <Activity className="icon-lavender" />
                    <div className="stat-content">
                      <div className="stat-num">{data.filter(a => a.status.includes('Interview')).length}</div>
                      <div className="stat-desc">Active Interviews</div>
                    </div>
                  </div>
                </div>

                <div className="bento-item card glass row-span-2">
                  <h3>Conversion Funnel</h3>
                  <div style={{ height: '200px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value">
                          <Cell fill="#89b4fa" />
                          <Cell fill="#a6e3a1" />
                          <Cell fill="#cba6f7" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-legend-mini">
                    <div className="legend-row"><div className="dot blue" /> Sent</div>
                    <div className="legend-row"><div className="dot green" /> Interview</div>
                    <div className="legend-row"><div className="dot lavender" /> Eval</div>
                  </div>
                </div>

                <div className="bento-item card glass col-span-2">
                  <div className="recent-activity">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3>Upcoming Prep</h3>
                        <Coffee size={14} className="faint" />
                    </div>
                    <div className="mini-list">
                      {preps.slice(0, 3).map((item, i) => (
                        <div key={i} className="mini-list-item clickable" onClick={() => loadReport(item.name, 'interview-prep')}>
                          <span className="item-company">{item.name.split('-')[0].toUpperCase()}</span>
                          <span className="item-role">{item.name.split('-').slice(1).join(' ').replace('.md', '')}</span>
                          <ArrowRight size={12} className="faint" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tracker' && (
              <div className="card glass datatable-container">
                <table className="datatable">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Role</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th>Action</th>
                      <th>Intel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((app, i) => (
                      <tr key={i} className={updatingId === app.id ? 'row-updating' : ''}>
                        <td className="company-cell">{app.company}</td>
                        <td className="role-cell">{app.role}</td>
                        <td>
                          <span className={`badge ${parseFloat(app.score) >= 4 ? 'badge-blue' : (parseFloat(app.score) >= 3.5 ? 'badge-lavender' : 'badge-peach')}`}>
                            {app.score}
                          </span>
                        </td>
                        <td>
                          <div className="status-select-wrap">
                            <select 
                              className="status-select" 
                              value={app.status.trim()} 
                              onChange={(e) => handleStatusUpdate(app.id, e.target.value)}
                              disabled={updatingId === app.id}
                            >
                              {CANONICAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <ChevronDown size={12} className="select-icon" />
                          </div>
                        </td>
                        <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    className={`magic-btn ${tailoringId === app.id ? 'spinning' : ''}`}
                                    onClick={() => handleTailor(app.id)}
                                    disabled={tailoringId}
                                    title="Magic Tailor CV/CL"
                                >
                                    {tailoringId === app.id ? <Clock size={16} /> : <Wand2 size={16} />}
                                    <span>{tailoringId === app.id ? 'Tailoring...' : 'Magic Tailor'}</span>
                                </button>
                                <button 
                                    className="magic-btn"
                                    style={{ background: 'linear-gradient(90deg, var(--ctp-peach), var(--ctp-red))' }}
                                    onClick={() => handlePrepForm(app.id)}
                                    title="Autonomous Form Prep"
                                >
                                    <Rocket size={16} />
                                    <span>Prep App</span>
                                </button>
                            </div>
                        </td>
                        <td className="actions-cell">
                          {app.report && app.report !== '-' && (
                            <button className="icon-btn" onClick={() => loadReport(app.report.match(/\((.*?)\)/)?.[1].split('/').pop())} title="View Report">
                              <FileText size={16} />
                            </button>
                          )}
                          {app.pdf && app.pdf !== '❌' && app.pdf !== '-' && (
                            <a href={`/api/pdf/${encodeURIComponent(app.pdf)}`} target="_blank" className="icon-btn" title="View PDF">
                              <Download size={16} />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'interview' && (
              <div className="reports-grid">
                {preps.map((prep, i) => (
                  <div key={i} className="card glass report-card prep-card" onClick={() => loadReport(prep.name, 'interview-prep')}>
                    <div className="report-icon bg-green"><Zap size={24} /></div>
                    <div className="report-info">
                      <div className="report-name">{prep.name.replace('.md', '').replace(/-/g, ' ')}</div>
                      <div className="report-meta">Company-Specific Intel</div>
                    </div>
                    <ArrowRight size={16} className="chevron" />
                  </div>
                ))}
                {preps.length === 0 && <div className="card glass faint-card col-span-full">No active interview preps found. Move an application to "Interview" to trigger intel generation.</div>}
              </div>
            )}

            {activeTab === 'stories' && (
              <div className="markdown-viewer card glass markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{storyBank || '# No stories found'}</ReactMarkdown>
              </div>
            )}

            {activeTab === 'inbox' && (
              <div className="card glass datatable-container">
                <table className="datatable">
                  <thead>
                    <tr>
                      <th>Tier</th>
                      <th>Company</th>
                      <th>Role</th>
                      <th>Score</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineData.items.map((item, i) => (
                      <tr key={i}>
                        <td className="faint">{item.id}</td>
                        <td className="company-cell">{item.company}</td>
                        <td className="role-cell">{item.role}</td>
                        <td>
                          <span className={`badge-btn ${parseFloat(item.score) >= 4 ? 'badge-blue' : 'badge-lavender'}`}>{item.score}</span>
                        </td>
                        <td>
                          <button className="badge-btn badge-blue action-btn">
                            <Zap size={14} /> Evaluate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App



