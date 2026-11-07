// OWNER: Dev 2. Outgoing email through the dedicated Gmail account (SMTP + app password).
// Gmail: 2-Step Verification + a 16-character app password; ~500 recipients / 24 h.
// From = the Gmail account (display name = customer), Reply-To = the claim's plus address,
// so the brand's answer lands in the same mailbox and is matched to the claim.
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { plusAddress } from "./address";

export const OUTGOING_HEADER = "X-Refundit-Outgoing";

export function emailSendingConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

let transport: Transporter | undefined;
function smtp() {
  transport ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  return transport;
}

export type OutgoingEmail = {
  to: string;
  fromName: string;
  alias: string | null; // claim alias → Reply-To plus address; null = plain mailbox (NotCoca demo brand)
  subject: string;
  text: string;
  attachment?: { filename: string; base64: string; contentType: string } | null;
  inReplyTo?: string | null; // Message-ID of the brand's email when answering it
};

export async function sendEmail(m: OutgoingEmail): Promise<{ id: string }> {
  if (!emailSendingConfigured()) throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD not set");
  const replyTo = m.alias ? plusAddress(m.alias)! : undefined;
  const info = await smtp().sendMail({
    from: { name: m.fromName.replace(/[<>"]/g, ""), address: process.env.GMAIL_USER! },
    to: m.to,
    replyTo,
    subject: m.subject,
    text: m.text,
    inReplyTo: m.inReplyTo ?? undefined,
    // Marks Refundit's own mail so the inbox poller never takes it for a brand reply. NotCoca's
    // mail is deliberately NOT marked: it simulates a real brand answering.
    headers: m.alias ? { [OUTGOING_HEADER]: m.alias } : undefined,
    references: m.inReplyTo ?? undefined,
    attachments: m.attachment
      ? [{ filename: m.attachment.filename, content: Buffer.from(m.attachment.base64, "base64"), contentType: m.attachment.contentType }]
      : undefined,
  });
  return { id: info.messageId };
}
