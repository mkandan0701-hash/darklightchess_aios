const response = await fetch('http://localhost:3000/api/webhooks/lead-capture', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Raj Kumar',
    email: 'raj@gmail.com',
    phone: '+919876543210',
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
