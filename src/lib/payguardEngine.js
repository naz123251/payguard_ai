const URL_SHORTENERS = /(bit\.ly|tinyurl|t\.co|goo\.gl|rebrandly|cutt\.ly|shorturl|tiny\.cc|is\.gd)/i
const SUSPICIOUS_TLDS = /(tk|ml|ga|cf|xyz|club|top|bid|loan|vip|pw)/i
const FAKE_DOMAIN_HINTS = /(verify|secure|login|account|update|payment|otp|kyc|bank|upi|confirm|alert|portal)/i
const ORG_HINTS = ['sbi', 'hdfc', 'icici', 'axis', 'kotak', 'airtel', 'jio', 'lic', 'electricity', 'amazon', 'delivery', 'bank', 'government', 'upi', 'karnataka']

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getUrlInfo = (rawUrl) => {
  if (!rawUrl) return { risk: 0, flags: [] }

  const normalized = rawUrl.trim()
  const candidate = normalized.startsWith('http') ? normalized : `https://${normalized}`
  const flags = []
  let risk = 0

  try {
    const url = new URL(candidate)
    const host = url.hostname.toLowerCase()
    const path = (url.pathname || '').toLowerCase()
    const firstLabel = host.split('.')[0] || ''

    if (!url.protocol.startsWith('http')) {
      risk += 8
      flags.push('Non-HTTPS or non-web scheme detected')
    }

    if (URL_SHORTENERS.test(host)) {
      risk += 24
      flags.push('URL shortener detected')
    }

    if (SUSPICIOUS_TLDS.test(host)) {
      risk += 28
      flags.push('Suspicious top-level domain')
    }

    if (/\d{1,3}(?:\.\d{1,3}){3}/.test(host)) {
      risk += 16
      flags.push('IP-based host instead of a normal domain')
    }

    if ((host.match(/\./g) || []).length > 3 || host.split('.').length > 3) {
      risk += 10
      flags.push('Excessive subdomain nesting')
    }

    if (host.includes('-') && !['paypal', 'icicidirect'].includes(firstLabel)) {
      risk += 12
      flags.push('Lookalike or hyphenated domain pattern')
    }

    if (FAKE_DOMAIN_HINTS.test(host) || FAKE_DOMAIN_HINTS.test(path)) {
      risk += 24
      flags.push('Urgent security or verification keywords detected in the domain or path')
    }

    if (/(verify|secure|login|confirm|update|alert|payment|kyc|account)/.test(host) && !/icicibank|hdfcbank|sbi|axis|kotak|paytm|phonepe|googlepay|amazon/.test(host)) {
      risk += 24
      flags.push('Financial-brand impersonation pattern detected')
    }

    if (/(paytm|sbi|hdfc|icici|axis|kotak|bank|upi|wallet)/.test(host) && !/paytm\.com|sbi\.in|hdfcbank\.com|icicibank\.com|axisbank\.com|kotak\.com|upi\.com/.test(host)) {
      risk += 18
      flags.push('Lookalike brand name used in a suspicious domain')
    }

    if (!/^https:/.test(url.protocol)) {
      risk += 8
      flags.push('HTTP is being used instead of HTTPS')
    }
  } catch {
    risk += 18
    flags.push('Malformed or likely fake URL format')
  }

  return { risk: clamp(risk, 0, 100), flags }
}

const scoreSignal = (text, patterns) => {
  const normalized = text || ''
  let score = 0
  const matches = []

  patterns.forEach((pattern) => {
    if (pattern.test(normalized)) {
      score += pattern.points
      matches.push(pattern.label)
    }
  })

  return { score, matches }
}

