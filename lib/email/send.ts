// OWNER: Dev 2. Email fallback: send the complaint to the brand's support email via Resend.
// From = the claim alias on RESEND_FROM_DOMAIN (must be a domain verified for SENDING in Resend),
// Reply-To = the claim's inbound address, so the brand's answer lands in the claim timeline.
import "server-only";
import { Resend } from "resend";

export type ComplaintEmail = {
  to: string;
  fromName: string;
  alias: string;
  replyTo: string;
  subject: string;
  text: string;
  attachment: { filename: string; base64: string; contentType: string } | null;
};

export function emailSendingConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_DOMAIN);
}

export async function sendComplaintEmail(m: ComplaintEmail): Promise<{ id: string }> {
  if (!emailSendingConfigured()) throw new Error("RESEND_API_KEY / RESEND_FROM_DOMAIN not set");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const safeName = m.fromName.replace(/[<>"]/g, "");
  const { data, error } = await resend.emails.send({
    from: `${safeName} <${m.alias}@${process.env.RESEND_FROM_DOMAIN}>`,
    to: m.to,
    replyTo: m.replyTo,
    subject: m.subject,
    text: m.text,
    attachments: m.attachment
      ? [{ filename: m.attachment.filename, content: m.attachment.base64, contentType: m.attachment.contentType }]
      : undefined,
  });
  if (error || !data) throw new Error(`Resend: ${error?.message ?? "no data"}`);
  return { id: data.id };
}
