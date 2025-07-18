import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'request_finance';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
  console.log('🔌 [Database] Attempting to connect to MongoDB...');
  if (db) {
    console.log('✅ [Database] Using existing database connection');
    return db;
  }

  try {
    client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('🔌 [Database] Connecting to MongoDB URI:', MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    
    console.log('✅ [Database] Connected to MongoDB successfully');
    console.log('📊 [Database] Database name:', DB_NAME);
    return db;
  } catch (error) {
    console.error('❌ [Database] Failed to connect to MongoDB:', error);
    console.error('🔍 [Database] Connection error details:', {
      uri: MONGODB_URI,
      dbName: DB_NAME,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

export async function getDatabase(): Promise<Db> {
  if (!db) {
    return connectToDatabase();
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed');
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
}); 