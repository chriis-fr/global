import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'global_finance';

let client: MongoClient | null = null;
let db: Db | null = null;
let connectionPromise: Promise<Db> | null = null;

export async function connectToDatabase(): Promise<Db> {
  // If we already have a connection, return it
  if (db) {
    // console.log('✅ [Database] Using existing database connection');
    return db;
  }

  // If we're already connecting, wait for that connection
  if (connectionPromise) {
    return connectionPromise;
  }
  
  // Create a new connection promise
  connectionPromise = createConnection();
  
  try {
    db = await connectionPromise;
    connectionPromise = null; // Clear the promise after successful connection
    return db;
  } catch (error) {
    connectionPromise = null; // Clear the promise on error
    throw error;
  }
}

async function createConnection(): Promise<Db> {
  try {
    // Configure MongoDB client with proper SSL settings
    const clientOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      // SSL/TLS configuration
      ssl: MONGODB_URI.includes('mongodb+srv://') || MONGODB_URI.includes('ssl=true'),
      tls: MONGODB_URI.includes('mongodb+srv://') || MONGODB_URI.includes('ssl=true'),
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
    };

    client = new MongoClient(MONGODB_URI, clientOptions);

    await client.connect();
    db = client.db(DB_NAME);
    
    // Test the connection
    await db.admin().ping();
    
    return db;
  } catch (error) {
    console.error('❌ [Database] Failed to connect to MongoDB:', error);
    console.error('🔍 [Database] Connection error details:', {
      uri: MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
      dbName: DB_NAME,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Clean up on error
    if (client) {
      await client.close();
      client = null;
    }
    db = null;
    
    throw error;
  }
}

export async function getDatabase(): Promise<Db> {
  return connectToDatabase();
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    connectionPromise = null;

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