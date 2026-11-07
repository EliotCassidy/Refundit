// OWNER: Dev 2. NotCoca consumer-service page (fictional demo brand).
import type { Metadata } from "next";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contactez-nous" };

const CHANNELS = [
  { title: "Chat en direct", body: "Du lundi au vendredi, de 9 h à 17 h (hors jours fériés)." },
  { title: "Téléphone", body: "01 00 00 00 00 (numéro fictif), du lundi au vendredi de 9 h à 17 h." },
  { title: "Formulaire", body: "Remplissez le formulaire ci-dessous : nous vous répondons par e-mail." },
];

export default function ContactPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-script text-4xl text-notcoca sm:text-5xl">Contactez-nous</h1>
        <p className="text-neutral-600">
          Une question sur nos boissons ou un problème avec un produit acheté ? Notre service consommateurs est là pour vous aider.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {CHANNELS.map((c) => (
          <div key={c.title} className="rounded-2xl bg-neutral-50 p-4">
            <h2 className="font-bold">{c.title}</h2>
            <p className="mt-1 text-sm text-neutral-600">{c.body}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-200">
        <div className="bg-notcoca px-5 py-4 sm:px-8">
          <h2 className="font-script text-2xl text-white">Formulaire de contact</h2>
          <p className="mt-1 text-sm text-white/85">Les champs marqués d&apos;un * sont obligatoires.</p>
        </div>
        <div className="p-5 sm:p-8">
          <ContactForm />
        </div>
      </section>
    </div>
  );
}
