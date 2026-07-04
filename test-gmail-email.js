const testData = {
  to: "darklightchess64@gmail.com",
  subject: "✅ Darklight AIOS - Gmail Test Email",
  message: "This is a real email sent via Gmail SMTP from Darklight Chess Academy AIOS.\n\nIf you received this, Gmail integration is working!"
};

async function testGmailEmail() {
  console.log('Testing Gmail SMTP via /api/communications/email...\n');

  try {
    const response = await fetch('http://localhost:3000/api/communications/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Success:', data.success);
    console.log('Message ID:', data.messageId);

    if (data.success && data.messageId && !String(data.messageId).startsWith('mock-')) {
      console.log('\n✅ EMAIL SENT VIA GMAIL! Check the inbox at', testData.to);
    } else if (data.success) {
      console.log('\n⚠️ Request succeeded but Gmail looks unconfigured (mock messageId). Check GMAIL_USER/GMAIL_APP_PASSWORD in .env.local.');
    } else {
      console.log('\n❌ Email failed:', data.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Make sure `npm run dev` is running on http://localhost:3000');
  }
}

testGmailEmail();
