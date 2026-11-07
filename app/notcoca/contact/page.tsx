// OWNER: Dev 2. NotCoca consumer-service page (fictional demo brand).
import type { Metadata } from "next";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { Bubbles, DISPLAY, Wave } from "../brand";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contactez-nous" };

const CHANNELS = [
  { icon: MessageCircle, title: "Chat en direct", body: "Du lundi au vendredi, de 9 h à 17 h (hors jours fériés)." },
  { icon: Phone, title: "Téléphone", body: "01 00 00 00 00 (numéro fictif), du lundi au vendredi de 9 h à 17 h." },
  { icon: Mail, title: "Formulaire", body: "Remplissez le formulaire ci-dessous : nous vous répondons par e-mail." },
];

export default function ContactPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-notcoca text-white">
        <div aria-hidden className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_80%_20%,rgba(255,255,255,0.28),transparent_55%)]" />
        <Bubbles count={6} />
        <div className="mx-auto max-w-3xl px-4 pb-24 pt-12 sm:pb-28 sm:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">Service consommateurs</p>
          <h1 className="mt-2 font-script text-5xl leading-tight sm:text-6xl">Contactez-nous</h1>
          <p className="mt-3 max-w-xl text-white/90">
            Une question sur nos boissons ou un problème avec un produit acheté ? Notre service consommateurs est là pour vous aider.
          </p>
        </div>
        <Wave className="absolute inset-x-0 -bottom-px h-12 w-full text-white sm:h-16" />
      </section>

      <div className="relative z-10 mx-auto -mt-12 grid max-w-3xl gap-3 px-4 sm:grid-cols-3">
        {CHANNELS.map((c) => (
          <div key={c.title} className="flex gap-3 rounded-3xl bg-white p-4 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.3)] ring-1 ring-black/5 sm:block">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-notcoca/10 text-notcoca">
              <c.icon className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-bold sm:mt-3">{c.title}</h2>
              <p className="mt-0.5 text-sm text-neutral-600">{c.body}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="mx-auto max-w-3xl px-4 pt-8">
        <div className="rounded-[28px] bg-white p-5 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.3)] ring-1 ring-black/5 sm:p-10">
          <div className="mb-6">
            <h2 className={`${DISPLAY} text-3xl font-extrabold sm:text-4xl`}>Formulaire de contact</h2>
            <p className="mt-1 text-sm text-neutral-500">Les champs marqués d&apos;un * sont obligatoires.</p>
          </div>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
