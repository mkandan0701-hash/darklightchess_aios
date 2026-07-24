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

async function testLeadCapture() {
  const response = await fetch('http://localhost:3000/api/webhooks/lead-capture', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-lead-webhook-secret': env.LEAD_WEBHOOK_SECRET,
    },
    body: JSON.stringify({
      name: 'Mani Kandan',
      email: 'mkandan0701@gmail.com',
      phone: '+919345774349',
      source: 'Website',
      available_days: ['Mon', 'Wed'],
      available_time: '3 PM - 6 PM',
    }),
  });

  const data = await response.json();

  console.log('Status:', response.status);
  console.log(response.ok ? 'SUCCESS' : 'ERROR');
  console.log('leadId:', data.leadId ?? 'N/A');
  console.log('Full response:', JSON.stringify(data, null, 2));
}

testLeadCapture()
