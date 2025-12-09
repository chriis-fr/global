"use client";

import { createAppKit } from "@reown/appkit/react";
import { celo } from "@reown/appkit/networks";

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

if (!projectId) {
  throw new Error("NEXT_PUBLIC_REOWN_PROJECT_ID is not set in environment variables");
}

// Create a singleton AppKit instance
export const appKit = createAppKit({
  projectId,
  networks: [celo], // Celo network support
  metadata: {
    name: "Chains ERP",
    description: "Invoice and Payment Management System",
    url: typeof window !== 'undefined' ? window.location.origin : '',
    icons: []
  },
});

