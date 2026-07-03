# SKILL.md - Darklight Chess Academy AIOS Automation

**Claude Code skill for building automation workflows as Next.js API routes**

---

# SKILL METADATA

| Property | Value |
|----------|-------|
| **Skill Name** | Darklight AIOS Automation |
| **Approach** | Claude Code + Next.js API Routes |
| **Replaces** | n8n (visual workflows) |
| **Technologies** | Next.js, TypeScript, Node.js |
| **Build Time Per Workflow** | 20-40 minutes |
| **Total Time to Complete** | 2-3 hours |
| **Complexity** | Intermediate |

---

# SKILL DESCRIPTION

**What:** Build automated backend API routes that handle lead capture, scheduling, payments, and reminders

**Why:** 
- No separate service needed (n8n)
- Everything in one Next.js project
- Full control via JavaScript
- Cheaper (no n8n subscription)
- Easier to maintain

**How:** 
- Create `/api/` route handlers
- Import utility functions (coach matcher, email sender, etc.)
- Connect to external APIs (ClickUp, Razorpay, Gmail, Twilio)
- Return JSON responses

**Outcome:** 
- 5 complete automation workflows
- All running on Next.js backend
- No manual work needed

---

# SKILL TRIGGERS

Claude should help when asked about:

### Direct Triggers
- "Build automation API for..."
- "Create workflow for lead capture/payments/reminders"
- "Build demo scheduling endpoint"
- "Connect ClickUp to Razorpay"

### Contextual Triggers
- "How do I automate email when payment received?"
- "Send WhatsApp when lead is captured"
- "Run cron job daily at 9 AM"
- "Create Google Meet link automatically"

### Technical Triggers
- "Create Next.js API route for..."
- "Build POST/GET endpoint for..."
- "Handle webhook from Razorpay"
- "Setup scheduled task in Vercel"

---

# SKILL CAPABILITIES

## ✅ Claude Can Do

### Build API Routes
- Create POST/GET endpoints
- Handle request/response
- Validate input data
- Return proper status codes
- Error handling & logging

### Integrate External APIs
- ClickUp (read/write tasks)
- Gmail (send emails)
- Twilio (send WhatsApp)
- Razorpay (create invoices, verify payments)
- Google Calendar (create events + Meet links)

### Build Utility Functions
- Coach matching algorithm
- Data validation
- Email templates
- Receipt generation
- Cron job handlers

### Implement Logic
- Conditional workflows (if/then)
- Loop through data
- Transform data format
- Error recovery
- Logging & debugging

---

# WORKFLOW PATTERNS

## Pattern 1: Webhook Trigger → Process → Notification

```typescript
// Receive webhook
POST /api/webhooks/lead-capture
  ↓
// Process data
findBestCoach(lead, coaches)
  ↓
// Send notifications
sendWelcomeEmail() + sendCoachEmail()
  ↓
// Return response
{ success: true, leadId }
```

## Pattern 2: Form Submission → External API → Confirmation

```typescript
// Form submits
POST /api/payment-link
  ↓
// Call Razorpay
createRazorpayInvoice(amount, customer)
  ↓
// Send to user
sendPaymentLinkEmail() + sendWhatsApp()
  ↓
// Update ClickUp
updateClickUpTask(studentId, { paymentLinkSent: true })
  ↓
// Return
{ success: true, paymentLink }
```

## Pattern 3: External Webhook → Verify → Update

```typescript
// Razorpay sends webhook
POST /api/webhooks/payment
  ↓
// Verify signature
verifyRazorpaySignature(payload)
  ↓
// Update database
updateClickUp(studentId, { status: "Active" })
  ↓
// Send confirmation
sendReceiptEmail() + sendWhatsApp()
  ↓
// Return
{ success: true }
```

## Pattern 4: Scheduled Cron → Query → Loop → Action

```typescript
// Vercel Cron triggers
GET /api/cron/daily-reminders (at 9 AM)
  ↓
// Get overdue students
getOverdueStudents() from ClickUp
  ↓
// For each student
forEach(student)
  ├─ sendReminderEmail()
  ├─ sendWhatsApp()
  └─ updateClickUp(lastReminderSent)
  ↓
// Return
{ success: true, processed: 5 }
```

---

# API ROUTE TEMPLATES

## Template 1: Simple POST Endpoint

```typescript
// app/api/your-route/route.ts

export async function POST(request: Request) {
  try {
    // 1. Parse request
    const body = await request.json()
    
    // 2. Validate
    if (!body.required_field) {
      return Response.json(
        { success: false, error: "Field required" },
        { status: 400 }
      )
    }
    
    // 3. Process
    const result = await doSomething(body)
    console.log("[ACTION]", result)
    
    // 4. Return
    return Response.json(
      { success: true, data: result },
      { status: 200 }
    )
  } catch (error) {
    console.error("[ERROR]", error)
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

## Template 2: Webhook Handler (External API calls this)

```typescript
// app/api/webhooks/external-service/route.ts

export async function POST(request: Request) {
  try {
    const webhook = await request.json()
    
    // Verify signature (important!)
    const isValid = verifySignature(webhook, SECRET_KEY)
    if (!isValid) {
      return Response.json(
        { success: false, error: "Invalid signature" },
        { status: 401 }
      )
    }
    
    // Process webhook
    await processWebhook(webhook)
    
    return Response.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("[WEBHOOK ERROR]", error)
    return Response.json(
      { success: false },
      { status: 500 }
    )
  }
}
```

## Template 3: Cron Job (Vercel calls this on schedule)

```typescript
// app/api/cron/your-job/route.ts

