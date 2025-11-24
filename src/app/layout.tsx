import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { CurrencyProvider } from "@/lib/contexts/CurrencyContext";
import { SubscriptionProvider } from "@/lib/contexts/SubscriptionContext";
import { PermissionProvider } from "@/lib/contexts/PermissionContext";

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
  title: "Chains-Global Finance",
  icons: {
    icon: "./chains.PNG"
  }
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
      >
        <SessionProvider>
          <CurrencyProvider>
            <SubscriptionProvider>
              <PermissionProvider>
                {children}
              </PermissionProvider>
            </SubscriptionProvider>
          </CurrencyProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
