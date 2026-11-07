"use client";
// OWNER: Dev 1. Déconnexion → retour à la page de connexion.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/shared/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={signOut} disabled={pending}
      className="rounded-[20px] border border-line-strong/50 px-4 py-3 font-medium disabled:opacity-40">
      {pending ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}
