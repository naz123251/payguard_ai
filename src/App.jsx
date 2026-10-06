import { useEffect, useMemo, useState } from 'react'
import Tesseract from 'tesseract.js'
import './App.css'
import { analyzePaymentPayload } from './lib/payguardEngine'
import { demoExamples, liveSimulationMessage } from './data/demoData'

const tabs = ['message', 'url', 'screenshot', 'payment request']
const simulationSteps = ['Input', 'Text Analysis', 'Signal Detection', 'Risk Engine', 'AI Explanation', 'Final Decision']

const makeHistoryEntry = (analysis) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  label: analysis.sourceType || 'Payment request',
  score: analysis.riskScore,
  status: analysis.riskLevel,
  time: 'Just now'
})

const readHistory = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('payguard-history') || '[]')
    if (Array.isArray(stored) && stored.length) {
      return stored
    }
  } catch {
    // Ignore local storage errors and fall back to sample data.
  }

  return [
    { id: 'demo-1', label: 'UPI payment request', score: 92, status: 'HIGH RISK', time: '10:42 AM' },
    { id: 'demo-2', label: 'Delivery message', score: 67, status: 'SUSPICIOUS', time: '09:17 AM' },
    { id: 'demo-3', label: 'Bank notification', score: 12, status: 'SAFE', time: '08:04 AM' }
  ]
}

