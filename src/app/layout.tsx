import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ProvidersWrapper } from "@/components/providers/ProvidersWrapper";
import { PWARefresh } from "@/components/pwa/PWARefresh";
import { authOptions } from "@/lib/auth";

// Only session is preloaded (fast cookie read). Subscription/currency/permissions load on client.
// Passing initialSession avoids GET /api/auth/session on the client.

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://chains-erp.com"),
  title: {
    default: "Global Finance - Send Invoices, get paid globally",
    template: "%s | Chains ERP"
  },
  description:
    "Chains ERP is a next-generation global finance and business automation platform integrating Web2 + Web3 technology. For companies seeking accounting, payroll, HR, blockchain payments, B2B automation, and decentralized financial tools.",
  keywords: [
    "Chains ERP",
    "global finance software",
    "web3 erp",
    "blockchain erp",
    "crypto payments",
    "b2b finance platform",
    "decentralized accounting",
    "smart contract finance",
    "Christopher Odhiambo",
    "next generation erp"
  ],
  other: {
    "safe-apps": "true"
  },
  authors: [{ name: "Christopher Odhiambo" }],
  creator: "Christopher Odhiambo",
  publisher: "Chains ERP",
  icons: {
    icon: "/chains.PNG",
    shortcut: "/chains.PNG",
    apple: "/chains.PNG",
  },

  openGraph: {
    title: "Global Finance - Send Invoices, get paid globally",
    description:
      "Manage invoices, payables and more with the most flexible and secure finance platform.",
    url: "https://global.chains-erp.com",
    siteName: "Chains ERP",
    images: [
      {
        url: "/chains.PNG",
        width: 1200,
        height: 630,
        alt: "Chains ERP – Global Finance Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Chains ERP – Finance + Web3 automation",
    description:
      "Next-generation ERP that merges Web2 and Web3 for global businesses.",
    images: ["/chains.PNG"],
    creator: "@chains_erp",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },

  alternates: {
    canonical: "https://global.chains-erp.com",
  },
};


export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  themeColor: "#1c398e", // Matches the blue theme - controls status bar color on mobile
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    // Don't block first paint; client will fetch session if needed
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <meta name="safe-apps" content="true" />
      <link rel="icon" href="/chains.PNG" />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{
          margin: 0,
          padding: 0,
        }}
        suppressHydrationWarning
      >
        <ProvidersWrapper initialSession={session}>
          {children}
        </ProvidersWrapper>
        <PWARefresh />
      </body>
    </html>
  );
}
