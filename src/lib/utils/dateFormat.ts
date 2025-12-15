/**
 * Date formatting utilities that are consistent across server and client
 * Prevents hydration mismatches by using consistent formatting
 */

/**
 * Format date consistently (MM/DD/YYYY) to avoid hydration mismatches
 * Uses explicit formatting instead of locale-dependent toLocaleDateString
 */
export function formatDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(date.getTime())) {
      console.warn('Invalid date provided to formatDate:', dateString);
      return 'Invalid Date';
    }
    
    // Use explicit formatting to avoid locale differences
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${month}/${day}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error, 'Date value:', dateString);
    return 'Invalid Date';
  }
}

/**
 * Format date with time consistently
 */
export function formatDateTime(dateString: string | Date | undefined | null): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(date.getTime())) {
      console.warn('Invalid date provided to formatDateTime:', dateString);
      return 'Invalid Date';
    }
    
    // Use explicit formatting to avoid locale differences
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${month}/${day}/${year} ${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting date time:', error, 'Date value:', dateString);
    return 'Invalid Date';
  }
}

/**
 * Format date in a readable format (e.g., "Dec 15, 2025")
 * Uses explicit formatting to avoid locale differences
 */
export function formatDateReadable(dateString: string | Date | undefined | null): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(date.getTime())) {
      console.warn('Invalid date provided to formatDateReadable:', dateString);
      return 'Invalid Date';
    }
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    return `${month} ${day}, ${year}`;
  } catch (error) {
    console.error('Error formatting readable date:', error, 'Date value:', dateString);
    return 'Invalid Date';
  }
}

/**
 * Format date with time in readable format (e.g., "Dec 15, 2025 3:45 PM")
 */
export function formatDateTimeReadable(dateString: string | Date | undefined | null): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(date.getTime())) {
      console.warn('Invalid date provided to formatDateTimeReadable:', dateString);
      return 'Invalid Date';
    }
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    
    return `${month} ${day}, ${year} ${hours}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting readable date time:', error, 'Date value:', dateString);
    return 'Invalid Date';
  }
}