// Add this to vercel.json:
// {
//   "crons": [{ "path": "/api/cron/your-job", "schedule": "0 9 * * *" }]
// }

export async function GET(request: Request) {
  // Verify it's from Vercel Cron
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ success: false }, { status: 401 })
  }
  
  try {
    console.log("[CRON] Starting at", new Date().toISOString())
    
    // Do repetitive work
    const items = await getItems()
    for (const item of items) {
      await processItem(item)
    }
    
    console.log("[CRON] Completed at", new Date().toISOString())
    return Response.json({ success: true, processed: items.length })
  } catch (error) {
    console.error("[CRON ERROR]", error)
    return Response.json({ success: false }, { status: 500 })
  }
}
```

---

# COMMON TASKS

## Task 1: Send Email When Something Happens

```typescript
// In any API route:

const result = await someOperation()

if (result.success) {
  // Send email
  await sendEmailToCoach(coach, { lead: result.data })
  console.log("[EMAIL SENT]", coach.email)
}
```

## Task 2: Call External API (ClickUp, Razorpay, etc.)

```typescript
// Create services/clickup.ts

export async function createTaskInClickUp(name, email) {
  const response = await fetch(
    `https://api.clickup.com/api/v2/list/${LIST_ID}/task`,
    {
      method: "POST",
      headers: {
        Authorization: process.env.CLICKUP_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: name,
        description: `Email: ${email}`,
        status: "open"
      })
    }
  )
  return response.json()
}

// Then use it in route:
const task = await createTaskInClickUp(lead.name, lead.email)
```

## Task 3: Verify External Webhook (Razorpay, Twilio, etc.)

```typescript
import crypto from "crypto"

export function verifyRazorpaySignature(body, signature) {
  const hmac = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex")
  
  return hmac === signature
}

// In webhook handler:
const isValid = verifyRazorpaySignature(rawBody, webhookSignature)
if (!isValid) return Response.json({ error: "Invalid" }, { status: 401 })
```

## Task 4: Send WhatsApp Message

```typescript
// services/twilio.ts

export async function sendWhatsApp(to, message) {
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        From: `whatsapp:${TWILIO_PHONE}`,
        To: `whatsapp:${to}`,
        Body: message
      })
    }
  )
  return response.json()
}
```

## Task 5: Schedule Task (Cron)

```typescript
// vercel.json

{
  "crons": [
    {
      "path": "/api/cron/daily-reminders",
      "schedule": "0 9 * * *"  // Daily at 9 AM
    },
    {
      "path": "/api/cron/weekly-report",
      "schedule": "0 10 * * 1"  // Monday at 10 AM
    }
  ]
}
```

---

# 5 WORKFLOWS TO BUILD

| # | Workflow | Route | Status |
|---|----------|-------|--------|
| 1 | Lead Capture + Coach Assignment | `/api/webhooks/lead-capture` | ✅ DONE |
| 2 | Demo Scheduling + Google Meet | `/api/schedule-demo` | 🔨 BUILD |
| 3 | Payment Link Generation | `/api/payment-link` | 🔨 BUILD |
| 4 | Payment Received Processing | `/api/webhooks/payment` | 🔨 BUILD |
| 5 | Daily Overdue Reminders | `/api/cron/daily-reminders` | 🔨 BUILD |

**Each takes 20-40 minutes to build with Claude Code**

---

# TESTING WORKFLOW

For each API route:

```bash
# 1. Create test file
# test-workflow.js

const response = await fetch('http://localhost:3000/api/route', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ /* test data */ })
})

const data = await response.json()
console.log('Response:', data)

# 2. Run test
node test-workflow.js

# 3. Check console logs from npm run dev
# Look for [LOG PREFIX] output

# 4. Verify external effects
# - Check ClickUp for new tasks
# - Check email inbox
# - Check WhatsApp
# - Check Razorpay dashboard
```

---

# DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] All 5 workflows built and tested locally
- [ ] Environment variables filled in .env.local
- [ ] Code pushed to GitHub
- [ ] Vercel connected to GitHub
- [ ] Environment variables added to Vercel settings
- [ ] Razorpay webhooks configured to deployed URL
- [ ] Vercel Cron enabled (for daily reminders)
- [ ] All external APIs verified working
- [ ] Test each workflow on production URL
- [ ] Monitor logs for errors

---

# LIMITATIONS & NOTES

❌ Cannot:
- Modify ClickUp UI (API only)
- Schedule tasks at arbitrary intervals (only Vercel Cron)
- Store files (no file storage)

✅ Can:
- Call any REST API
- Process webhooks
- Run scheduled jobs
- Send emails/messages
- Process payments

---

# NEXT STEPS

1. **Workflow 2: Demo Scheduling** (30 mins)
   - Create `app/api/schedule-demo/route.ts`
   - Use Google Calendar API
   - Send confirmations

2. **Workflow 3: Payment Link** (30 mins)
   - Create `app/api/payment-link/route.ts`
   - Integrate Razorpay
   - Send payment links

3. **Workflow 4: Payment Webhook** (30 mins)
   - Create `app/api/webhooks/payment/route.ts`
   - Verify signatures
   - Send receipts

4. **Workflow 5: Daily Reminders** (30 mins)
   - Create `app/api/cron/daily-reminders/route.ts`
   - Query ClickUp for overdue
   - Send reminders

---

**Last Updated:** June 26, 2026
**Approach:** Claude Code + Next.js (Replaces n8n)
**Status:** 1/5 workflows complete, 4 remaining
