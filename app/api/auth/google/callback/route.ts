import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/googleAuth'

function renderErrorPage(message: string): NextResponse {
  const html = `<html>
  <head>
    <title>Google OAuth Error</title>
    <style>
      body { font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto; }
      .error { color: #ef4444; font-size: 24px; }
    </style>
  </head>
  <body>
    <h1 class="error">❌ Something went wrong</h1>
    <p>${message}</p>
  </body>
</html>`

  return new NextResponse(html, {
    status: 400,
    headers: { 'Content-Type': 'text/html' },
  })
}

function renderSuccessPage(refreshToken: string): NextResponse {
  const html = `<html>
  <head>
    <title>Google OAuth Success</title>
    <style>
      body { font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto; }
      .success { color: #10b981; font-size: 24px; }
      .token-box { background: #f3f4f6; padding: 15px; border-radius: 5px; font-family: monospace; word-break: break-all; margin: 20px 0; }
      .instructions { background: #eff6ff; padding: 15px; border-radius: 5px; }
      button { background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1 class="success">✅ Success!</h1>
    <p>Your Google account is now connected to Darklight Chess Academy.</p>

    <div class="instructions">
      <h3>Next step:</h3>
      <p>1. Copy the refresh token below</p>
      <p>2. Open your .env.local file</p>
      <p>3. Add this line:</p>
    </div>

    <div class="token-box">
      GOOGLE_REFRESH_TOKEN=${refreshToken}
    </div>

    <p>4. Restart your dev server (npm run dev)</p>
    <p>You can now close this window. Demo scheduling will create real Google Meet links!</p>

    <button onclick="navigator.clipboard.writeText('GOOGLE_REFRESH_TOKEN=${refreshToken}'); alert('Copied!')">Copy Token</button>
  </body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code')

    if (!code) {
      console.error('[GOOGLE AUTH ERROR]', 'Authorization code not found')
      return renderErrorPage('Authorization code not found in the callback URL.')
    }

    const { refresh_token } = await exchangeCodeForTokens(code)

    console.log('[GOOGLE AUTH SUCCESS]', { refresh_token: refresh_token.substring(0, 20) + '...' })

    return renderSuccessPage(refresh_token)
  } catch (err) {
    console.error('[GOOGLE AUTH ERROR]', err)
    return renderErrorPage('Failed to exchange authorization code for tokens. Check server logs for details.')
  }
}
