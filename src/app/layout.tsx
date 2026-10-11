import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Sans, Newsreader } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "./globals.css";

/** Interface type: labels, buttons, meta lines. */
const instrumentSans = Instrument_Sans({
  variable: "--font-ui-sans",
  subsets: ["latin"],
});

/** Reading type: titles and article text. Optical sizing keeps it crisp from
    13px captions to 64px headlines. */
const newsreader = Newsreader({
  variable: "--font-reading-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Good Content",
    template: "%s · Good Content",
  },
  description: "A calm place to save what matters and find it again.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Good Content",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

/** Paper status bar, so the system chrome meets the app header cleanly. */
export const viewport: Viewport = {
  themeColor: "#f6f3ea",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${newsreader.variable} ${geistMono.variable}`}
    >
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
