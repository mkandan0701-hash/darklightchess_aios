export function getGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
  })

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  console.log('[GOOGLE AUTH URL]', url.substring(0, 50) + '...')

  return url
}

export async function exchangeCodeForTokens(
  code: string
): Promise<{ access_token: string; refresh_token: string }> {
  try {
    const body = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    })

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const data = await response.json()

    if (!data.refresh_token) {
      console.error('[GOOGLE AUTH ERROR]', 'No refresh token in response', data)
      throw new Error('No refresh token in response')
    }

    console.log('[GOOGLE TOKENS RECEIVED]')

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    }
  } catch (err) {
    console.error('[GOOGLE AUTH ERROR]', err)
    throw err
  }
}

export async function getAccessToken(refreshToken: string): Promise<string> {
  try {
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const data = await response.json()

    if (!data.access_token) {
      console.error('[GOOGLE AUTH ERROR]', 'Failed to get access token', data)
      throw new Error('Failed to get access token')
    }

    return data.access_token
  } catch (err) {
    console.error('[GOOGLE AUTH ERROR]', err)
    throw err
  }
}
