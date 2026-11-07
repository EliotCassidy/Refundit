// OWNER: Dev 2. Inbound email (Resend). Design: ARCHITECTURE.md §4.5 and §6.
//
// TODO(dev2):
// - inboundAddress(alias) → `${alias}@${INBOUND_DOMAIN}`
// - verify the Svix signature of the email.received webhook
// - fetch the email body through Resend's Receiving API (the webhook only carries metadata)
// - match the claim by recipient local part → claims.inbound_alias
// - insert claim_emails (idempotent on provider_message_id), classify with the LLM, transitionClaim
// Check Resend's receiving docs for exact field names before implementing.
import "server-only";

export {};
