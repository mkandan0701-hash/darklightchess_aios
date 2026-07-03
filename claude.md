# BUILD ROADMAP - Darklight AIOS (Claude Code Approach)

**Complete plan to build all 5 automation workflows**

---

# CURRENT STATUS

✅ **Workflow 1: Lead Capture + Coach Assignment** - COMPLETE
- Route: `/api/webhooks/lead-capture`
- Files: 3 (API route, coach matcher, email sender)
- Status: Tested and working
- Time spent: ~1.5 hours

---

# NEXT 4 WORKFLOWS (Remaining 2-3 hours)

## 🔨 WORKFLOW 2: Demo Scheduling + Google Meet

**Priority:** HIGH (needed for lead conversion)

**Time Estimate:** 45 minutes

**What It Does:**
```
Coach selects date/time for demo
    ↓
Create Google Calendar event
    ↓
Generate Google Meet link
    ↓
Send confirmation emails to parent + coach
    ↓
Send WhatsApp confirmation to parent
    ↓
Update ClickUp lead status → "Demo Scheduled"
    ↓
Return Meet link
```

**Files to Create:**
1. `app/api/schedule-demo/route.ts` - Main API route
2. `lib/googleMeet.ts` - Google Calendar + Meet integration
3. Update `lib/emailSender.ts` - Add demo confirmation email
4. Create `lib/whatsappSender.ts` - WhatsApp messages

**Environment Variables Needed:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_TWILIO_ACCOUNT_SID`
- `NEXT_PUBLIC_TWILIO_AUTH_TOKEN`
- `NEXT_PUBLIC_TWILIO_PHONE`

**External APIs Used:**
- Google Calendar API
- Google Meet API
- Gmail
- Twilio WhatsApp

**Expected Response:**
```json
{
  "success": true,
  "meetLink": "https://meet.google.com/abc-defg",
  "eventId": "event123",
  "confirmedAt": "2026-06-27T15:00:00Z"
}
```

---

## 💰 WORKFLOW 3: Payment Link Generation

**Priority:** HIGH (enables revenue collection)

**Time Estimate:** 30 minutes

**What It Does:**
```
Coach sets student fee (e.g., ₹5,000)
    ↓
API generates Razorpay invoice
    ↓
Send payment link via email to parent
    ↓
Send payment link via WhatsApp to parent
    ↓
Update ClickUp student record with payment link
    ↓
Return payment link
```

**Files to Create:**
1. `app/api/payment-link/route.ts` - Main API route
2. `services/razorpay.ts` - Razorpay integration

**Environment Variables Needed:**
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `NEXT_PUBLIC_CLICKUP_API_KEY`

**External APIs Used:**
- Razorpay API
- Gmail
- Twilio WhatsApp
- ClickUp API

**Expected Response:**
```json
{
  "success": true,
  "paymentLink": "https://rzp.io/i/abc123",
  "invoiceId": "INV_001",
  "expiresAt": "2026-07-27T00:00:00Z"
}
```

---

## 📥 WORKFLOW 4: Payment Received Webhook

**Priority:** CRITICAL (processes revenue)

**Time Estimate:** 30 minutes

**What It Does:**
```
Parent completes payment on Razorpay
    ↓
Razorpay sends webhook to your API
    ↓
Verify payment signature
    ↓
Send receipt email to parent
    ↓
Send receipt WhatsApp to parent
    ↓
Update ClickUp student status → "Active" (enrolled)
    ↓
Log payment to Google Sheets (backup)
    ↓
