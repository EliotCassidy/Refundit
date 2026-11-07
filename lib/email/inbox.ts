// OWNER: Dev 2. Reads brand replies from the Gmail inbox over IMAP (no webhook with Gmail:
// /api/email/poll is called when the dashboard is opened). Each new message to a claim alias:
// → claim_emails (idempotent on Message-ID) → LLM classification → claim status.
import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import { transitionClaim } from "@/lib/claims/transition";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import type { ClaimStatus } from "@/lib/shared/types";
import { findAlias } from "./address";
import { classifyReply } from "./classify";
import { emailSendingConfigured, OUTGOING_HEADER } from "./send";

const LOOKBACK_DAYS = 14;

const TO_STATUS: Partial<Record<string, ClaimStatus>> = {
  accepted: "accepted",
  refused: "refused",
  waiting_input: "waiting_input",
};

function addresses(a: AddressObject | AddressObject[] | undefined): string[] {
  const list = Array.isArray(a) ? a : a ? [a] : [];
  return list.flatMap((x) => x.value.map((v) => v.address ?? "")).filter(Boolean);
}

export type PollResult = { scanned: number; stored: number; skipped: number };

export async function pollInbox(): Promise<PollResult> {
  if (!emailSendingConfigured()) return { scanned: 0, stored: 0, skipped: 0 };
  const db = createAdminClient();
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! },
    logger: false,
  });
  const result: PollResult = { scanned: 0, stored: 0, skipped: 0 };

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
    const uids = (await client.search({ seen: false, since }, { uid: true })) || [];
    for (const uid of uids) {
      result.scanned++;
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) continue;
      const mail = await simpleParser(msg.source);
      const messageId = mail.messageId ?? `uid-${uid}`;
      if (mail.headers.has(OUTGOING_HEADER.toLowerCase())) {
        // A copy of one of our own outgoing emails: not a brand reply.
        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        result.skipped++;
        continue;
      }
      const recipients = [...addresses(mail.to), ...addresses(mail.cc), ...[mail.headers.get("delivered-to")].flat().map(String)];
      const alias = findAlias(recipients, mail.subject ?? "", mail.text ?? "");

      const { data: claim } = alias
        ? await db.from("claims").select("*").eq("inbound_alias", alias).maybeSingle()
        : { data: null };
      if (!claim) {
        // Not a reply to one of our claims: leave it unread, don't store it.
        result.skipped++;
        continue;
      }

      const { data: existing } = await db.from("claim_emails").select("id").eq("provider_message_id", messageId).maybeSingle();
      if (!existing) {
        let classification: Awaited<ReturnType<typeof classifyReply>> | null = null;
        try {
          classification = await classifyReply(mail.subject ?? "", mail.text ?? "");
        } catch (err) {
          console.error("[inbox] classification failed", err);
        }
        await db.from("claim_emails").insert({
          claim_id: claim.id,
          provider_message_id: messageId,
          from_address: addresses(mail.from)[0] ?? "inconnu",
          to_address: recipients[0] ?? process.env.GMAIL_USER!,
          subject: mail.subject ?? null,
          body_text: mail.text ?? null,
          received_at: (mail.date ?? new Date()).toISOString(),
          classification: classification?.classification ?? null,
          classification_reason: classification?.reason ?? null,
        });
        await db.from("claim_events").insert({
          claim_id: claim.id,
          type: "email_received",
          payload: { message_id: messageId, classification: classification?.classification ?? null },
        });

        const to = classification ? TO_STATUS[classification.classification] : undefined;
        if (to) {
          try {
            await transitionClaim(claim.id, to, {
              payload: { source: "email", message_id: messageId },
              patch: to === "waiting_input" ? { missing_fields: classification!.requested_fields } : {},
            });
          } catch {
            // Transition not allowed from the current status (e.g. still submitting): email is stored anyway.
          }
        }
        result.stored++;
      }
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return result;
}
