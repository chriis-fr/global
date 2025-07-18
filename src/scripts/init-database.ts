import { getDatabase } from '../lib/database';

async function initializeDatabase() {
  try {
    console.log('🚀 Initializing Request Finance Database...');
    
    const db = await getDatabase();
    
    // Create collections
    const collections = [
      'organizations',
      'clients', 
      'invoices',
      'payments',
      'expenses',
      'transactions',
      'auditlogs'
    ];

    console.log('📁 Creating collections...');
    for (const collectionName of collections) {
      try {
        await db.createCollection(collectionName);
        console.log(`✅ Created collection: ${collectionName}`);
              } catch (error: unknown) {
          const err = error as { code?: number; message?: string };
          if (err.code === 48) { // Collection already exists
            console.log(`ℹ️  Collection already exists: ${collectionName}`);
          } else {
            console.error(`❌ Error creating collection ${collectionName}:`, err.message);
          }
        }
    }

    // Create indexes
    console.log('\n🔍 Creating indexes...');
    
    // Users collection indexes
    try {
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('users').createIndex({ organizationId: 1 });
      console.log('✅ Users indexes created');
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('❌ Error creating users indexes:', err.message);
    }

    // Organizations collection indexes
    try {
      await db.collection('organizations').createIndex({ name: 1 });
      await db.collection('organizations').createIndex({ billingEmail: 1 }, { unique: true });
      console.log('✅ Organizations indexes created');
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('❌ Error creating organizations indexes:', err.message);
    }

    // Clients collection indexes
    try {
      await db.collection('clients').createIndex({ organizationId: 1 });
      await db.collection('clients').createIndex({ email: 1 });
      console.log('✅ Clients indexes created');
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('❌ Error creating clients indexes:', err.message);
    }

    // Invoices collection indexes
    try {
      await db.collection('invoices').createIndex({ invoiceNumber: 1 }, { unique: true });
      await db.collection('invoices').createIndex({ issuerId: 1 });
      await db.collection('invoices').createIndex({ clientId: 1 });
      await db.collection('invoices').createIndex({ status: 1 });
      await db.collection('invoices').createIndex({ dueDate: 1 });
      console.log('✅ Invoices indexes created');
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('❌ Error creating invoices indexes:', err.message);
    }

    // Payments collection indexes
    try {
      await db.collection('payments').createIndex({ invoiceId: 1 });
      await db.collection('payments').createIndex({ payerId: 1 });
      await db.collection('payments').createIndex({ status: 1 });
      console.log('✅ Payments indexes created');
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('❌ Error creating payments indexes:', err.message);
    }

    // Expenses collection indexes
    try {
      await db.collection('expenses').createIndex({ userId: 1 });
      await db.collection('expenses').createIndex({ organizationId: 1 });
      await db.collection('expenses').createIndex({ status: 1 });
      console.log('✅ Expenses indexes created');
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('❌ Error creating expenses indexes:', err.message);
    }

    // Transactions collection indexes
    try {
      await db.collection('transactions').createIndex({ relatedId: 1 });
      await db.collection('transactions').createIndex({ organizationId: 1 });
      await db.collection('transactions').createIndex({ status: 1 });
      console.log('✅ Transactions indexes created');
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('❌ Error creating transactions indexes:', err.message);
    }

    // AuditLogs collection indexes
    try {
      await db.collection('auditlogs').createIndex({ userId: 1 });
      await db.collection('auditlogs').createIndex({ organizationId: 1 });
      await db.collection('auditlogs').createIndex({ entityId: 1 });
      await db.collection('auditlogs').createIndex({ timestamp: 1 });
      console.log('✅ AuditLogs indexes created');
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('❌ Error creating auditlogs indexes:', err.message);
    }

    console.log('\n🎉 Database initialization completed successfully!');
    console.log('\n📊 Collections created:');
    console.log('- users (already existed)');
    collections.forEach(collection => console.log(`- ${collection}`));
    
    console.log('\n🔍 Indexes created for optimal performance');
    console.log('\n✨ Your Request Finance database is ready to use!');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeDatabase().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 