Return success
```

**Files to Create:**
1. `app/api/webhooks/payment/route.ts` - Webhook handler
2. `lib/receiptGenerator.ts` - Email receipt template

**Environment Variables Needed:**
- `RAZORPAY_KEY_SECRET` (for signature verification)
- `NEXT_PUBLIC_CLICKUP_API_KEY`
- `GOOGLE_SHEETS_API_KEY` (optional, for backup)

**External APIs Used:**
- Razorpay (webhook source)
- Gmail (receipt email)
- Twilio WhatsApp (receipt message)
- ClickUp API (update student)
- Google Sheets (optional backup)

**Razorpay Webhook to Expect:**
```json
{
  "event": "payment.authorized",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_123456",
        "amount": 500000,
        "status": "captured",
        "email": "parent@email.com",
        "notes": {
          "studentId": "STU_001"
        }
      }
    }
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment processed",
  "receiptSent": true
}
```

---

## 🔔 WORKFLOW 5: Daily Overdue Reminders

**Priority:** MEDIUM (increases collection rates)

**Time Estimate:** 30 minutes

**What It Does:**
```
Vercel Cron triggers at 9 AM daily
    ↓
Query ClickUp for overdue payments (due date passed, status not "Active")
    ↓
For each overdue student:
    ├─ Send email reminder
    ├─ Send WhatsApp reminder
    └─ Update ClickUp with "reminder_sent" timestamp
    ↓
Log summary (how many processed)
    ↓
Return success
```

**Files to Create:**
1. `app/api/cron/daily-reminders/route.ts` - Cron handler
2. Update `vercel.json` - Add cron schedule

**Environment Variables Needed:**
- `NEXT_PUBLIC_CLICKUP_API_KEY`
- `CRON_SECRET` (Vercel provides this)

**External APIs Used:**
- ClickUp API (query overdue)
- Gmail (reminder email)
- Twilio WhatsApp (reminder message)

**Vercel Config (vercel.json):**
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

**Expected Response:**
```json
{
  "success": true,
  "remindersProcessed": 5,
  "emailsSent": 5,
  "whatsappSent": 5,
  "timestamp": "2026-06-27T09:00:00Z"
}
```

---

# BUILD ORDER & TIMING

```
Session 1 (Completed):
├─ Workflow 1: Lead Capture ✅ (1.5 hours)

Session 2 (Next):
├─ Workflow 2: Demo Scheduling (45 mins)
├─ Workflow 3: Payment Link (30 mins)
├─ Workflow 4: Payment Webhook (30 mins)
├─ Workflow 5: Daily Reminders (30 mins)
└─ Testing All Workflows (30 mins)
   Total: 2.5-3 hours

Session 3:
├─ Deploy to Vercel
├─ Setup environment variables
├─ Configure Razorpay webhooks
├─ Test on live URL
└─ Go live! 🎉
```

---

# WHAT TO TELL CLAUDE CODE

For each workflow, use this template prompt:

```
Build {WORKFLOW_NAME} API route.

Route: {ENDPOINT}

What it does:
{DESCRIPTION}

Files to create:
{FILE_LIST}

Environment variables:
{ENV_VARS}

External APIs:
{API_LIST}

Expected request:
{REQUEST_JSON}

Expected response:
{RESPONSE_JSON}

Implementation details:
{DETAILS}

Show me the complete code for all files.
```

---

# SPECIFIC PROMPTS

### Workflow 2 Prompt:

```
Build demo scheduling API route.

Route: POST /api/schedule-demo

What it does:
1. Coach submits demo booking with parent availability + date/time
2. Create Google Calendar event
3. Auto-generate Google Meet link
4. Send confirmation email to parent
5. Send confirmation WhatsApp to parent
6. Send email to coach
7. Update ClickUp lead status → "Demo Scheduled"

Files:
- app/api/schedule-demo/route.ts
- lib/googleMeet.ts (Google Calendar + Meet integration)
- Update lib/emailSender.ts (add demo confirmation email)
- lib/whatsappSender.ts (new file for WhatsApp)

Implementation:
- Accept leadId, parentEmail, parentName, selectedDate, selectedTime
- Create Google Calendar event with Meet link
- Extract Meet URL from event
- Send emails and WhatsApp
- Update ClickUp with demo details
- Return Meet link in response

Show me complete code for all files.
```

### Workflow 3 Prompt:

```
Build payment link generation API route.

Route: POST /api/payment-link

What it does:
1. Receive student ID, amount, parent email
2. Create Razorpay invoice
3. Send payment link email to parent
4. Send payment link WhatsApp to parent
5. Update ClickUp student record
6. Return payment link

