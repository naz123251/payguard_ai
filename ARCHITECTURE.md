# PayGuard AI Architecture

## Layered architecture

User Input
↓
Input Normalization
↓
Text / URL / OCR extraction
↓
Scam Signal Extraction
↓
Rule-based Security Engine + AI / NLP + URL Intelligence + Contextual Risk Analysis
↓
Risk Scoring Engine
↓
Explainable Decision
↓
Safety Recommendation

## Frontend
The React app provides a premium cybersecurity dashboard with landing page, analysis form, risk history, scam DNA, judge mode, and privacy-first design.

## Backend API
The Express server exposes `/api/analyze` and `/api/health` endpoints. Requests are validated and passed through a deterministic engine by default.

## AI integration strategy
The backend checks for `PAYGUARD_AI_KEY`.

- If present: request a semantic analysis to augment the result
- If absent: use deterministic rule-engine fallback
- If the AI call fails: gracefully fall back to the local scoring engine

The application never exposes secrets in the frontend bundle.

## Risk engine
The engine combines weighted heuristics from:

- urgency signals
- threat or fear language
- impersonation patterns
- payment request detection
- sensitive info requests
- suspicious URL inspection
- claim vs evidence mismatch

These factors are normalized to a single 0–100 heuristic score.

## Data handling
- Browser-only local history
- No OTP or password collection
- No raw stack trace exposure to end users
- Safe parsing only

## Demo path
The live demo uses a fictional, non-real payment scam example to show the full detection pipeline in a short and convincing presentation flow.
