const STORAGE_KEY = 'sosecure-incident-reminders'
const REMINDER_DELAY_MS = 48 * 60 * 60 * 1000 // 48 horas

interface IncidentReminder {
  incidentId: string
  reportedAt: number
  notifiedAt: number | null
}

function loadReminders(): IncidentReminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveReminders(reminders: IncidentReminder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders))
}

export function scheduleIncidentReminder(incidentId: string) {
  const reminders = loadReminders()
  const exists = reminders.some(r => r.incidentId === incidentId)
  if (!exists) {
    reminders.push({ incidentId, reportedAt: Date.now(), notifiedAt: null })
    saveReminders(reminders)
  }
}

export function cancelIncidentReminder(incidentId: string) {
  const reminders = loadReminders().filter(r => r.incidentId !== incidentId)
  saveReminders(reminders)
}

export async function checkIncidentReminders(
  sendNotification: (title: string, body: string) => Promise<unknown>
) {
  if (typeof window === 'undefined') return

  const now = Date.now()
  const reminders = loadReminders()
  let changed = false

  for (const reminder of reminders) {
    if (reminder.notifiedAt !== null) continue
    if (now - reminder.reportedAt >= REMINDER_DELAY_MS) {
      await sendNotification(
        '📋 SOSecure — Actualiza tu reporte',
        '¿Cómo resultó el incidente que reportaste hace 48 horas? Abre el mapa para marcarlo como resuelto o confirmar su estado.'
      )
      reminder.notifiedAt = now
      changed = true
    }
  }

  if (changed) saveReminders(reminders)
}
