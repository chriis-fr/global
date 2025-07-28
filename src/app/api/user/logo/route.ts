import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { User } from '@/models/User';
import { Organization } from '@/models/Organization';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const organizationsCollection = db.collection('organizations');

    // Get user data
    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let logoUrl = null;
    let logoSource = null;

    // For business users, try to get logo from organization first
    if (user.userType === 'business' && user.organizationId) {
      const organization = await organizationsCollection.findOne({ _id: user.organizationId });
      
      if (organization) {
        // Check organization logo fields
        if (organization.logo) {
          logoUrl = organization.logo;
          logoSource = 'organization';
        } else if (organization.logoUrl) {
          logoUrl = organization.logoUrl;
          logoSource = 'organization';
        }
      }
    }

    // If no organization logo, check user's service onboarding data
    if (!logoUrl && user.onboarding?.serviceOnboarding?.smartInvoicing?.logo) {
      logoUrl = user.onboarding.serviceOnboarding.smartInvoicing.logo;
      logoSource = 'user_service';
    }

    // If still no logo, check user's profile picture
    if (!logoUrl && user.profilePicture) {
      logoUrl = user.profilePicture;
      logoSource = 'user_profile';
    } else if (!logoUrl && user.avatar) {
      logoUrl = user.avatar;
      logoSource = 'user_avatar';
    }

    return NextResponse.json({ 
      success: true, 
      logoUrl,
      logoSource,
      userType: user.userType,
      hasOrganization: !!user.organizationId
    });

  } catch (error) {
    console.error('Logo retrieval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 