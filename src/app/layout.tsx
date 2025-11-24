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
        suppressHydrationWarning
      >
        {/* Set cursor CSS variables BEFORE React hydrates - this ensures they're available when AnimatedCursor mounts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof document !== 'undefined' && document.body) {
                  document.body.style.setProperty('--cursor-color', 'rgb(238, 19, 19)');
                  document.body.style.setProperty('--blur', '3px');
                  document.body.style.setProperty('--innerBlur', '2px');
                  document.body.style.setProperty('--outerColor', 'rgba(226, 79, 46, 0.4)');
                } else {
                  // If body doesn't exist yet, set on DOMContentLoaded
                  if (typeof document !== 'undefined') {
                    document.addEventListener('DOMContentLoaded', function() {
                      if (document.body) {
                        document.body.style.setProperty('--cursor-color', 'rgb(238, 19, 19)');
                        document.body.style.setProperty('--blur', '3px');
                        document.body.style.setProperty('--innerBlur', '2px');
                        document.body.style.setProperty('--outerColor', 'rgba(226, 79, 46, 0.4)');
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
                {children}
              </PermissionProvider>
            </SubscriptionProvider>
          </CurrencyProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
