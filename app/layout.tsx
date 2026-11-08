import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Pacifico, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/motion";
import "./globals.css";

// Refundit typography (Refundit-Palette-et-Typographie.md §7): Jakarta for the voice, JetBrains Mono for money.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "600"] });
// NotCoca demo brand logo (font-script, /notcoca only)
const script = Pacifico({ weight: "400", variable: "--font-pacifico", subsets: ["latin"] });

const DESCRIPTION = "Un produit défectueux ? Refundit envoie la réclamation à la marque pour vous.";

// Link previews (LinkedIn, X, Slack...): the image is app/opengraph-image.png; metadataBase makes its URL absolute.
export const metadata: Metadata = {
  metadataBase: new URL("https://refundit.vercel.app"),
  title: "Refundit",
  description: DESCRIPTION,
  openGraph: { title: "Refundit", description: DESCRIPTION, siteName: "Refundit", locale: "fr_FR", type: "website" },
  twitter: { card: "summary_large_image", title: "Refundit", description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F8F7F2", // light cream theme only
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${jakarta.variable} ${jetbrains.variable} ${script.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