function App() {
  const [activeTab, setActiveTab] = useState('message')
  const [inputText, setInputText] = useState(liveSimulationMessage)
  const [analysis, setAnalysis] = useState(() => analyzePaymentPayload({ text: liveSimulationMessage }))
  const [history, setHistory] = useState(() => readHistory())
  const [loading, setLoading] = useState(false)
  const [privacyMode, setPrivacyMode] = useState(true)
  const [whatIfText, setWhatIfText] = useState('')
  const [judgeMode, setJudgeMode] = useState(false)
  const [judgeStep, setJudgeStep] = useState(0)
  const [urlInput, setUrlInput] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [ocrStatus, setOcrStatus] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem('payguard-history', JSON.stringify(history.slice(0, 6)))
    } catch {
      // Ignore storage failures for privacy-first demo mode.
    }
  }, [history])

  useEffect(() => {
    if (!judgeMode) return undefined

    const timer = setInterval(() => {
      setJudgeStep((value) => (value + 1) % simulationSteps.length)
    }, 1100)

    return () => clearInterval(timer)
  }, [judgeMode])

  const whatIfResult = useMemo(() => {
    if (!whatIfText.trim()) return null
    return analyzePaymentPayload({ text: whatIfText })
  }, [whatIfText])

  const riskTone = useMemo(() => {
    if (analysis.riskLevel === 'HIGH RISK') return 'danger'
    if (analysis.riskLevel === 'SUSPICIOUS') return 'warning'
    return 'safe'
  }, [analysis.riskLevel])

  const analyzeCurrentInput = async (sourceText = inputText, sourceUrl = urlInput) => {
    const effectiveText = String(sourceText || '').trim()
    const effectiveUrl = String(sourceUrl || '').trim()

    if (!effectiveText && !effectiveUrl) {
      setAnalysis({
        riskLevel: 'SAFE',
        riskScore: 0,
        safetyScore: 0,
        confidence: 0,
        explanation: 'Please provide a message, URL, or screenshot for analysis.',
        redFlags: [],
        scamDNA: [],
        claimVsEvidence: { claim: 'No input submitted', evidence: 'No evidence available.' },
        recommendations: ['Enter a payment message to begin the analysis.'],
        primaryThreat: 'No data',
        secondarySignals: [],
        attackChain: [],
        whatNeverDo: ['Never trust a message without verifying the channel.']
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: effectiveText, url: effectiveUrl, sourceType: activeTab })
      })

      const payload = await response.json()
      const nextResult = payload?.error ? analyzePaymentPayload({ text: effectiveText, url: effectiveUrl, sourceType: activeTab }) : payload
      setAnalysis(nextResult)
      setHistory((previous) => [makeHistoryEntry(nextResult), ...previous.filter((item) => item.score !== nextResult.riskScore)].slice(0, 6))
    } catch {
      const fallback = analyzePaymentPayload({ text: effectiveText, url: effectiveUrl, sourceType: activeTab })
      setAnalysis(fallback)
      setHistory((previous) => [makeHistoryEntry(fallback), ...previous].slice(0, 6))
    } finally {
      setLoading(false)
    }
  }

  const handleLoadDemo = (label) => {
    const demo = demoExamples.find((entry) => entry.label === label)
    if (!demo) return
    setInputText(demo.message)
    setAnalysis(analyzePaymentPayload({ text: demo.message }))
  }

  const handleRunLiveDemo = () => {
    setJudgeMode(true)
    setInputText(liveSimulationMessage)
    const demoResult = analyzePaymentPayload({ text: liveSimulationMessage })
    setAnalysis(demoResult)
    setHistory((previous) => [makeHistoryEntry(demoResult), ...previous].slice(0, 6))
  }

  const handleWhatIf = () => {
    setAnalysis(whatIfResult || analyzePaymentPayload({ text: inputText }))
  }

  const handleAnalyze = () => {
    if (activeTab === 'url') {
      analyzeCurrentInput(inputText, urlInput)
      return
    }

    if (activeTab === 'screenshot') {
      analyzeCurrentInput(ocrText || inputText, '')
      return
    }

    analyzeCurrentInput(inputText, urlInput)
  }

  const prepareImageForOcr = async (file) => {
    const imageUrl = URL.createObjectURL(file)

    try {
      const image = await new Promise((resolve, reject) => {
        const nextImage = new Image()
        nextImage.onload = () => resolve(nextImage)
        nextImage.onerror = reject
        nextImage.src = imageUrl
      })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      const maxWidth = 1800
      const scale = Math.min(1, maxWidth / image.width)

      canvas.width = Math.max(800, Math.round(image.width * scale))
      canvas.height = Math.round(image.height * scale)

      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = imageData.data

      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index]
        const green = pixels[index + 1]
        const blue = pixels[index + 2]
        const luminance = 0.299 * red + 0.587 * green + 0.114 * blue
        const monochrome = luminance > 185 ? 255 : 0
        pixels[index] = monochrome
        pixels[index + 1] = monochrome
        pixels[index + 2] = monochrome
      }

      context.putImageData(imageData, 0, 0)
      return canvas
    } finally {
      URL.revokeObjectURL(imageUrl)
    }
  }

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImagePreview(URL.createObjectURL(file))
    setOcrStatus('Reading screenshot...')
    setLoading(true)

    try {
      const processedImage = await prepareImageForOcr(file)
      const result = await Tesseract.recognize(processedImage, 'eng', {
        psm: 6,
        oem: 1,
        logger: (message) => {
          if (message.status === 'recognizing text') {
            setOcrStatus(`Reading screenshot... ${Math.round(message.progress * 100)}%`)
          }
        }
      })

      const rawText = result?.data?.text || ''
      const cleanedText = String(rawText)
        .replace(/\s*\n\s*/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/[|_~`]+/g, ' ')
        .replace(/\b([A-Za-z])\s+\d\s+([A-Za-z])\b/g, '$1$2')
        .trim()

      const extractedText = cleanedText || `Uploaded screenshot: ${file.name}`
      setOcrText(extractedText)
      setInputText(extractedText)
      setOcrStatus('Screenshot processed successfully.')
      await analyzeCurrentInput(extractedText, '')
    } catch {
      const fallbackText = `Uploaded screenshot: ${file.name}`
      setOcrText(fallbackText)
      setInputText(fallbackText)
      setOcrStatus('Screenshot uploaded, but OCR could not read it. You can still analyze the file name and message context.')
      await analyzeCurrentInput(fallbackText, '')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar glass-panel">
        <div className="brand-wrap">
          <div className="brand-mark">P</div>
          <div>
            <div className="brand-name">PayGuard AI</div>
            <div className="brand-subtitle">Before You Pay, Let PayGuard Think.</div>
          </div>
        </div>

        <nav className="nav-links">
          <a href="#analyze">Analyze</a>
          <a href="#risk-history">Risk History</a>
          <a href="#intelligence">Scam Intelligence</a>
          <a href="#architecture">How it works</a>
        </nav>

        <div className="header-actions">
          <button type="button" className="ghost-button" onClick={() => setPrivacyMode((value) => !value)}>
            {privacyMode ? 'Privacy Mode On' : 'Privacy Mode Off'}
          </button>
          <button type="button" className="primary-button" onClick={handleRunLiveDemo}>JUDGE MODE</button>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <span className="eyebrow">PAYMENT MOMENT DETECTED</span>
            <h1>Protect your payment before it becomes a loss.</h1>
            <p>
              PayGuard is an intelligent security assistant that analyzes suspicious payment messages, links and screenshots before the user loses money.
            </p>
            <div className="cta-row">
              <a href="#analyze" className="primary-button">CHECK A PAYMENT</a>
            </div>
            <div className="hero-metrics">
              <div className="mini-stat"><strong>91%</strong><span>Risk signal</span></div>
              <div className="mini-stat"><strong>4 layers</strong><span>Intent detection</span></div>
              <div className="mini-stat"><strong>0 OTP</strong><span>Never asks for credentials</span></div>
            </div>
          </div>

          <div className="signal-flow glass-panel">
            <div className="flow-label">MESSAGE → SIGNALS → RISK → ACTION</div>
            <div className="flow-row">
              <span>MESSAGE</span>
              <span className="arrow">→</span>
              <span>SIGNALS</span>
              <span className="arrow">→</span>
              <span>RISK</span>
              <span className="arrow">→</span>
              <span>ACTION</span>
            </div>
            <div className="security-layers">
              <div className="layer-pill">Language intelligence</div>
              <div className="layer-pill">URL analysis</div>
              <div className="layer-pill">Context scoring</div>
            </div>
          </div>
        </section>

        <section id="analyze" className="dashboard-grid">
          <div className="analysis-panel glass-panel">
            <div className="panel-header-row">
              <div>
                <p className="panel-kicker">1. Analyze Payment</p>
                <h2>Is this payment safe?</h2>
              </div>
              <span className="panel-score">Heuristic / AI-assisted</span>
            </div>

            <div className="tabs">
              {tabs.map((tab) => (
                <button key={tab} type="button" className={tab === activeTab ? 'tab active' : 'tab'} onClick={() => setActiveTab(tab)}>
                  {tab === 'payment request' ? 'Payment Request' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {activeTab === 'url' ? (
              <>
                <input
                  type="url"
                  className="url-input"
                  value={urlInput}
                  onChange={(event) => setUrlInput(event.target.value)}
                  placeholder="Paste the suspicious payment link or website URL"
                />
                <textarea
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  placeholder="Optional: add surrounding message text to help the analysis"
                />
              </>
            ) : activeTab === 'screenshot' ? (
              <>
                <label className="upload-box">
                  <input type="file" accept="image/*" onChange={handleImageUpload} />
                  <span>Upload screenshot or payment image</span>
                </label>

                {imagePreview ? <img src={imagePreview} alt="Uploaded preview" className="uploaded-preview" /> : null}

                {ocrStatus ? <p className="ocr-status">{ocrStatus}</p> : null}

                <textarea
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  placeholder="OCR text will appear here after upload, or paste extra message text manually"
                />
              </>
            ) : (
              <textarea
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                placeholder="Paste a WhatsApp message, SMS, UPI request, payment link, or suspicious notification..."
              />
            )}

            <div className="action-row">
              <button type="button" className="primary-button" onClick={handleAnalyze} disabled={loading}>
                {loading ? 'Evaluating payment risk...' : 'ANALYZE PAYMENT'}
              </button>
            </div>

            <div className="sample-list">
              <span>Quick demo</span>
              {demoExamples.slice(0, 5).map((item) => (
                <button key={item.id} type="button" className="sample-item" onClick={() => handleLoadDemo(item.label)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="results-panel glass-panel">
            <div className="result-header">
              <div>
                <p className="panel-kicker">Decision</p>
                <h2>{analysis.riskLevel || 'ANALYZING'}</h2>
              </div>
              <span className={`risk-pill ${riskTone}`}>{analysis.riskScore || 0}/100</span>
            </div>

            <div className="score-grid">
              <div className="stat-card">
                <span>Risk score</span>
                <strong>{analysis.riskScore || 0}</strong>
              </div>
              <div className="stat-card">
                <span>Confidence</span>
                <strong>{analysis.confidence || 0}%</strong>
              </div>
              <div className="stat-card">
                <span>Safety score</span>
                <strong>{analysis.safetyScore || 0}/100</strong>
              </div>
            </div>

            <div className="result-alert">
              <div className="alert-label">PAYMENT MOMENT</div>
              <div className="alert-message">{analysis.riskLevel === 'HIGH RISK' ? 'STOP — THINK — VERIFY' : 'Review the request through a verified channel before acting.'}</div>
            </div>

            <div className="summary-block">
              <p>{analysis.explanation || 'Analyzing message behavior...'}</p>
            </div>

            <div className="decision-steps">
              {simulationSteps.map((step, index) => (
                <div key={step} className={judgeMode && index <= judgeStep ? 'step active' : 'step'}>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="details-grid">
          <div className="info-card glass-panel wide-card">
            <p className="panel-kicker">2. Why am I at risk?</p>
            <h3>Risk breakdown</h3>
            <div className="risk-stack">
              {(analysis.redFlags || []).length ? (
                analysis.redFlags.map((flag) => (
                  <div key={flag.label} className="risk-row">
                    <span>{flag.label}</span>
                    <strong>+{flag.points}</strong>
                  </div>
                ))
              ) : (
                <div className="risk-row neutral">
                  <span>No strong risk markers detected.</span>
                  <strong>+0</strong>
                </div>
              )}
            </div>
          </div>

          <div className="info-card glass-panel">
            <p className="panel-kicker">3. SCAM DNA</p>
            <h3>Behavioral Scam DNA</h3>
            <div className="dna-stack">
              {(analysis.scamDNA || []).map((signal) => (
                <div key={signal.label} className="dna-row">
                  <span>{signal.label}</span>
                  <div className="dna-bar"><i style={{ width: `${signal.value}%` }} /></div>
                  <strong>{signal.value}%</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="details-grid second-row">
          <div className="info-card glass-panel">
            <p className="panel-kicker">4. SCAM STORY</p>
            <h3>Plain language explanation</h3>
            <p className="story-copy">{analysis.explanation || 'No scam story available yet.'}</p>
          </div>

          <div className="info-card glass-panel">
            <p className="panel-kicker">5. CLAIM vs EVIDENCE</p>
            <h3>Trust mismatch</h3>
            <div className="claim-box">
              <div>
                <small>CLAIM</small>
                <p>{analysis.claimVsEvidence?.claim || 'No claim detected.'}</p>
              </div>
              <div>
                <small>EVIDENCE</small>
                <p>{analysis.claimVsEvidence?.evidence || 'No evidence available.'}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="timeline-section glass-panel">
          <div className="panel-header-row">
            <div>
              <p className="panel-kicker">6. Attack chain</p>
              <h3>Possible Scam Attack Chain</h3>
            </div>
          </div>
          <div className="timeline">
            {(analysis.attackChain || []).map((step) => (
              <div key={step.stage} className={step.active ? 'timeline-step active' : 'timeline-step'}>
                <span>{step.stage}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="tool-grid">
          <div className="info-card glass-panel">
            <p className="panel-kicker">7. What should I do now?</p>
            <h3>Recommended actions</h3>
            <ul className="action-list">
              {(analysis.recommendations || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="cta-row compact">
              <button type="button" className="primary-button">VERIFY SAFELY</button>
              <button type="button" className="secondary-button" onClick={handleAnalyze}>ANALYZE ANOTHER MESSAGE</button>
              <button type="button" className="ghost-button">REPORT SCAM</button>
            </div>
          </div>

          <div className="info-card glass-panel">
            <p className="panel-kicker">8. Payment Safety Score</p>
            <h3>{analysis.safetyScore || 0}/100</h3>
            <div className="safety-note">
              <p>+ Verified-looking domain</p>
              <p>+ No OTP request</p>
              <p>- High urgency</p>
              <p>- Suspicious payment link</p>
            </div>
          </div>
        </section>

        <section id="intelligence" className="info-card glass-panel architecture-panel">
          <p className="panel-kicker">9. Scam Intelligence</p>
          <h3>Primary threat + secondary signals</h3>
          <div className="threat-summary">
            <div className="threat-primary">{analysis.primaryThreat || 'No primary threat identified'}</div>
            <div className="secondary-tags">
              {(analysis.secondarySignals || []).length ? (
                analysis.secondarySignals.map((signal) => <span key={signal}>{signal}</span>)
              ) : (
                <span>No secondary patterns</span>
              )}
            </div>
          </div>
        </section>

        <section className="what-if glass-panel">
          <div className="panel-header-row">
            <div>
              <p className="panel-kicker">10. What if?</p>
              <h3>What if I change this message?</h3>
            </div>
          </div>
          <textarea value={whatIfText} onChange={(event) => setWhatIfText(event.target.value)} placeholder="Edit the message to see how the risk score changes..." />
          <button type="button" className="secondary-button" onClick={handleWhatIf}>Recalculate risk</button>

          {whatIfResult ? (
            <div className="what-if-result">
              <div className="risk-row"><span>Urgency</span><strong>{whatIfResult.scamDNA[0]?.value || 0}%</strong></div>
              <div className="risk-row"><span>Fear</span><strong>{whatIfResult.scamDNA[2]?.value || 0}%</strong></div>
              <div className="risk-row"><span>Payment pressure</span><strong>{whatIfResult.scamDNA[3]?.value || 0}%</strong></div>
              <div className="risk-row"><span>Risk score</span><strong>{whatIfResult.riskScore || 0}/100</strong></div>
            </div>
          ) : null}
        </section>

        <section id="risk-history" className="history-section glass-panel">
          <div className="panel-header-row">
            <div>
              <p className="panel-kicker">11. Risk History</p>
              <h3>Local payment checks</h3>
            </div>
          </div>
          <div className="history-list">
            {history.map((entry) => (
              <div key={entry.id} className="history-item">
                <div className="history-meta">
                  <span>{entry.time}</span>
                  <strong>{entry.label}</strong>
                </div>
                <div className={`history-status ${entry.status.toLowerCase().replace(' ', '-')}`}>
                  {entry.status}
                </div>
                <div className="history-score">{entry.score}/100</div>
              </div>
            ))}
          </div>
        </section>

        <section id="architecture" className="architecture-section glass-panel">
          <p className="panel-kicker">12. How PayGuard Works</p>
          <h3>Layered security architecture</h3>
          <div className="architecture-diagram">
            <div className="diagram-stage">User Input</div>
            <div className="diagram-arrow">↓</div>
            <div className="diagram-stage">Input Normalization</div>
            <div className="diagram-arrow">↓</div>
            <div className="diagram-stage">Text / URL / OCR</div>
            <div className="diagram-arrow">↓</div>
            <div className="diagram-stage">Scam Signal Extraction</div>
            <div className="diagram-arrow">↓</div>
            <div className="diagram-stage">Rule Engine + AI + URL Intelligence</div>
            <div className="diagram-arrow">↓</div>
            <div className="diagram-stage">Risk Scoring</div>
            <div className="diagram-arrow">↓</div>
            <div className="diagram-stage">Explainable Decision</div>
            <div className="diagram-arrow">↓</div>
            <div className="diagram-stage">Safety Recommendation</div>
          </div>
        </section>

        <section className="safety-center glass-panel">
          <div className="panel-header-row">
            <div>
              <p className="panel-kicker">13. Safety Center</p>
              <h3>Privacy-first design</h3>
            </div>
          </div>
          <div className="privacy-box">
            <strong>PRIVACY MODE</strong>
            <p>
              Your financial safety matters. PayGuard minimizes unnecessary data storage and never asks for your UPI PIN, password or OTP.
            </p>
            <div className="warning-banner">PayGuard will NEVER ask for your OTP, UPI PIN or banking password.</div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
