import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { analyzePaymentPayload } from '../src/lib/payguardEngine.js'

const app = express()
const port = Number(process.env.PORT || 3001)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distDir = path.resolve(__dirname, '../dist')

app.use(cors())
app.use(express.json({ limit: '2mb' }))

async function runAiFallback({ text, url, sourceType }) {
  const apiKey = process.env.PAYGUARD_AI_KEY?.trim()

  if (!apiKey || typeof fetch !== 'function') {
    return analyzePaymentPayload({ text, url, sourceType })
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a financial safety analyst. Return a JSON object with fields riskScore, riskLevel, confidence, primaryThreat, secondarySignals, explanation, recommendations, and scamDNA, based on the message and any provided URL.'
          },
          {
            role: 'user',
            content: JSON.stringify({ text, url, sourceType })
          }
        ],
        temperature: 0.2
      })
    })

    if (!response.ok) {
      return analyzePaymentPayload({ text, url, sourceType })
    }

    const payload = await response.json()
    const content = payload.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null

    if (parsed && typeof parsed.riskScore === 'number') {
      return {
        ...analyzePaymentPayload({ text, url, sourceType }),
        ...parsed,
        aiMode: 'enabled'
      }
    }
  } catch (error) {
    console.error('AI fallback failed, using deterministic engine:', error)
  }

  return analyzePaymentPayload({ text, url, sourceType })
}

app.post('/api/analyze', async (req, res) => {
  const { text = '', url = '', sourceType = 'message' } = req.body || {}

  if (!text.trim() && !url.trim()) {
    return res.status(400).json({
      error: 'Please enter a message, payment request, or URL to analyze.'
    })
  }

  try {
    const result = await runAiFallback({ text, url, sourceType })
    return res.json(result)
  } catch (error) {
    console.error('Analyze request failed:', error)
    return res.status(500).json({
      error: 'Failed to analyze the payment risk.',
      message: 'The rule-based fallback was unable to complete the assessment.'
    })
  }
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', product: 'PayGuard AI' })
})

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`PayGuard API listening on http://localhost:${port}`)
})
