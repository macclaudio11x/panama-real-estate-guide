/* =============================================================================
   Mail — SMTP out, IMAP in
   =============================================================================
   The half that matters is the inbound half. Sending is a solved problem any
   transactional API does; what makes a CRM worth opening is that George
   Walker's reply appears under George Walker without anyone forwarding
   anything.

   Three decisions worth stating, because each has a wrong version that looks
   fine until it isn't:

   · Threading uses the RFC-5322 `Message-ID` / `In-Reply-To` / `References`
     headers, never the subject. "Re: Re: Fwd: Your Panama enquiry" is not a
     key, and two people replying to the same campaign would collide on one.

   · The poll resumes from a stored UID, and checks `uidValidity` first. When a
     server renumbers a mailbox, every stored UID becomes meaningless — and the
     failure mode of ignoring that is silently skipping mail, which is the one
     bug a mailbox sync must not have.

   · Mail from an address nobody recognises is stored unmatched, not dropped.
     That is what a referral looks like on arrival.

   Everything here is server-only. It reads SMTP and IMAP credentials from the
   environment and must never be imported from a client component.
   ============================================================================= */

import "server-only";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { supabaseAdmin } from "./supabase";

/* ── Configuration ───────────────────────────────────────────────────────── */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Mail is configured entirely by environment variables — ` +
        `see the block in lib/mail.ts. Set it in .env.local and in Netlify.`,
    );
  }
  return value;
}

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.IMAP_HOST);
}

/** The address the CRM sends as. Separate from the login user because cPanel
 *  mailboxes are routinely authenticated as one address and sent as another. */
function fromAddress(): string {
  const name = process.env.MAIL_FROM_NAME ?? "Panama Real Estate Guide";
  return `${name} <${process.env.MAIL_FROM_ADDRESS ?? required("SMTP_USER")}>`;
}

/* ── Sending ─────────────────────────────────────────────────────────────── */

let transport: nodemailer.Transporter | null = null;

function smtp(): nodemailer.Transporter {
  if (transport) return transport;

  const port = Number(process.env.SMTP_PORT ?? 465);
  transport = nodemailer.createTransport({
    host: required("SMTP_HOST"),
    port,
    // 465 is implicit TLS; 587 starts plaintext and upgrades via STARTTLS.
    // Getting this backwards produces a hang rather than an error, which is
    // why it is derived from the port rather than left to a loose env var.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: { user: required("SMTP_USER"), pass: required("SMTP_PASSWORD") },
  });
  return transport;
}

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  contactId?: string | null;
  dealId?: string | null;
  brokerId?: string | null;
  /** Message-ID being replied to, so the reply threads in their client. */
  inReplyTo?: string | null;
  threadKey?: string | null;
};

export type SendResult =
  | { ok: true; messageId: string; rowId: string }
  | { ok: false; error: string };

/** Sends, then records. The record is written whichever way the send goes: a
 *  failed send that leaves no trace is indistinguishable from one nobody
 *  attempted, and the difference decides whether someone tries again. */
export async function sendEmail(email: OutboundEmail): Promise<SendResult> {
  const sb = supabaseAdmin();
  const from = fromAddress();

  let messageId: string | null = null;
  let error: string | null = null;

  try {
    const info = await smtp().sendMail({
      from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      inReplyTo: email.inReplyTo ?? undefined,
      references: email.threadKey ? [email.threadKey] : undefined,
    });
    messageId = stripAngles(info.messageId);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const { data, error: writeError } = await sb
    .from("email_messages")
    .insert({
      direction: "outbound",
      state: error ? "failed" : "sent",
      message_id: messageId,
      in_reply_to: email.inReplyTo ?? null,
      thread_key: email.threadKey ?? messageId,
      from_email: process.env.MAIL_FROM_ADDRESS ?? process.env.SMTP_USER,
      to_emails: [email.to],
      subject: email.subject,
      body_text: email.text,
      body_html: email.html ?? null,
      contact_id: email.contactId ?? null,
      deal_id: email.dealId ?? null,
      broker_id: email.brokerId ?? null,
      sent_at: error ? null : new Date().toISOString(),
      error,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error };
  if (writeError) {
    // The mail is gone; only the record failed. Say so rather than reporting a
    // failure that would get the same message sent twice.
    return { ok: false, error: `Sent, but not recorded: ${writeError.message}` };
  }

  // Mirror into the timeline so the contact's history is one list.
  if (email.contactId) {
    await sb.from("activities").insert({
      contact_id: email.contactId,
      deal_id: email.dealId ?? null,
      kind: "email",
      direction: "outbound",
      subject: email.subject,
      body: email.text,
      occurred_at: new Date().toISOString(),
    });
  }

  return { ok: true, messageId: messageId!, rowId: (data as { id: string }).id };
}

/* ── Receiving ───────────────────────────────────────────────────────────── */

const stripAngles = (id: string | null | undefined) =>
  id ? id.replace(/^<|>$/g, "") : null;

export type SyncResult = {
  fetched: number;
  matched: number;
  unmatched: number;
  skipped: number;
  error?: string;
};

/**
 * Pulls anything newer than the last stored UID and files it.
 *
 * Deliberately does not mark anything read or move anything: the mailbox
 * belongs to a person who also reads it in a mail client, and a sync that
 * mutates their inbox is a sync they will turn off.
 */
export async function syncInbox(folder = "INBOX"): Promise<SyncResult> {
  if (!mailConfigured()) return { fetched: 0, matched: 0, unmatched: 0, skipped: 0, error: "Mail is not configured." };

  const sb = supabaseAdmin();
  const client = new ImapFlow({
    host: required("IMAP_HOST"),
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: process.env.IMAP_SECURE ? process.env.IMAP_SECURE === "true" : true,
    auth: { user: required("IMAP_USER"), pass: required("IMAP_PASSWORD") },
    logger: false,
  });

  const result: SyncResult = { fetched: 0, matched: 0, unmatched: 0, skipped: 0 };

  try {
    await client.connect();
  } catch (e) {
    return { ...result, error: e instanceof Error ? e.message : String(e) };
  }

  const lock = await client.getMailboxLock(folder);

  try {
    const mailbox = client.mailbox;
    if (typeof mailbox === "boolean") throw new Error(`Could not open ${folder}.`);

    const { data: stateRow } = await sb
      .from("email_sync_state")
      .select("id, uid_validity, last_uid")
      .is("broker_id", null)
      .eq("folder", folder)
      .maybeSingle();

    const state = stateRow as
      | { id: string; uid_validity: number | null; last_uid: number }
      | null;

    const serverValidity = Number(mailbox.uidValidity);

    // The server renumbered the mailbox: stored UIDs mean nothing now. Start
    // again from the beginning rather than resuming past mail we never read.
    const renumbered = state?.uid_validity != null && state.uid_validity !== serverValidity;
    const since = renumbered ? 0 : (state?.last_uid ?? 0);

    let highest = since;

    for await (const message of client.fetch(
      { uid: `${since + 1}:*` },
      { uid: true, source: true, envelope: true },
    )) {
      const uid = Number(message.uid);
      // `uid: "n:*"` always returns at least one message even when none is
      // newer — the server clamps to the last one. Skip what we have seen.
      if (uid <= since) continue;
      highest = Math.max(highest, uid);
      result.fetched++;

      // `source` is optional in the fetch response type; without it there is
      // nothing to parse and the UID is still consumed.
      if (!message.source) {
        result.skipped++;
        continue;
      }

      // The typings carry a callback overload, so the promise form resolves to
      // `void & Promise<ParsedMail>`. The runtime value is a ParsedMail.
      const parsed = (await simpleParser(message.source)) as ParsedMail;
      const messageId = stripAngles(parsed.messageId);

      const from = parsed.from?.value?.[0];
      const fromEmail = (from?.address ?? "").toLowerCase();
      if (!fromEmail) {
        result.skipped++;
        continue;
      }

      const inReplyTo = stripAngles(parsed.inReplyTo);
      const references = Array.isArray(parsed.references)
        ? parsed.references.map((r) => stripAngles(r)).filter(Boolean)
        : parsed.references
          ? [stripAngles(parsed.references)]
          : [];

      // Thread root: the first reference if there is one, else what it replies
      // to, else itself — a message that starts a thread is its own root.
      const threadKey = references[0] ?? inReplyTo ?? messageId;

      const match = await matchToContact(fromEmail, threadKey, inReplyTo);

      const { data: row, error: insertError } = await sb
        .from("email_messages")
        .insert({
          direction: "inbound",
          state: "received",
          message_id: messageId,
          in_reply_to: inReplyTo,
          thread_key: threadKey,
          from_email: fromEmail,
          from_name: from?.name ?? null,
          to_emails: (parsed.to && "value" in parsed.to ? parsed.to.value : [])
            .map((a) => a.address ?? "")
            .filter(Boolean),
          subject: parsed.subject ?? null,
          body_text: parsed.text ?? null,
          body_html: typeof parsed.html === "string" ? parsed.html : null,
          has_attachments: (parsed.attachments?.length ?? 0) > 0,
          contact_id: match?.contactId ?? null,
          deal_id: match?.dealId ?? null,
          imap_uid: uid,
          imap_folder: folder,
          received_at: (parsed.date ?? new Date()).toISOString(),
        })
        .select("id")
        .single();

      // A duplicate Message-ID or UID means we already have it — a re-poll
      // across a restart, not an error.
      if (insertError) {
        if (insertError.code === "23505") result.skipped++;
        else throw new Error(insertError.message);
        continue;
      }

      if (match) {
        result.matched++;
        const { data: activity } = await sb
          .from("activities")
          .insert({
            contact_id: match.contactId,
            deal_id: match.dealId,
            kind: "email",
            direction: "inbound",
            subject: parsed.subject ?? null,
            body: parsed.text ?? null,
            occurred_at: (parsed.date ?? new Date()).toISOString(),
          })
          .select("id")
          .single();

        // Link the two so the timeline entry and the stored mail cannot drift.
        if (activity) {
          await sb
            .from("email_messages")
            .update({ activity_id: (activity as { id: string }).id })
            .eq("id", (row as { id: string }).id);
        }

        // Somebody answered. Anything still queued to chase them is now the
        // wrong message to send — see sequences.stop_on_reply.
        await stopSequencesFor(match.contactId);
      } else {
        result.unmatched++;
      }
    }

    await sb.from("email_sync_state").upsert(
      {
        ...(state ? { id: state.id } : {}),
        broker_id: null,
        folder,
        uid_validity: serverValidity,
        last_uid: highest,
        last_polled_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "broker_id,folder" },
    );
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }

  return result;
}

/* ── Matching ────────────────────────────────────────────────────────────── */

/** From address first, because it is the strongest signal and the common case.
 *  Falling back to the thread catches the person who replies from their phone
 *  on a different address, which is otherwise a referral-shaped mystery. */
async function matchToContact(
  fromEmail: string,
  threadKey: string | null,
  inReplyTo: string | null,
): Promise<{ contactId: string; dealId: string | null } | null> {
  const sb = supabaseAdmin();

  const { data: contact } = await sb
    .from("contacts")
    .select("id")
    .eq("email_norm", fromEmail)
    .maybeSingle();

  if (contact) {
    // Their most recently touched open deal, so a reply lands on the thing
    // actually being worked rather than something closed two years ago.
    const { data: deal } = await sb
      .from("deals")
      .select("id")
      .eq("contact_id", (contact as { id: string }).id)
      .not("stage", "in", "(won,lost)")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      contactId: (contact as { id: string }).id,
      dealId: (deal as { id: string } | null)?.id ?? null,
    };
  }

  for (const key of [threadKey, inReplyTo].filter(Boolean)) {
    const { data: prior } = await sb
      .from("email_messages")
      .select("contact_id, deal_id")
      .or(`thread_key.eq.${key},message_id.eq.${key}`)
      .not("contact_id", "is", null)
      .limit(1)
      .maybeSingle();

    const row = prior as { contact_id: string; deal_id: string | null } | null;
    if (row?.contact_id) return { contactId: row.contact_id, dealId: row.deal_id };
  }

  return null;
}

async function stopSequencesFor(contactId: string): Promise<void> {
  const sb = supabaseAdmin();

  const { data: active } = await sb
    .from("sequence_enrollments")
    .select("id, sequence_id, sequences ( stop_on_reply )")
    .eq("contact_id", contactId)
    .eq("state", "active");

  const toStop = (active ?? []).filter((row) => {
    const seq = (row as { sequences: { stop_on_reply: boolean } | { stop_on_reply: boolean }[] })
      .sequences;
    const one = Array.isArray(seq) ? seq[0] : seq;
    return one?.stop_on_reply !== false;
  });

  if (!toStop.length) return;

  await sb
    .from("sequence_enrollments")
    .update({ state: "stopped", stopped_reason: "They replied.", next_run_at: null })
    .in(
      "id",
      toStop.map((r) => (r as { id: string }).id),
    );
}
