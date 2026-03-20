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
    default: "Chains ERP | Finance",
    template: "%s | Chains ERP"
  },
  description:
    "Chains ERP helps you run your entire business—from invoicing to global payments—in one place. Chains ERP helps companies manage finances, automate operations, and get paid across borders with ease. From expenses and payroll to team and vendor management, businesses use Chains to simplify workflows, stay in control, and scale faster worldwide.",
    keywords: [
      "Chains ERP",
      "global finance software",
      "business management platform",
      "all-in-one ERP system",
      "enterprise resource planning",
      "global payments platform",
      "cross-border payments",
      "multi-currency business tools",
      "international invoicing",
      "accounts payable and receivable",
      "financial operations platform",
      "business automation software",
      "B2B finance platform",
      "enterprise finance solution",
      "startup finance tools",
      "SME business software",
      "corporate finance management",
      "global payroll solutions",
      "remote team payments",
      "vendor and supplier management",
      "expense management system",
      "cash flow management software",
      "real-time financial tracking",
      "business scaling tools",
      "operations management platform",
      "digital finance infrastructure",
      "stable currency payments",
      "modern payment rails",
      "fast business payments",
      "secure global transactions",
      "web3 erp",
      "blockchain erp",
      "crypto payments",
      "stablecoin payments",
      "decentralized accounting",
      "smart contract finance",
      "on-chain finance",
      "Christopher Odhiambo",
      "next generation erp",
      "future of business finance",
      "borderless business operations"
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
  "Run your business and finances globally in one place. Manage invoices, payments, expenses, and operations with a platform built for scale, speed, and cross-border growth.",
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
    title: "Chains ERP – Financial Operations Simplified",
    description:
      "Chains ERP gives businesses the tools to send invoices, receive payments, manage expenses, and run operations across countries effortlessly. With modern global payment rails and stable-value currencies, companies reduce costs, get paid faster, and operate with confidence—while keeping everything organized in one place.",
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
