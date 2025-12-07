/**
 * Utility functions for generating Safe App URLs
 * These work immediately without Safe approval/listing
 */

/**
 * Generate a Safe App deep link using the share format
 * This works 100% without needing Safe to approve your app
 * 
 * Format: https://app.safe.global/share/safe-app?appUrl=YOUR_URL
 * 
 * @param appUrl - Your Safe App URL (e.g., https://yourapp.com/safe/pay?payableId=123)
 * @returns Safe App deep link URL
 */
export function generateSafeAppShareUrl(appUrl: string): string {
    const baseUrl = "https://app.safe.global/share/safe-app";
    return `${baseUrl}?appUrl=${encodeURIComponent(appUrl)}`;
}

/**
 * Generate a Safe App URL with specific Safe address
 * This opens the app directly in a specific Safe
 * 
 * Format: https://app.safe.global/home?appUrl=<your_app_url>&safe=<chain>:<safe_address>
 * 
 * @param appUrl - Your Safe App URL
 * @param safeAddress - Safe wallet address (optional)
 * @param chainId - Chain ID (optional, defaults to 'eth' if not provided)
 * @returns Safe App URL with Safe address
 */
export function generateSafeAppUrlWithSafe(
    appUrl: string,
    safeAddress?: string,
    chainId?: number
): string {
    const baseUrl = "https://app.safe.global/home";
    const params = new URLSearchParams({
        appUrl: appUrl,
    });
    
    if (safeAddress) {
        // Convert chainId to chain prefix (e.g., 42220 -> 'celo', 1 -> 'eth')
        const chainPrefix = chainId ? getChainPrefix(chainId) : 'eth';
        params.set('safe', `${chainPrefix}:${safeAddress}`);
    }
    
    return `${baseUrl}?${params.toString()}`;
}

/**
 * Convert chain ID to Safe chain prefix
 * Safe uses prefixes like 'eth', 'celo', 'polygon', etc.
 */
function getChainPrefix(chainId: number): string {
    const chainMap: Record<number, string> = {
        1: 'eth',           // Ethereum Mainnet
        5: 'eth',           // Goerli
        100: 'gno',         // Gnosis Chain
        137: 'matic',       // Polygon
        42220: 'celo',      // Celo Mainnet
        44787: 'celo',      // Celo Alfajores
        11155111: 'eth',    // Sepolia
    };
    
    return chainMap[chainId] || 'eth';
}

/**
 * Generate Safe App URL for payable payment
 * 
 * @param payableId - Payable ID
 * @param baseUrl - Base URL of your app (e.g., https://yourapp.com or from window.location.origin)
 * @param safeAddress - Optional Safe address to open directly
 * @param chainId - Optional chain ID
 * @returns Safe App URL
 */
export function generatePayableSafeAppUrl(
    payableId: string,
    baseUrl: string,
    safeAddress?: string,
    chainId?: number
): string {
    const appUrl = `${baseUrl}/safe/pay?payableId=${payableId}`;
    
    if (safeAddress) {
        return generateSafeAppUrlWithSafe(appUrl, safeAddress, chainId);
    }
    
    return generateSafeAppShareUrl(appUrl);
}

/**
 * Generate Safe App URL for invoice payment
 * 
 * @param invoiceId - Invoice ID
 * @param baseUrl - Base URL of your app
 * @param safeAddress - Optional Safe address to open directly
 * @param chainId - Optional chain ID
 * @returns Safe App URL
 */
export function generateInvoiceSafeAppUrl(
    invoiceId: string,
    baseUrl: string,
    safeAddress?: string,
    chainId?: number
): string {
    const appUrl = `${baseUrl}/safe/pay?invoiceId=${invoiceId}`;
    
    if (safeAddress) {
        return generateSafeAppUrlWithSafe(appUrl, safeAddress, chainId);
    }
    
    return generateSafeAppShareUrl(appUrl);
}

