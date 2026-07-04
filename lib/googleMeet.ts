import { getAccessToken } from '@/lib/googleAuth'

export interface MeetLinkResult {
  meetLink: string
  eventId: string
  startTime: string
  endTime: string
}

export async function createGoogleMeetLink(
  title: string,
  startDateTime: string,
  durationMinutes: number
): Promise<MeetLinkResult> {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
  if (!refreshToken) {
    console.error('[GOOGLE MEET ERROR]', 'No refresh token')
    throw new Error('GOOGLE_REFRESH_TOKEN not in .env.local')
  }

  const accessToken = await getAccessToken(refreshToken)

  const start = new Date(startDateTime)
  const end = new Date(start.getTime() + durationMinutes * 60000)

  const event = {
    summary: title,
    description: 'Darklight Chess Academy Demo Class',
    start: {
      dateTime: startDateTime,
      timeZone: 'UTC',
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: 'UTC',
    },
    conferenceData: {
      createRequest: {
        requestId: 'req-' + Date.now(),
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    },
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    )

    const createdEvent = await response.json()

    if (!createdEvent.id) {
      console.error('[GOOGLE MEET ERROR]', createdEvent)
      throw new Error('Failed to create calendar event')
    }

    console.log('[GOOGLE MEET CREATED]', {
      eventId: createdEvent.id,
      meetLink: createdEvent.hangoutLink,
      title,
    })

    return {
      meetLink: createdEvent.hangoutLink,
      eventId: createdEvent.id,
      startTime: startDateTime,
      endTime: end.toISOString(),
    }
  } catch (err) {
    console.error('[GOOGLE MEET ERROR]', err)
    throw err
  }
}

export async function deleteGoogleMeetEvent(eventId: string): Promise<{ success: true }> {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
  if (!refreshToken) throw new Error('No refresh token')

  const accessToken = await getAccessToken(refreshToken)
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (response.status !== 204) {
      console.error('[GOOGLE MEET ERROR]', 'Failed to delete')
      throw new Error('Failed to delete event')
    }

    console.log('[GOOGLE MEET DELETED]', { eventId })
    return { success: true }
  } catch (err) {
    console.error('[GOOGLE MEET ERROR]', err)
    throw err
  }
}
