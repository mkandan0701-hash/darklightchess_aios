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
  event: 'payment.authorized',
  payload: {
    payment: {
      entity: {
        id: 'pay_' + Date.now(),
        amount: 500000,
        currency: 'INR',
        status: 'captured',
        email: 'raj@gmail.com',
        method: 'card',
        notes: {
          studentId: 'STU_001',
          studentName: 'Raj Kumar',
          parentPhone: '+919876543210',
          coachName: 'Manikandan',
        },
        created_at: Math.floor(Date.now() / 1000),
      },
    },
  },
}

const rawBody = JSON.stringify(testPayload)
const signature = crypto
  .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
  .update(rawBody)
  .digest('hex')

async function testPaymentWebhook() {
  console.log('Testing /api/webhooks/payment...\n')

  try {
    const response = await fetch('http://localhost:3000/api/webhooks/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature,
      },
      body: rawBody,
    })

    const data = await response.json()

    console.log('✅ Status:', response.status)
    console.log('✅ Success:', data.success)
    console.log('✅ Payment ID:', data.paymentId)
    console.log('✅ Student ID:', data.studentId)
    console.log('✅ Receipt Sent:', data.receiptSent)
    console.log('✅ Enrollment Updated:', data.enrollmentUpdated)
    console.log('✅ Processed At:', data.processedAt)

    if (data.success && data.receiptSent && data.enrollmentUpdated) {
      console.log('\n✅ PAYMENT WEBHOOK WORKS!')
    } else {
      console.log('\n❌ Webhook did not fully process')
      console.log('Full response:', JSON.stringify(data, null, 2))
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testPaymentWebhook()
