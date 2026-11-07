// OWNER: Dev 2. Agent instruction (ARCHITECTURE.md §5.2). Pure module so scripts can import it.

export type InstructionInput = {
  contactUrl: string;
  agentHints: string | null;
  dryRun: boolean;
  customer: {
    civility: "madame" | "monsieur" | "autre" | null; // from the profile (onboarding)
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2: string | null;
    postalCode: string;
    city: string;
    country: string;
    phone: string | null;
    email: string; // ALWAYS the claim's inbound address, never the user's real email
  };
  product: {
    identified: boolean; // false → only the raw receipt label is known (CLAUDE.md rule 8)
    name: string; // confirmed name, or the raw receipt label
    brand: string | null;
    ean: string | null;
    purchasedAt: string | null;
    storeName: string | null;
    priceCents: number | null;
  };
  complaintText: string;
  userAnswers: Record<string, string>; // answers to fields the form required in a previous attempt
  receiptFileName: string | null; // file attached to the session (lands in ~/Downloads)
};

export function buildInstruction(i: InstructionInput): string {
  const c = i.customer;
  const address = [c.addressLine1, c.addressLine2, `${c.postalCode} ${c.city}`, c.country].filter(Boolean).join(", ");
  const price = i.product.priceCents != null ? `${(i.product.priceCents / 100).toFixed(2)} EUR` : "unknown";
  const finalStep = i.dryRun
    ? `7. TEST MODE: do NOT click the button that actually SENDS the request (Envoyer, Valider, Soumettre). Stop just before it and answer with submitted=false, blocker=null, notes="dry_run_ready".`
    : `7. Submit the form. Then read the confirmation page/message and report any confirmation or ticket number.`;

  return `You are filing a genuine product complaint on behalf of a customer, on the brand's official customer-service contact form. The website is in French.

Start URL: ${i.contactUrl}
${i.agentHints ? `Hints about this website: ${i.agentHints}\n` : ""}
Steps:
1. Find the contact form for a product complaint / "réclamation produit" / "un problème avec un produit" (not marketing, not job offers, not press). Accept or dismiss cookie banners if needed.
2. Fill the fields ONLY with the data below. NEVER invent a value. ${i.customer.civility === "madame" || i.customer.civility === "monsieur"
    ? `The customer's civility is provided below: use it for any civility / gender field.`
    : `The customer did not give a civility: if a civility field exists, choose a neutral option ("Autre", "Non précisé", "Ne souhaite pas répondre") when offered; if the only options are Madame/Monsieur and the field is required, list it in missing_fields.`} Questions about the customer's situation or the product's condition (e.g. "Do you still have the product?", "Was the packaging opened?", number of affected items when not given) are NEVER answered by you: if such a question is required, do not answer it, and list its exact label in missing_fields. Splitting or reformatting data that IS provided is not guessing: e.g. if the form splits the address into "N°" / "Rue" / "Code postal" / "Ville", split the postal address below; reformat dates as the form expects. For a dropdown or radio button, choose an option ONLY if it clearly matches the data below (e.g. the format written in the product name). Never pick an arbitrary option just to satisfy a required field: prefer "Autre" / "Non précisé" / "Je ne sais pas" if offered; otherwise do not fill it and keep going: fill everything else you can, look at EVERY field of the form (scroll to the end, and go through the following steps when the form lets you), then stop with blocker="missing_info" and list ALL the missing required field labels at once in missing_fields (we ask the customer once, so do not report them one by one). If you had to choose a value anyway, list the field in guessed_fields. If a REQUIRED field asks for information that is not provided below (for example a batch number or best-before date), stop and answer with blocker="missing_info" and the field name in notes. Optional fields without data must be left empty.
3. For the message / description field, paste the complaint text below EXACTLY as given.
4. ${i.receiptFileName ? `If there is a file-upload field (proof of purchase / ticket de caisse / pièce jointe), upload the file "${i.receiptFileName}" from the Downloads folder. If the upload fails and it is required, answer with blocker="upload_failed".` : "Do not upload any file."}
4b. Many forms have SEVERAL STEPS (product details first, then customer details). A button such as "Suivant", "Continuer", "Étape suivante" or "Valider l'étape" only moves to the next step: click it and keep filling. Only the button that finally sends the request counts as the submit button. Do not stop until you have entered the customer's name AND email. If the form has no field at all for the customer's email, say so in notes.
5. Do not create an account. If logging in or creating an account is required, answer with blocker="login_required".
6. If a CAPTCHA blocks you and you cannot solve it, answer with blocker="captcha". If no contact form exists (only phone or postal mail), answer with blocker="no_contact_form".
${finalStep}

Customer data:
- Civility: ${c.civility === "madame" ? "Madame" : c.civility === "monsieur" ? "Monsieur" : "not provided"}
- First name: ${c.firstName}
- Last name: ${c.lastName}
- Email: ${c.email}
- Phone: ${c.phone ?? "not provided"}
- Postal address: ${address}

Product:
- Product: ${i.product.identified
    ? `${i.product.name}${i.product.brand ? ` (brand: ${i.product.brand})` : ""}`
    : `NOT IDENTIFIED. The receipt only says "${i.product.name}" (abbreviated label, quote it as printed). Do not state any product name, format or barcode beyond this label.`}
- Bought on: ${i.product.purchasedAt ? i.product.purchasedAt.slice(0, 10) : "unknown"} at ${i.product.storeName ?? "unknown store"}
- Price paid: ${price}
- EAN / barcode: ${i.product.ean ?? "not provided"}

${Object.keys(i.userAnswers).length ? `Additional details provided by the customer (use them for the matching form fields):
${Object.entries(i.userAnswers).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

` : ""}Complaint text (paste exactly):
"""
${i.complaintText}
"""

Answer with:
- submitted: true only if the form was actually sent
- confirmation_number: or null
- form_url: URL of the form you used, or null
- blocker: null if none
- customer_email_entered: true only if you typed the customer's email into the form
- submit_button_found: true only if you found the button that actually sends the request
- guessed_fields: names of the fields you filled with a value that is NOT in the data above (empty list if none)
- missing_fields: exact labels of the REQUIRED fields you could not fill because the data is not above (empty list if none)
- notes: one short sentence`;
}
