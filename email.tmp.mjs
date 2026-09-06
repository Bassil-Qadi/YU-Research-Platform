import bcrypt from 'bcryptjs'

const BASE = 'http://localhost:3000'
const envMod = await import('@next/env')
;(envMod.loadEnvConfig ?? envMod.default.loadEnvConfig)(process.cwd())
const mongoose = (await import('mongoose')).default
await mongoose.connect(process.env.MONGODB_URI)
const db = mongoose.connection

const CONFIGURED = Boolean(process.env.RESEND_API_KEY)
// Resend's shared sender only delivers to the account owner's own address.
const INBOX = process.env.TEST_EMAIL_TO ?? 'bassilalqadi.ba@gmail.com'

console.log(CONFIGURED
  ? `── RESEND_API_KEY set: will send real mail to ${INBOX} ──\n`
  : '── RESEND_API_KEY not set: verifying flows survive without email ──\n')

const results = []
function check(name, ok, detail) {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok && detail !== undefined) console.log(`      ${JSON.stringify(detail).slice(0, 300)}`)
}

const stamp = Date.now()
const applicantEmail = `mailtest-${stamp}@university.edu`
const inviteeEmail   = `invitee-${stamp}@university.edu`
const PW = 'testpassword123'

async function signIn(email, password) {
  const jar = new Map()
  const take = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [p] = c.split(';'); const i = p.indexOf('='); jar.set(p.slice(0,i).trim(), p.slice(i+1).trim()) } }
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`); take(csrfRes)
  const { csrfToken } = await csrfRes.json()
  take(await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: [...jar].map(([k,v])=>`${k}=${v}`).join('; ') },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE}/dashboard` }),
  }))
  const cookie = [...jar].map(([k,v])=>`${k}=${v}`).join('; ')
  return async (path, options = {}) => {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Cookie: cookie, ...options.headers },
    })
    const text = await res.text()
    try { return { status: res.status, body: JSON.parse(text) } }
    catch { return { status: res.status, body: text.slice(0, 150) } }
  }
}

const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } }
  catch { return { status: res.status, body: text.slice(0, 150) } }
}

// ---------- 1. registration still works, email or not ----------
const reg = await post('/api/auth/register', {
  name: 'Mel Mailtest', email: applicantEmail, password: PW,
  role: 'Student', department: 'Computer Science',
})
check('registration succeeds -> 201', reg.status === 201, reg.body)
const applicant = await db.collection('users').findOne({ email: applicantEmail })
check('the account is created as pending', applicant?.status === 'pending', applicant?.status)

// ---------- 2. approval still works ----------
const admin = await signIn(process.env.DEV_USER_EMAIL ?? 'demo@university.edu', process.env.DEV_USER_PASSWORD ?? 'demo123456')
const approve = await admin(`/api/admin/users/${applicant._id}`, {
  method: 'PATCH', body: JSON.stringify({ status: 'active' }),
})
check('admin approval succeeds -> 200', approve.status === 200, approve.body)
check('the account is now active', approve.body?.status === 'active', approve.body)

// ---------- 3. a rejection path too ----------
await post('/api/auth/register', {
  name: 'Rex Rejected', email: inviteeEmail, password: PW,
  role: 'Student', department: 'Computer Science',
})
const invitee = await db.collection('users').findOne({ email: inviteeEmail })
const reject = await admin(`/api/admin/users/${invitee._id}`, {
  method: 'PATCH', body: JSON.stringify({ status: 'rejected', rejectionReason: 'Testing the decline path' }),
})
check('admin rejection succeeds -> 200', reject.status === 200, reject.body)

// reinstate so the invite below can target them
await db.collection('users').updateOne({ _id: invitee._id }, { $set: { status: 'active' } })

// ---------- 4. project invitation still works ----------
const project = await admin('/api/projects', {
  method: 'POST',
  body: JSON.stringify({
    title: `Email Test Project ${stamp}`,
    abstract: 'A temporary project used to verify that invitation and join-request emails are dispatched without ever blocking the underlying action from completing.',
    tags: ['smoke'], department: 'Computer Science', startDate: '2026-01-01',
    status: 'seeking', visibility: 'university', openPositions: ['Research Assistant'],
  }),
})
const projectId = project.body?._id
const invite = await admin(`/api/projects/${projectId}/members`, {
  method: 'POST', body: JSON.stringify({ email: inviteeEmail, role: 'contributor' }),
})
check('project invitation succeeds -> 200', invite.status === 200, invite.body)

// ---------- 5. join request + review still work ----------
const applicantApi = await signIn(applicantEmail, PW)
const joinReq = await applicantApi(`/api/projects/${projectId}/join-requests`, {
  method: 'POST', body: JSON.stringify({ message: 'Keen to help with the analysis.' }),
})
check('join request succeeds -> 201', joinReq.status === 201, joinReq.body)

const review = await admin(`/api/projects/${projectId}/join-requests/${joinReq.body?._id}`, {
  method: 'PATCH', body: JSON.stringify({ status: 'approved', role: 'contributor' }),
})
check('join request approval succeeds -> 200', review.status === 200, review.body)

// ---------- 6. the mail layer itself ----------
const { sendEmail, isEmailConfigured } = await import('./lib/email/client.ts')
  .catch(async () => await import('./lib/email/client.js').catch(() => ({})))

if (!CONFIGURED) {
  console.log('\n  (flows above all completed with no mail provider configured)')
} else {
  // ---------- real sends ----------
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  const templates = await import('./lib/email/templates.js').catch(() => null)

  const direct = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'Research Platform <onboarding@resend.dev>',
    to: INBOX,
    subject: 'Research Platform — email delivery check',
    html: '<p>If you can read this, transactional email is working.</p>',
    text: 'If you can read this, transactional email is working.',
  })
  check('Resend accepts a message and returns an id',
    Boolean(direct.data?.id) && !direct.error, direct.error ?? direct.data)

  // Drive a real flow whose recipient is the owner's inbox.
  const ownerEmail = INBOX
  await db.collection('users').deleteMany({ email: ownerEmail.toLowerCase(), universityId: /^MAILTEST-/ })
  const realFlow = await post('/api/auth/register', {
    name: 'Inbox Check', email: ownerEmail, password: PW,
    role: 'Student', department: 'Computer Science',
  })
  const alreadyExisted = realFlow.status === 409
  check('registration to a real inbox is accepted',
    realFlow.status === 201 || alreadyExisted, realFlow.body)

  if (realFlow.status === 201) {
    const created = await db.collection('users').findOne({ email: ownerEmail.toLowerCase() })
    const approved = await admin(`/api/admin/users/${created._id}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'active' }),
    })
    check('approval email flow completes -> 200', approved.status === 200, approved.body)
    await db.collection('users').deleteOne({ _id: created._id })
  }

  console.log(`\n  Check ${INBOX} — you should have a delivery check,`)
  console.log('  a "Registration received", and an "account approved" message.')
}

// ---------- cleanup ----------
const pid = projectId ? new mongoose.Types.ObjectId(projectId) : null
if (pid) {
  await db.collection('projects').deleteOne({ _id: pid })
  await db.collection('joinrequests').deleteMany({ projectId: pid })
}
await db.collection('users').deleteMany({ email: { $in: [applicantEmail, inviteeEmail] } })
await db.collection('notifications').deleteMany({
  createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
  type: { $in: ['join-request', 'join-approved', 'project-invite', 'member-joined'] },
})
await mongoose.disconnect()

console.log(`\n${results.filter(Boolean).length}/${results.length} passed`)
process.exit(results.every(Boolean) ? 0 : 1)
