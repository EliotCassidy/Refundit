// OWNER: Dev 1 (styled by Dev 2's design pass). Email/password auth.
import { Logo } from "@/components/ui/brand";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="grid flex-1 place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-5 text-center">
          <Logo />
          <div>
            <h1 className="text-[30px] font-bold leading-tight tracking-tight md:text-[34px]">Récupère ton argent.</h1>
            <p className="mt-2 text-[15px] text-muted">Un produit défectueux ? Scanne ton ticket, notre agent écrit à la marque pour toi.</p>
          </div>
        </div>
        <section className="rounded-[24px] border border-line bg-raised/90 p-6 shadow-[0_12px_40px_rgba(17,23,20,0.06)] backdrop-blur md:p-7">
          <LoginForm next={typeof next === "string" && next.startsWith("/") ? next : "/"} />
        </section>
      </div>
    </main>
  );
}