Files:
- app/api/payment-link/route.ts
- services/razorpay.ts (Razorpay integration)

Implementation:
- Use Razorpay API to create invoice
- Extract payment link from response
- Send via email and WhatsApp
- Update ClickUp with payment link
- Return payment link + expiry

Show me complete code.
```

### Workflow 4 Prompt:

```
Build payment webhook handler.

Route: POST /api/webhooks/payment

What it does:
1. Razorpay sends payment confirmation webhook
2. Verify webhook signature
3. Send receipt email
4. Send receipt WhatsApp
5. Update ClickUp student status → "Active"
6. Log to Google Sheets (optional)

Files:
- app/api/webhooks/payment/route.ts
- lib/receiptGenerator.ts (email receipt template)

Implementation:
- Extract payment details from webhook
- Verify signature using RAZORPAY_KEY_SECRET
- Generate receipt with payment details
- Send email + WhatsApp
- Update ClickUp: status = "Active", enrollment_date = today
- Return success

Show me complete code.
```

### Workflow 5 Prompt:

```
Build daily overdue reminders cron job.

Route: GET /api/cron/daily-reminders

Schedule: Daily at 9 AM (add to vercel.json)

What it does:
1. Get all students with overdue payments from ClickUp
2. For each overdue student:
   - Send reminder email
   - Send reminder WhatsApp
   - Update ClickUp with reminder_sent timestamp
3. Log summary

Files:
- app/api/cron/daily-reminders/route.ts
- Update vercel.json (add cron schedule)

Implementation:
- Verify request is from Vercel (check authorization header)
- Query ClickUp for tasks: due_date < today AND status != "Active"
- Loop through each overdue student
- Send emails/WhatsApp
- Update each task with reminder_sent timestamp
- Log results
- Return summary

Show me complete code.
```

---

# WHAT YOU NEED BEFORE BUILDING

**Environment Variables (Get These First):**

```
✅ CLICKUP_API_KEY - Already have
✅ TWILIO_ACCOUNT_SID - Have
✅ TWILIO_AUTH_TOKEN - Have
✅ TWILIO_PHONE - Have

❌ RAZORPAY_KEY_ID - Need to get
❌ RAZORPAY_KEY_SECRET - Need to get
❌ GOOGLE_CLIENT_ID - Need to get
❌ GOOGLE_CLIENT_SECRET - Need to get
```

**Before building workflows 2-5, collect these:**

1. Go to: https://razorpay.com/dashboard/access/tokens
   - Get: Key ID + Key Secret
   - Add to `.env.local`

2. Go to: https://console.cloud.google.com
   - Create OAuth credentials
   - Get: Client ID + Client Secret
   - Add to `.env.local`

---

# TESTING PLAN

After each workflow is built:

1. Create `test-workflow-X.js`
2. Run `node test-workflow-X.js`
3. Check console logs from `npm run dev`
4. Verify external effects (emails, ClickUp updates, etc.)

---

# FINAL DEPLOYMENT

Once all 5 workflows are complete:

1. Push to GitHub
2. Deploy to Vercel
3. Add environment variables to Vercel settings
4. Configure Razorpay webhook URL: `https://your-domain.com/api/webhooks/payment`
5. Test each workflow on live URL
6. Monitor logs

---

# EXPECTED TIMELINE

| Workflow | Time | Status |
|----------|------|--------|
| 1. Lead Capture | 1.5h | ✅ DONE |
| 2. Demo Scheduling | 45m | ⏳ NEXT |
| 3. Payment Link | 30m | ⏳ THEN |
| 4. Payment Webhook | 30m | ⏳ THEN |
| 5. Daily Reminders | 30m | ⏳ THEN |
| Testing All | 30m | ⏳ THEN |
| Deployment | 30m | ⏳ FINAL |
| **TOTAL** | **3-4 hours** | 🚀 |

---

**Next Step:** Build Workflow 2 (Demo Scheduling)

Ready to start? Tell me "Build Workflow 2" and I'll give you the exact prompt! 🚀
