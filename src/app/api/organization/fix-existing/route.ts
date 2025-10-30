import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';

// POST /api/organization/fix-existing - Fix existing organizations with subscription and name issues
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDatabase();
    
    console.log('🔄 [Fix Organizations] Starting migration for existing organizations...');
    
    // Get all organizations
    const organizations = await db.collection('organizations').find({}).toArray();
    console.log(`📊 [Fix Organizations] Found ${organizations.length} organizations to check`);
    
    let fixedCount = 0;
    let subscriptionTransferredCount = 0;
    
    for (const org of organizations) {
      console.log(`🔍 [Fix Organizations] Processing organization: ${org.name}`);
      
      // Find the owner of this organization
      const owner = org.members.find((member: { role: string }) => member.role === 'owner');
      if (!owner) {
        console.log(`⚠️ [Fix Organizations] No owner found for organization: ${org.name}`);
        continue;
      }
      
      // Get the owner user
      const ownerUser = await db.collection('users').findOne({ _id: owner.userId });
      if (!ownerUser) {
        console.log(`⚠️ [Fix Organizations] Owner user not found for organization: ${org.name}`);
        continue;
      }
      
      let needsUpdate = false;
      const updates: Record<string, unknown> = {};
      
    // Check if organization has no subscription but owner has one
    if (!org.subscription && ownerUser.subscription) {
      console.log(`🔄 [Fix Organizations] Transferring subscription from owner to organization: ${org.name}`);
      updates.subscription = ownerUser.subscription;
      needsUpdate = true;
      subscriptionTransferredCount++;
      
      // Also remove subscription from owner user
      await db.collection('users').updateOne(
        { _id: ownerUser._id },
        { 
          $unset: { subscription: 1 },
          $set: { updatedAt: new Date() }
        }
      );
      console.log(`✅ [Fix Organizations] Removed individual subscription from owner: ${ownerUser.email}`);
    }
      
      // Check if organization name is the same as owner name (this is wrong)
      if (org.name === ownerUser.name) {
        console.log(`🔄 [Fix Organizations] Organization name matches owner name, this needs manual fix: ${org.name}`);
        // We can't automatically fix this without knowing the actual company name
        // This will need to be fixed manually by the user
      }
      
      // Update organization if needed
      if (needsUpdate) {
        await db.collection('organizations').updateOne(
          { _id: org._id },
          { 
            $set: { 
              ...updates,
              updatedAt: new Date()
            } 
          }
        );
        
        // Remove subscription from owner if it was transferred
        if (updates.subscription) {
          await db.collection('users').updateOne(
            { _id: ownerUser._id },
            { 
              $unset: { subscription: 1 },
              $set: { updatedAt: new Date() }
            }
          );
        }
        
        fixedCount++;
        console.log(`✅ [Fix Organizations] Fixed organization: ${org.name}`);
      }
    }
    
    console.log(`🎉 [Fix Organizations] Migration completed!`);
    console.log(`📊 [Fix Organizations] Summary:`);
    console.log(`   - Organizations processed: ${organizations.length}`);
    console.log(`   - Organizations fixed: ${fixedCount}`);
    console.log(`   - Subscriptions transferred: ${subscriptionTransferredCount}`);
    
    return NextResponse.json({
      success: true,
      message: 'Organization migration completed',
      data: {
        organizationsProcessed: organizations.length,
        organizationsFixed: fixedCount,
        subscriptionsTransferred: subscriptionTransferredCount
      }
    });
    
  } catch (error) {
    console.error('❌ [Fix Organizations] Error during migration:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to migrate organizations',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
