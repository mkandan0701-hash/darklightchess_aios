const testData = {
  studentId: "STU_001",
  studentName: "Test Student",
  parentEmail: "test@gmail.com",
  parentPhone: "+919876543210",
  amount: 5000,
  currency: "INR",
  coachName: "Manikandan"
};

async function testPaymentLink() {
  console.log('Testing /api/payment-link...\n');

  try {
    const response = await fetch('http://localhost:3000/api/payment-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    const data = await response.json();

    console.log('✅ Status:', response.status);
    console.log('✅ Success:', data.success);
    console.log('✅ Payment Link:', data.paymentLink);
    console.log('✅ Invoice ID:', data.invoiceId);
    console.log('✅ Expires At:', data.expiresAt);

    if (data.paymentLink && data.paymentLink.includes('rzp.io')) {
      console.log('\n✅ PAYMENT LINK WORKS!');
    } else {
      console.log('\n❌ Payment link missing');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPaymentLink();
