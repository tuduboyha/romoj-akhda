import type { Metadata } from "next";
import { Baloo_2, Mukta, IBM_Plex_Mono, Noto_Sans_Ol_Chiki } from "next/font/google";
import "./globals.css";

const display = Baloo_2({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Mukta({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const olChiki = Noto_Sans_Ol_Chiki({
  variable: "--font-ol-chiki",
  subsets: ["ol-chiki"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Romoj Akhra",
  description:
    "Romoj Akhra — folk sessions and tribal beats from the Santal heartland, always playing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} ${olChiki.variable} h-full`}
    >
      <body className="h-full antialiased overflow-hidden">{children}</body>
    </html>
  );
}