export function analyzePaymentPayload({ text = '', url = '', sourceType = 'message' } = {}) {
  const rawText = String(text || '').trim()
  const normalizedText = rawText.replace(/[₹₨]/g, ' rs ')
  const safeUrl = url || rawText.match(/https?:\/\/[^\s]+|www\.[^\s]+/i)?.[0] || ''
  const lower = normalizedText.toLowerCase()

  const redFlags = []
  let totalRisk = 0

  const addFlag = (label, points, explanation, category) => {
    totalRisk += points
    redFlags.push({ label, points, explanation, category })
  }

  const patternGroups = [
    { label: 'Urgency Pressure', points: 18, category: 'urgency', regex: /(urgent|immediately|today|asap|right away|before midnight|within .*minutes|deadline|pay now)/i },
    { label: 'Threat/Disconnection Warning', points: 16, category: 'fear', regex: /(blocked|freeze|suspend|disconnect|deactivate|account.*blocked|service.*suspended|penalty|legal action|police|fraud case)/i },
    { label: 'Emergency / Medical Crisis', points: 18, category: 'emergency', regex: /(hospital|medical|emergency|accident|operation|icu|critical|in trouble|not well|surgery|doctor|ambulance)/i },
    { label: 'Trusted Contact Impersonation', points: 18, category: 'impersonation', regex: /(uncle|aunt|cousin|brother|sister|father|mother|dad|mom|relative|family friend|friend.*hospital|family.*emergency)/i },
    { label: 'Impersonation Signal', points: 20, category: 'impersonation', regex: /(sbi|hdfc|icici|axis|kotak|airtel|jio|amazon|delivery|government|support team|customer care|banking team)/i },
    { label: 'Payment Push', points: 20, category: 'payment_push', regex: /((pay|payment|pay now|make payment|send money|send funds|need.*money|upi|scan qr|qr code|payment link|pay via|credit to|transfer to|transfer.*money|collect payment|need.*urgent.*money).*(\d|$)|(?:pay|payment|transfer|send).*(\d))/i },
    { label: 'OTP / PIN Request', points: 26, category: 'otp_request', regex: /(otp|one time password|upi pin|cvv|card pin|bank password|secret code)/i },
    { label: 'Fear / Emotional Pressure', points: 14, category: 'fear', regex: /(will be lost|otherwise|be careful|immediately|unless you act|avoid delay|this is final warning|i am in trouble)/i },
    { label: 'Reward or Prize Bait', points: 12, category: 'reward', regex: /(winner|lottery|gift card|prize|cashback|bonus|congratulations|free reward|reward claim)/i },
    { label: 'Investment / Job Lure', points: 12, category: 'investment', regex: /(remote job|work from home|guaranteed returns|profit|investment|stock|crypto|trading|salary advance)/i },
    { label: 'KYC or Compliance Pressure', points: 16, category: 'kyc', regex: /(kyc|verification|identity check|document update|update profile|reverify account|required verification)/i },
    { label: 'Refund / Chargeback Scam', points: 14, category: 'refund', regex: /(refund|chargeback|claim refund|money reversal|payment failed|dispute amount)/i }
  ]

  const detection = patternGroups.reduce((acc, pattern) => {
    if (pattern.regex.test(lower)) {
      acc.push({ label: pattern.label, points: pattern.points, category: pattern.category })
      totalRisk += pattern.points
      redFlags.push({ label: pattern.label, points: pattern.points, explanation: `Matched a ${pattern.category.replace('_', ' ')} pattern in the message.`, category: pattern.category })
    }
    return acc
  }, [])

  const amountMatches = [...normalizedText.matchAll(/(?:pay|payment|amount|rs|inr|rupees)\s*[:=]?\s*(\d[\d,\.]{1,8})|(?:\d[\d,\.]{1,8})\s*(?:rs|inr|rupees|amount)/gi)]
  const hasPaymentAmount = amountMatches.length > 0
  if (hasPaymentAmount) {
    addFlag('Payment amount requested', 12, 'The message asks for a specific money value, which is a key payment fraud pattern.', 'payment_context')
  }

  const hasRequestedInformation = /(otp|upi pin|atm pin|card number|cvv|full name|bank account|aadhaar|pan|password|secret code)/i.test(lower)
  if (hasRequestedInformation) {
    addFlag('Sensitive information requested', 18, 'The sender is asking for data that should never be shared over chat or a link.', 'data_request')
  }

  const urlInfo = getUrlInfo(safeUrl)
  if (safeUrl) {
    totalRisk += urlInfo.risk * 0.65
    if (urlInfo.flags.length) {
      urlInfo.flags.forEach((flag) => {
        redFlags.push({ label: flag, points: Math.round(urlInfo.risk / urlInfo.flags.length), explanation: 'Static URL analysis flagged a suspicious domain or payment link pattern.', category: 'url' })
      })
    }
  }

  const senderClaim = ORG_HINTS.find((hint) => lower.includes(hint))
  const domainMismatch = safeUrl && senderClaim && !safeUrl.toLowerCase().includes(senderClaim)
  if (domainMismatch) {
    addFlag('Claim does not match evidence', 14, 'The claim references a trusted entity, but the payment link or sender details do not match that organization.', 'impersonation')
  }

  const hasUrgency = /(urgent|today|immediately|before|deadline|asap)/i.test(lower)
  const hasPayment = /(pay|upi|scan|transfer|send money|send funds|need.*money|link)/i.test(lower)
  const hasThreat = /(blocked|disconnect|suspend|freeze|warning|hospital|emergency|not well|in trouble)/i.test(lower)
  const hasFamilyEmergency = /(uncle|aunt|father|mother|dad|mom|cousin|relative|family friend|hospital|emergency)/i.test(lower)

  const riskBoost = (hasUrgency && hasThreat && hasPayment ? 8 : 0) + (hasPaymentAmount && hasUrgency ? 3 : 0) + (hasFamilyEmergency && hasPayment ? 12 : 0)
  const riskScore = clamp(Math.round(totalRisk + riskBoost), 0, 100)
  const baseSafety = clamp(100 - riskScore * 0.9 + (hasUrgency ? -4 : 6) + (hasPayment ? -6 : 3), 0, 100)
  const safetyScore = clamp(Math.round(baseSafety), 0, 100)
  const riskLevel = riskScore >= 75 ? 'HIGH RISK' : riskScore >= 35 ? 'SUSPICIOUS' : 'SAFE'
  const confidence = clamp(Math.round(72 + detection.length * 4 + (safeUrl ? 6 : 0)), 70, 98)

  const scamTypeMap = [
    { key: 'bank_impersonation', match: /(sbi|hdfc|icici|axis|kotak|bank|account.*blocked)/i, label: '🏦 Bank Impersonation' },
    { key: 'upi_scam', match: /(upi|scan qr|paytm|phonepe|google pay)/i, label: '📱 UPI Scam' },
    { key: 'delivery_scam', match: /(delivery|package|courier|shipment|order)/i, label: '📦 Delivery Scam' },
    { key: 'lottery', match: /(winner|lottery|gift|prize|cashback)/i, label: '🎁 Prize/Lottery Scam' },
    { key: 'kyc', match: /(kyc|update details|verify identity)/i, label: '🪪 KYC Scam' },
    { key: 'refund', match: /(refund|chargeback|payment failed)/i, label: '🔄 Refund Scam' },
    { key: 'job', match: /(job|salary|remote work|work from home)/i, label: '💼 Job Scam' },
    { key: 'investment', match: /(investment|crypto|trading|stocks|returns)/i, label: '💰 Investment Scam' },
    { key: 'tech_support', match: /(support|tech|device|security alert|computer)/i, label: '👨‍💻 Tech Support Scam' },
    { key: 'phishing', match: /(link|verify|click here|account.*suspend)/i, label: '🔐 Phishing' }
  ]

  const matchedTypes = scamTypeMap.filter((entry) => entry.match.test(lower)).map((entry) => entry.label)
  const primaryThreat = matchedTypes[0] || (riskLevel === 'SAFE' ? '✅ No major threat detected' : '🔐 Phishing')
  const secondarySignals = matchedTypes.slice(1, 4)

  const scamDna = [
    { label: 'Urgency', value: clamp(Math.round((/(urgent|today|immediately|deadline)/i.test(lower) ? 92 : 20) + (hasUrgency ? 10 : 0)), 0, 100) },
    { label: 'Impersonation', value: clamp(Math.round((/(bank|support team|government)/i.test(lower) ? 82 : 24) + (senderClaim ? 12 : 0)), 0, 100) },
    { label: 'Fear', value: clamp(Math.round((hasThreat ? 78 : 18) + (/(warning|blocked|suspend|disconnect)/i.test(lower) ? 16 : 0)), 0, 100) },
    { label: 'Payment Push', value: clamp(Math.round((hasPayment ? 90 : 16) + (hasPaymentAmount ? 8 : 0)), 0, 100) },
    { label: 'URL Risk', value: clamp(Math.round(urlInfo.risk || 20), 0, 100) }
  ]

  const attackChain = [
    { stage: 'Trust', active: /(official|bank|support|government|delivery)/i.test(lower) },
    { stage: 'Urgency', active: hasUrgency },
    { stage: 'Fear', active: hasThreat },
    { stage: 'Payment Request', active: hasPaymentAmount || hasPayment },
    { stage: 'Suspicious Link', active: Boolean(safeUrl) },
    { stage: 'Money Loss', active: riskScore >= 70 }
  ]

  const explanation = buildScamStory({ riskScore, lower, hasUrgency, hasThreat, hasPaymentAmount, safeUrl, senderClaim })

  const claimVsEvidence = {
    claim: senderClaim ? `The message claims to be from ${senderClaim.toUpperCase()}.` : 'The message claims to represent a trusted organization.',
    evidence: safeUrl && !safeUrl.includes(senderClaim || '')
      ? '❌ Sender or domain does not match the claimed organization pattern and the payment path is outside the verified channel.'
      : '⚠️ The message is relying on authority language without verification evidence.'
  }

  const recommendations = [
    '❌ Do not click the link or open the payment page.',
    '❌ Do not share OTP, UPI PIN, card CVV or banking password.',
    '❌ Do not approve the request without checking the official app or website.',
    '✅ Open the official app manually and verify the request through a known contact method.',
    '✅ If the payment is already made, block the card or contact the bank immediately.'
  ]

  const safeNextStep = riskScore >= 70
    ? 'Use the official app, call the verified support helpline, and confirm the request before taking any action.'
    : 'Verify the message directly with the official organization before proceeding.'

  return {
    sourceType,
    riskLevel,
    riskScore,
    safetyScore,
    confidence,
    scamType: primaryThreat,
    primaryThreat,
    secondarySignals,
    explanation,
    redFlags: redFlags.slice(0, 6),
    evidenceUsed: [
      safeUrl ? `Link: ${safeUrl}` : 'No URL detected in the message',
      hasUrgency ? 'Urgency language detected' : 'Urgency not strongly indicated',
      hasThreat ? 'Threat language detected' : 'Threat language not strongly indicated',
      hasPaymentAmount ? `Payment amount: ₹${amountMatches[0][1] || 'identified'}` : 'No clear amount detected'
    ],
    recommendations,
    safeNextStep,
    claimVsEvidence,
    scamDNA: scamDna,
    attackChain,
    whatNeverDo: ['Never share OTP', 'Never approve a payment without confirmation', 'Never trust a link in the message'],
    detectionLayers: {
      language: detection.length ? 'Detected' : 'No major language-risk patterns',
      url: safeUrl ? 'Link inspected' : 'No link to inspect',
      context: hasPaymentAmount || hasPayment ? 'Payment context detected' : 'No obvious payment context',
      screenshot: sourceType === 'screenshot' ? 'OCR-based extraction enabled' : 'Text-based analysis active'
    },
    summary: `${riskLevel} - ${riskScore}/100 risk score with ${confidence}% confidence.`
  }
}

