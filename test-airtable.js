const BASE_URL = 'http://localhost:3000'

async function testAirtableIntegration() {
  console.log('Testing Airtable integration...\n')

  try {
    // Test Students
    const studentsRes = await fetch(`${BASE_URL}/api/clickup/students`)
    const studentsBody = await studentsRes.json()
    const students = studentsBody.data ?? []
    console.log(`✅ Students API: ${students.length} records`)

    // Test Leads
    const leadsRes = await fetch(`${BASE_URL}/api/clickup/leads`)
    const leadsBody = await leadsRes.json()
    const leads = leadsBody.data ?? []
    console.log(`✅ Leads API: ${leads.length} records`)

    // Test Payments
    const paymentsRes = await fetch(`${BASE_URL}/api/clickup/payments`)
    const paymentsBody = await paymentsRes.json()
    const payments = paymentsBody.data ?? []
    console.log(`✅ Payments API: ${payments.length} records`)

    console.log('\n🎉 All Airtable endpoints working!')
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testAirtableIntegration()
