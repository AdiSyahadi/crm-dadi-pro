import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#687EFF",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Power WA | WhatsApp CRM Platform",
    template: "%s | Power WA",
  },
  description:
    "SaaS CRM with WhatsApp Integration for managing contacts, conversations, deals, broadcasts, and team collaboration.",
  keywords: [
    "CRM",
    "WhatsApp",
    "WhatsApp CRM",
    "customer relationship management",
    "broadcast",
    "chat",
    "deals",
    "SaaS",
  ],
  authors: [{ name: "Power WA" }],
  creator: "Power WA",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Power WA",
    title: "Power WA | WhatsApp CRM Platform",
    description:
      "SaaS CRM with WhatsApp Integration for managing contacts, conversations, deals, broadcasts, and team collaboration.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Power WA - WhatsApp CRM Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Power WA | WhatsApp CRM Platform",
    description:
      "SaaS CRM with WhatsApp Integration for managing contacts, conversations, deals, broadcasts, and team collaboration.",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Power WA",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#687EFF",
    "msapplication-config": "/browserconfig.xml",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Power WA",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "SaaS CRM with WhatsApp Integration for managing contacts, conversations, deals, broadcasts, and team collaboration.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "IDR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
