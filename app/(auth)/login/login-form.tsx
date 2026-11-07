"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { group } from "@/components/ui/list";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/shared/supabase/client";
import { Sparkles } from "lucide-react";
import { setDemo } from "@/components/demo/demo-state";
import { DEMO_EMAIL, DEMO_PASSWORD, isDemoEmail } from "@/lib/demo/config";

const input = "h-[52px] w-full bg-transparent px-5 text-[15px] text-ink outline-none transition placeholder:text-muted focus:bg-black/[0.015]";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [demo, setDemoMode] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Jury demo: types the demo credentials, then signs in (the account is reset to its saved state).
  async function toggleDemo() {
    const on = !demo;
    setDemoMode(on);
    setMode("signin");
    if (!on || !emailRef.current || !passwordRef.current) return;
    const type = async (el: HTMLInputElement, text: string) => {
      el.value = "";
      for (const ch of text) {
        el.value += ch;
        await new Promise((r) => setTimeout(r, 35));
      }
    };
    await type(emailRef.current, DEMO_EMAIL);
    await type(passwordRef.current, DEMO_PASSWORD);
    await new Promise((r) => setTimeout(r, 250));
    formRef.current?.requestSubmit();
  }

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
    if (demo && isDemoEmail(credentials.email)) {
      // One jury at a time: take the demo lock (and reset the account), or step back out.
      const session = crypto.randomUUID();
      const res = await fetch("/api/demo/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session }) }).catch(() => null);
      if (!res?.ok) {
        const body = await res?.json().catch(() => null);
        await supabase.auth.signOut();
        setPending(false);
        setDemoMode(false);
        return setError(body?.error?.message ?? "Mince, la démo n'a pas pu démarrer. Réessaye dans un instant.");
      }
      setDemo({ step: "intro", session });
      router.replace("/");
    } else {
      setDemo(null);
      router.replace(mode === "signup" ? "/onboarding" : next);
    }
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={demo}
        onClick={toggleDemo}
        disabled={pending}
        className={`${group} flex items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-white`}
      >
        <span className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors ${demo ? "bg-brand text-on-brand" : "bg-black/[0.05] text-ink"}`}>
          <Sparkles className="size-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Mode démo</span>
          <span className="block text-[13px] text-muted">Visite guidée pour le jury, compte de démonstration</span>
        </span>
        <span className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors ${demo ? "justify-end bg-brand" : "justify-start bg-black/15"}`}>
          <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className="size-6 rounded-full bg-white shadow-[0_1px_3px_rgba(17,23,20,0.3)]" />
        </span>
      </button>
      <div className={`${group} divide-y divide-black/[0.05]`}>
      <input ref={emailRef} name="email" type="email" required placeholder="E-mail" autoComplete="email" className={input} />
      <PasswordInput
        ref={passwordRef}
        name="password"
        required
        minLength={6}
        placeholder="Mot de passe"
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        className={input}
      />
      </div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-5 text-sm text-on-danger-soft">
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
