"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/shared/supabase/client";

const input =
  "h-12 w-full rounded-[12px] border border-line bg-surface px-4 text-[15px] text-ink outline-none transition placeholder:text-muted focus:border-ink focus:bg-raised";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
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
    if (error) {
      setPending(false);
      return setError(error.message);
    }
    router.replace(mode === "signup" ? "/onboarding" : next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
      <input name="email" type="email" required placeholder="E-mail" autoComplete="email" className={input} />
      <input
        name="password"
        type="password"
        required
        minLength={6}
        placeholder="Mot de passe"
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        className={input}
      />
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-sm text-on-danger-soft">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <Button type="submit" variant="dark" size="lg" block loading={pending}>
        {mode === "signin" ? "Se connecter" : "Créer un compte"}
      </Button>
      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="py-1 text-sm font-medium text-muted transition hover:text-ink"
      >
        {mode === "signin" ? "Pas de compte ? Inscription" : "Déjà inscrit ? Connexion"}
      </button>
    </form>
  );
}
