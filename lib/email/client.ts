import { Resend } from 'resend'

/**
 * Transactional email via Resend.
 *
 * Sending is best-effort by design: an approval or an invitation must not fail
 * because the mail provider is down or unconfigured. Every failure is logged
 * and returned, never thrown.
 */

export interface SendEmailInput {
  to:      string | string[]
  subject: string
  html:    string
  text:    string
}

export type SendEmailResult =
  | { sent: true;  id: string | null }
  | { sent: false; reason: string }

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

/**
 * Resend's shared sender only works for the account owner's own address.
 * Point EMAIL_FROM at your own verified domain to send to anyone else.
 */
export function emailFrom(): string {
  return process.env.EMAIL_FROM ?? 'Research Platform <onboarding@resend.dev>'
}

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000'
  )
}

let client: Resend | null = null

function getClient(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY)
  return client
}

export async function sendEmail({
  to, subject, html, text,
}: SendEmailInput): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    return { sent: false, reason: 'RESEND_API_KEY is not set' }
  }

  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean)
  if (recipients.length === 0) {
    return { sent: false, reason: 'No recipients' }
  }

  try {
    const { data, error } = await getClient().emails.send({
      from: emailFrom(),
      to:   recipients,
      subject,
      html,
      text,
    })

    if (error) {
      console.error('[email] send failed:', error.message)
      return { sent: false, reason: error.message }
    }

    return { sent: true, id: data?.id ?? null }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown error'
    console.error('[email] send threw:', reason)
    return { sent: false, reason }
  }
}
