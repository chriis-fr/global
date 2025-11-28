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
  authors: [{ name: "Christopher Odhiambo" }],
  creator: "Christopher Odhiambo",
  publisher: "Chains ERP",
  icons: {
    icon: "/chains.PNG",
    shortcut: "/chains.PNG",
    apple: "/chains.PNG",
  },

  openGraph: {
    title: "Chains ERP – Global Finance & Web3 Business Automation",
    description:
      "A powerful ERP that merges Web2 and Web3 to power global businesses with accounting, HR, payments, and decentralized finance tools.",
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
        {/* Set cursor CSS variables BEFORE React hydrates - this ensures they're available when AnimatedCursor mounts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof document !== 'undefined' && document.body) {
                  document.body.style.setProperty('--cursor-color', 'rgb(59, 130, 246)');
                  document.body.style.setProperty('--blur', '3px');
                  document.body.style.setProperty('--innerBlur', '2px');
                  document.body.style.setProperty('--outerColor', 'rgba(59, 130, 246, 0.4)');
                } else {
                  // If body doesn't exist yet, set on DOMContentLoaded
                  if (typeof document !== 'undefined') {
                    document.addEventListener('DOMContentLoaded', function() {
                      if (document.body) {
                        document.body.style.setProperty('--cursor-color', 'rgb(59, 130, 246)');
                        document.body.style.setProperty('--blur', '3px');
                        document.body.style.setProperty('--innerBlur', '2px');
                        document.body.style.setProperty('--outerColor', 'rgba(59, 130, 246, 0.4)');
                      }
                    });
                  }
                }
              })();
            `,
          }}
        />
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
