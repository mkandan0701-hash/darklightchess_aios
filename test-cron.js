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

fetch('http://localhost:3000/api/cron/daily-reminders', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.CRON_SECRET}`,
  },
})
  .then(r => r.json())
  .then(d => console.log('Response:', JSON.stringify(d, null, 2)))
  .catch(e => console.error('Error:', e))