function buildScamStory({ riskScore, lower, hasUrgency, hasThreat, hasPaymentAmount, safeUrl, senderClaim }) {
  if (riskScore >= 75) {
    return 'This message creates fear and pressure by claiming an urgent financial problem, then pushes the user toward a payment link or personal information request. That combination closely resembles a payment-phishing attack.'
  }

  if (riskScore >= 35) {
    return 'The message mixes urgency and payment pressure with a request for action, which increases the chance of a scam even though the evidence is not yet conclusive.'
  }

  const org = senderClaim ? senderClaim.toUpperCase() : 'the sender'
  const paymentDirection = hasPaymentAmount ? 'asks for a payment amount' : 'attempts to trigger a quick decision'
  const linkReference = safeUrl ? 'and points the user to a suspicious link' : 'without any verified channel'

  return `The text presents ${org} as a trusted source, but it also ${paymentDirection} ${linkReference}. This mismatch is typical of digitally manipulated scam content.`
}

export function getDemoCaseById(id) {
  return demoExamples.find((entry) => entry.id === id) || demoExamples[0]
}

export const demoExamples = [
  {
    id: 'safe-bank-1',
    title: 'Bank status check',
    pattern: 'safe',
    message: 'Your SBI account is active. No action is needed. For security updates, please use the official SBI app or website only.'
  },
  {
    id: 'safe-delivery-1',
    title: 'Order delivered',
    pattern: 'safe',
    message: 'Your order from UrbanCart has been delivered successfully. Track the parcel in your app; no payment is required.'
  },
  {
    id: 'safe-utility-1',
    title: 'Electricity reminder',
    pattern: 'safe',
    message: 'This is an electricity bill reminder. Please view the details in your official utility dashboard or the app before the due date.'
  },
  {
    id: 'safe-kyc-1',
    title: 'KYC update approved',
    pattern: 'safe',
    message: 'Your KYC review is complete. Please log in to the official portal to view the confirmation. No link was sent to you.'
  },
  {
    id: 'safe-support-1',
    title: 'Official support message',
    pattern: 'safe',
    message: 'We have reviewed your service request. Please contact our support desk through the official app to continue.'
  },
  {
    id: 'suspicious-1',
    title: 'Bank alert with urgency',
    pattern: 'suspicious',
    message: 'URGENT: Your ICICI account may be restricted today. Open the verification link below to avoid account freezing.'
  },
  {
    id: 'suspicious-2',
    title: 'Loan reset request',
    pattern: 'suspicious',
    message: 'Your loan application was updated. Complete payment verification by visiting https://secure-pay-verify.in/loan to continue.'
  },
  {
    id: 'suspicious-3',
    title: 'Delivery agent escalation',
    pattern: 'suspicious',
    message: 'Your parcel is pending because the delivery agent could not complete verification. Pay a small redelivery fee here: bit.ly/pay-now-ship.'
  },
  {
    id: 'suspicious-4',
    title: 'Account verification challenge',
    pattern: 'suspicious',
    message: 'We need to verify your KYC immediately or your access will be restricted. Use the link and enter your OTP.'
  },
  {
    id: 'suspicious-5',
    title: 'Prize confirmation',
    pattern: 'suspicious',
    message: 'Congratulations! You have won a cash reward. Confirm your prize by paying a processing fee through the link shown.'
  },
  {
    id: 'high-1',
    title: 'Electricity disconnect scam',
    pattern: 'high',
    message: 'URGENT: Your electricity connection will be disconnected today. Pay ₹2,499 immediately using the link below or your power service will be suspended.'
  },
  {
    id: 'high-2',
    title: 'Bank impersonation',
    pattern: 'high',
    message: 'Your SBI account will be blocked today unless you complete a verification. Pay fee via UPI and send OTP to confirm access.'
  },
  {
    id: 'high-3',
    title: 'Refund scam',
    pattern: 'high',
    message: 'Refund failed on your card. Click to reverse the charge and share your OTP to claim the amount. The link is secure-pay-refund.xyz.'
  },
  {
    id: 'high-4',
    title: 'Investment lure',
    pattern: 'high',
    message: 'Guaranteed return on investment in 48 hours. Deposit ₹25,000 to unlock your trading account; share your bank PIN to proceed.'
  },
  {
    id: 'high-5',
    title: 'Customer support scam',
    pattern: 'high',
    message: 'Our WhatsApp support team detected a suspicious login. Verify your device by visiting hxxp://45.137.198.11/secure and approve the payment request now.'
  }
]
