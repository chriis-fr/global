import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Only allow owners/admins to run this fix
    const db = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: session.user.id });
    
    if (!user?.organizationId) {
      return NextResponse.json({ success: false, message: 'Only organization members can run this fix' }, { status: 403 });
    }

    const organization = await db.collection('organizations').findOne({ _id: user.organizationId });
    const member = organization?.members.find((m: { userId: string; role: string }) => m.userId.toString() === session.user.id);
    
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return NextResponse.json({ success: false, message: 'Only owners and admins can run this fix' }, { status: 403 });
    }

    console.log('🔧 [Fix Usage] Starting to fix usage: null fields...');

    // Find users with usage: null
    const usersWithNullUsage = await db.collection('users').find({ usage: null }).toArray();
    console.log(`🔍 [Fix Usage] Found ${usersWithNullUsage.length} users with usage: null`);

    let fixedNullUsage = 0;
    if (usersWithNullUsage.length > 0) {
      // Fix users with usage: null
      const result = await db.collection('users').updateMany(
        { usage: null },
        { $set: { usage: { invoicesThisMonth: 0, monthlyVolume: 0 } } }
      );
      
      fixedNullUsage = result.modifiedCount;
      console.log(`✅ [Fix Usage] Fixed ${fixedNullUsage} users with usage: null`);
    }

    // Find users without usage field at all
    const usersWithoutUsage = await db.collection('users').find({ usage: { $exists: false } }).toArray();
    console.log(`🔍 [Fix Usage] Found ${usersWithoutUsage.length} users without usage field`);

    let fixedMissingUsage = 0;
    if (usersWithoutUsage.length > 0) {
      // Fix users without usage field
      const result = await db.collection('users').updateMany(
        { usage: { $exists: false } },
        { $set: { usage: { invoicesThisMonth: 0, monthlyVolume: 0 } } }
      );
      
      fixedMissingUsage = result.modifiedCount;
      console.log(`✅ [Fix Usage] Fixed ${fixedMissingUsage} users without usage field`);
    }

    const totalFixed = fixedNullUsage + fixedMissingUsage;
    console.log(`🎉 [Fix Usage] Total users fixed: ${totalFixed}`);

    return NextResponse.json({
      success: true,
      message: `Successfully fixed ${totalFixed} users`,
      data: {
        fixedNullUsage,
        fixedMissingUsage,
        totalFixed
      }
    });

  } catch (error) {
    console.error('❌ [Fix Usage] Error fixing usage fields:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fix usage fields',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
