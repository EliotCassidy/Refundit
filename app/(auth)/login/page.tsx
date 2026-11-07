// OWNER: Dev 1 (styled by Dev 2's design pass). Email/password auth.
import { Candy, Logo } from "@/components/ui/brand";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-8 md:grid-cols-2 md:items-center md:gap-10 md:py-16">
      <section className="panel panel-recover flex flex-col gap-5 rounded-[28px] p-6 md:p-10">
        <Candy kind="recover" size={56} />
        <h1 className="title-tight text-[44px] font-bold md:text-[64px]">Récupère ton argent.</h1>
        <p className="max-w-sm text-[#5B635E]">
          Un produit défectueux ? Scanne ton ticket, coche le produit : notre agent écrit à la marque pour toi.
        </p>
      </section>
      <section className="flex flex-col gap-2 rounded-[28px] border border-line bg-raised p-6 md:p-8">
        <Logo />
        <p className="mt-2 text-sm text-muted">Connecte-toi pour suivre tes remboursements.</p>
        <LoginForm next={typeof next === "string" && next.startsWith("/") ? next : "/"} />
      </section>
    </main>
  );
}
