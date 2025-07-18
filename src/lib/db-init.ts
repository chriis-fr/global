import { getDatabase } from './database';

let isInitialized = false;

export async function initializeDatabaseConnection() {
  console.log('🚀 [DB-Init] Starting database initialization...');
  if (isInitialized) {
    console.log('✅ [DB-Init] Database already initialized, skipping...');
    return;
  }

  try {
    console.log('🔌 [DB-Init] Connecting to MongoDB...');
    const db = await getDatabase();
    
    // Test the connection by running a simple command
    console.log('🏓 [DB-Init] Testing connection with ping...');
    await db.command({ ping: 1 });
    
    console.log('✅ [DB-Init] MongoDB connected successfully');
    console.log(`📊 [DB-Init] Database: ${db.databaseName}`);
    
    // List collections to verify they exist
    console.log('📁 [DB-Init] Listing collections...');
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    console.log(`📁 [DB-Init] Available collections: ${collectionNames.join(', ')}`);
    
    isInitialized = true;
    console.log('✅ [DB-Init] Database initialization completed successfully');
  } catch (error) {
    console.error('❌ [DB-Init] Failed to connect to MongoDB:', error);
    console.error('🔍 [DB-Init] Connection error details:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    throw error;
  }
}

// Auto-initialize when this module is imported
if (typeof window === 'undefined') { // Only run on server-side
  initializeDatabaseConnection().catch(console.error);
} 