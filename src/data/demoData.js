export const liveSimulationMessage = 'Hello, I am Rajesh uncle, your father\'s friend. I am in hospital and need money urgently. Please transfer ₹50,000 to this account immediately or I will not be able to pay the hospital bill.'

export const demoExamples = [
  {
    id: 'safe-1',
    label: 'Safe banking update',
    status: 'SAFE',
    score: 12,
    message: 'Your SBI account is active. No payment is required. Please continue using the official SBI app only.'
  },
  {
    id: 'safe-2',
    label: 'Order status',
    status: 'SAFE',
    score: 18,
    message: 'Your order from UrbanCart has been delivered. No payment is required. Login to the app to view the tracking details.'
  },
  {
    id: 'safe-3',
    label: 'Electricity utility reminder',
    status: 'SAFE',
    score: 16,
    message: 'Your bill reminder is due. Please log in to your official utility account to review the amount.'
  },
  {
    id: 'safe-4',
    label: 'KYC review',
    status: 'SAFE',
    score: 11,
    message: 'KYC review completed. Use the official portal to check the approval status. No action is required.'
  },
  {
    id: 'safe-5',
    label: 'Support follow-up',
    status: 'SAFE',
    score: 9,
    message: 'We reviewed your request. Please use the official service app to continue. No payment link was sent.'
  },
  {
    id: 'suspicious-1',
    label: 'Urgent bank verification',
    status: 'SUSPICIOUS',
    score: 46,
    message: 'URGENT: Your ICICI account may be limited today. Open the verification link below to avoid account freezing.'
  },
  {
    id: 'suspicious-2',
    label: 'Loan update',
    status: 'SUSPICIOUS',
    score: 58,
    message: 'Your loan document is pending. Complete cost confirmation through this link to avoid delay: secure-pay-verify.in/loan.'
  },
  {
    id: 'suspicious-3',
    label: 'Delivery fee',
    status: 'SUSPICIOUS',
    score: 63,
    message: 'Your parcel is pending because a small redelivery charge is due. Pay the fee here: bit.ly/pay-now-ship.'
  },
  {
    id: 'suspicious-4',
    label: 'KYC challenge',
    status: 'SUSPICIOUS',
    score: 52,
    message: 'We need to verify your KYC immediately. Use the link and enter your OTP to keep your account active.'
  },
  {
    id: 'suspicious-5',
    label: 'Prize offer',
    status: 'SUSPICIOUS',
    score: 54,
    message: 'Congratulations! You have won a cash reward. Confirm the prize by paying a small processing fee through the link.'
  },
  {
    id: 'high-1',
    label: 'Electricity disconnect',
    status: 'HIGH RISK',
    score: 91,
    message: 'URGENT: Your electricity connection will be disconnected today. Pay ₹2,499 immediately using the link below or your power service will be suspended.'
  },
  {
    id: 'high-2',
    label: 'Bank impersonation',
    status: 'HIGH RISK',
    score: 88,
    message: 'Your SBI account will be blocked today unless you complete a verification. Pay fee via UPI and send OTP to confirm access.'
  },
  {
    id: 'high-3',
    label: 'Refund scam',
    status: 'HIGH RISK',
    score: 82,
    message: 'Refund failed on your card. Click to reverse the charge and share your OTP to claim the amount. secure-pay-refund.xyz.'
  },
  {
    id: 'high-4',
    label: 'Investment scam',
    status: 'HIGH RISK',
    score: 90,
    message: 'Guaranteed return on investment in 48 hours. Deposit ₹25,000 to unlock your trading account; share your bank PIN to proceed.'
  },
  {
    id: 'high-5',
    label: 'Support impersonation',
    status: 'HIGH RISK',
    score: 95,
    message: 'Our WhatsApp support team detected a suspicious login. Verify your device by visiting hxxp://45.137.198.11/secure and approve the payment request now.'
  }
]
