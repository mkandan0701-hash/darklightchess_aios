function randomMeetCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  const seg = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${seg(3)}-${seg(4)}-${seg(3)}`
}

export interface MeetEvent {
  meetLink: string
  eventId: string
  calendarLink: string
}

export function createGoogleMeetLink(
  title: string,
  dateTime: { date: string; time: string },
  duration: number
): MeetEvent {
  console.log(`[GOOGLE MEET] Creating event: "${title}" on ${dateTime.date} at ${dateTime.time} (${duration} min)`)

  const code = randomMeetCode()
  const eventId = `evt_${Date.now()}`
  const meetLink = `https://meet.google.com/${code}`
  const calendarLink = `https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(title)}&dates=${dateTime.date.replace(/-/g, '')}T${dateTime.time.replace(':', '')}00`

  return { meetLink, eventId, calendarLink }
}

export function formatMeetMessage(
  parentName: string,
  meetLink: string,
  demoDate: string,
  demoTime: string
): string {
  return `Hi ${parentName},

Your demo class is scheduled!

📅 Date: ${demoDate}
🕐 Time: ${demoTime}

📹 Join here: ${meetLink}

See you soon!`
}
