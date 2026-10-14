/** A reply found in the person's inbox (reply detection) or entered by them, as the activity feed returns it. */
export interface ReplyActivity { at: string; kind: string; detail: string; opportunityId: string | null; title: string; organization: string }

export interface Reply { at: string; from: string | null; subject: string | null; receivedAt: string | null; opportunityId: string | null; title: string; organization: string; text: string }

/**
 * Reply detection writes "Reply received from x@y on 2026-10-14 09:12:00 UTC: subject". Anything else (a reply the person typed in)
 * is kept as its own text.
 */
export function parseReply(a: ReplyActivity): Reply {
  const m = /^Reply received from (\S+@\S+?) on (\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?)(?: UTC)?:\s*(.*)$/s.exec(a.detail.trim())
  return {
    at: a.at, opportunityId: a.opportunityId, title: a.title, organization: a.organization, text: a.detail,
    from: m ? m[1] : null,
    receivedAt: m ? new Date(m[2].replace(' ', 'T') + 'Z').toISOString() : null,
    subject: m ? (m[3].trim() || null) : null,
  }
}

/** The subject for an answer: "Re: …" once, never "Re: Re: …". */
export function replySubject(subject: string | null): string {
  const s = (subject ?? '').trim()
  if (!s) return 'Re: your reply'
  return /^re:/i.test(s) ? s : `Re: ${s}`
}
