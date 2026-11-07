// The claims list now lives on the dashboard (/).
import { redirect } from "next/navigation";

export default function ClaimsPage() {
  redirect("/");
}
