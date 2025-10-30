import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Only allow owners/admins to run this fix
    const db = await connectToDatabase();
    // Check if session.user.id is a valid ObjectId string and convert
    let user;
    if (/^[0-9a-fA-F]{24}$/.test(session.user.id)) {
      user = await db.collection('users').findOne({ _id: new ObjectId(session.user.id) });
    } else if (session.user.email) {
      // Fallback to email if ID is not a valid ObjectId
      user = await db.collection('users').findOne({ email: session.user.email });
    } else {
      return NextResponse.json({ success: false, message: 'Invalid user session' }, { status: 401 });
    }
    
    if (!user?.organizationId) {
      return NextResponse.json({ success: false, message: 'Only organization members can run this fix' }, { status: 403 });
    }

    // Convert organizationId to ObjectId if needed
    const orgId = user.organizationId instanceof ObjectId 
      ? user.organizationId 
      : /^[0-9a-fA-F]{24}$/.test(String(user.organizationId))
        ? new ObjectId(String(user.organizationId))
        : null;
    
    if (!orgId) {
      return NextResponse.json({ success: false, message: 'Invalid organization ID' }, { status: 400 });
    }
    
    const organization = await db.collection('organizations').findOne({ _id: orgId });
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
