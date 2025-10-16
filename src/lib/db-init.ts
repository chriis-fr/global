import { getDatabase } from './database';

let isInitialized = false;

export async function initializeDatabaseConnection() {
  if (isInitialized) {
    return;
  }

  try {
    const db = await getDatabase();
    
    // Test the connection by running a simple command
    await db.command({ ping: 1 });
    
    // List collections to verify they exist
    await db.listCollections().toArray();
    
    isInitialized = true;
  } catch (error) {
    throw error;
  }
}

// Auto-initialize when this module is imported
if (typeof window === 'undefined') { // Only run on server-side
} 