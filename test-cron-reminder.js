const fs = require('fs')

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

async function testCronReminders() {
  console.log('Testing /api/cron/daily-reminders...\n')

  try {
    const response = await fetch('http://localhost:3000/api/cron/daily-reminders', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.CRON_SECRET}`,
      },
    })

    const data = await response.json()

    console.log('✅ Status:', response.status)
    console.log('✅ Success:', data.success)
    console.log('✅ Reminders Processed:', data.remindersProcessed)
    console.log('✅ Emails Sent:', data.emailsSent)
    console.log('✅ WhatsApp Sent:', data.whatsappSent)
    console.log('✅ Success Count:', data.successCount)
    console.log('✅ Failure Count:', data.failureCount)
    console.log('✅ Timestamp:', data.timestamp)

    if (data.success && data.remindersProcessed > 0 && data.emailsSent > 0 && data.whatsappSent > 0) {
      console.log('\n✅ DAILY REMINDERS CRON WORKS!')
    } else {
      console.log('\n❌ Cron did not process reminders as expected')
      console.log('Full response:', JSON.stringify(data, null, 2))
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testCronReminders()
