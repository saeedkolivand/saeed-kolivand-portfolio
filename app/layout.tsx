import type { Metadata } from "next";
import { Bangers, Caveat, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bangers = Bangers({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bangers",
  display: "swap",
});
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // metadataBase is required for the opengraph-image file convention to emit an
  // absolute URL; most unfurlers drop a relative one.
  metadataBase: new URL("https://iamsaeed.dev"),
  title: "Saeed Kolivand -- Portfolio",
  description:
    "Saeed Kolivand -- Senior Frontend Developer. A scroll-driven comic-book portfolio.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${bangers.variable} ${caveat.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
