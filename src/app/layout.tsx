import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { CurrencyProvider } from "@/lib/contexts/CurrencyContext";
import { SubscriptionProvider } from "@/lib/contexts/SubscriptionContext";
import { PermissionProvider } from "@/lib/contexts/PermissionContext";
import CursorManager from "@/components/CursorManager";

// Initialize database connection on app start
import '../lib/db-init';

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
    default: "Global Finance - Flexible, secure and simple borderless finance for DAOs, Freelancers, Contractors & more...",
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
    title: "Global Finance - Flexible, secure and simple borderless finance for DAOs, Freelancers, Contractors & more...",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <meta name="safe-apps" content="true" />
      <link rel="icon" href="/chains.PNG" />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{
          // background: 'linear-gradient(to bottom right, #1c398e, #172554)',
          margin: 0,
          padding: 0,
        }}
        suppressHydrationWarning
      >
        {/* Cursor CSS variables are set in globals.css - no script injection needed to prevent hydration flicker */}
        <SessionProvider>
          <CurrencyProvider>
            <SubscriptionProvider>
              <PermissionProvider>
                <CursorManager />
                {children}
              </PermissionProvider>
            </SubscriptionProvider>
          </CurrencyProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
