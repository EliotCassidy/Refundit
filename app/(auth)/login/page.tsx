// OWNER: Dev 1. Minimal working email/password auth. Polish freely.
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold">Refundit</h1>
      <p className="mt-1 text-sm text-neutral-500">Vos réclamations produits, envoyées pour vous.</p>
      <LoginForm next={typeof next === "string" && next.startsWith("/") ? next : "/"} />
    </main>
  );
}
