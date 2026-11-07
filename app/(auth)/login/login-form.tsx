"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/shared/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const credentials = {
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    };
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);
    setPending(false);
    if (error) return setError(error.message);
    router.replace(mode === "signup" ? "/onboarding" : next);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="mt-8 flex flex-col gap-3">
      <input name="email" type="email" required placeholder="Email" autoComplete="email"
        className="rounded-lg border border-neutral-500/30 px-3 py-2" />
      <input name="password" type="password" required minLength={6} placeholder="Mot de passe"
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        className="rounded-lg border border-neutral-500/30 px-3 py-2" />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button disabled={pending} className="rounded-lg bg-foreground px-3 py-2 font-medium text-background disabled:opacity-50">
        {mode === "signin" ? "Se connecter" : "Créer un compte"}
      </button>
      <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="text-sm text-neutral-500 underline">
        {mode === "signin" ? "Pas de compte ? Inscription" : "Déjà inscrit ? Connexion"}
      </button>
    </form>
  );
}
