const fs = require('fs')
const crypto = require('crypto')

function loadEnvLocal() {
  const env = {}
  const content = fs.readFileSync('.env.local', 'utf8')
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) env[match[1]] = match[2].trim()
  }
  return env
}

const env = loadEnvLocal()

const testPayload = {
  "event": "payment.authorized",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_1234567890",
        "amount": 500000,
        "currency": "INR",
        "status": "captured",
        "email": "raj@gmail.com",
        "method": "card",
        "notes": {
          "studentId": "STU_001",
          "studentName": "Raj Kumar",
          "parentPhone": "+919876543210",
          "coachName": "Manikandan"
        },
        "created_at": Math.floor(Date.now() / 1000)
      }
    }
  }
};

const rawBody = JSON.stringify(testPayload)
const signature = crypto
  .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
  .update(rawBody)
  .digest('hex')

fetch('http://localhost:3000/api/webhooks/payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-razorpay-signature': signature,
  },
  body: rawBody,
})
.then(r => r.json())
.then(d => console.log('Response:', JSON.stringify(d, null, 2)))
.catch(e => console.error('Error:', e))
