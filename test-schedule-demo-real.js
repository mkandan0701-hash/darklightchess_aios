const testData = {
  leadId: "LEAD_1719399000000",
  parentEmail: "raj@gmail.com",
  parentName: "Raj Kumar",
  parentPhone: "+919876543210",
  coachId: "C1",
  coachEmail: "coach@darklight.com",
  coachName: "Manikandan",
  selectedDate: "2026-08-01",
  selectedTime: "15:00"
};

async function testDemoScheduling() {
  console.log('🧪 Testing /api/schedule-demo endpoint...\n');

  try {
    const response = await fetch('http://localhost:3000/api/schedule-demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    const data = await response.json();

    console.log('✅ Response Status:', response.status);
    console.log('✅ Success:', data.success);
    console.log('✅ Lead ID:', data.leadId);
    console.log('✅ Meet Link:', data.meetLink);
    console.log('✅ Event ID:', data.eventId);
    console.log('✅ Confirmed At:', data.confirmedAt);

    if (data.meetLink && data.meetLink.includes('meet.google.com')) {
      console.log('\n🎉 SUCCESS! Real Google Meet link created!\n');
      console.log('Next steps:');
      console.log('1. Check your Google Calendar for the new event');
      console.log('2. Event: "Chess Demo Class - Raj Kumar"');
      console.log('3. Date: August 1, 2026 at 3:00 PM');
      console.log('4. Meet link should be attached to the event');
    } else {
      console.log('\n⚠️ WARNING: Meet link looks wrong or missing');
      console.log('Full response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Make sure:');
    console.error('1. Dev server is running (npm run dev)');
    console.error('2. GOOGLE_REFRESH_TOKEN is in .env.local');
    console.error('3. Dev server was restarted after adding token');
  }
}

testDemoScheduling();
