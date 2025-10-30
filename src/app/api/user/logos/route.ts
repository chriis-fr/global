import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';

// GET /api/user/logos - Get all logos for the user
export async function GET() {
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

    let logos: Array<{
      id: string;
      name: string;
      url: string;
      isDefault: boolean;
      createdAt: Date;
    }> = [];

    // For business users, try to get logos from organization first
    if (user.userType === 'business' && user.organizationId) {
      const organization = await organizationsCollection.findOne({ _id: user.organizationId });
      
      if (organization && organization.logos) {
        logos = organization.logos;
      }
    }

    // For individual users or if no organization logos, get from user
    if (logos.length === 0 && user.logos) {
      logos = user.logos;
    }

    return NextResponse.json({ 
      success: true, 
      logos,
      userType: user.userType,
      hasOrganization: !!user.organizationId
    });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/user/logos - Add a new logo
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, url, isDefault = false } = await request.json();
    
    if (!name || !url) {
      return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const organizationsCollection = db.collection('organizations');

    // Get user data
    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const newLogo = {
      id: Date.now().toString(),
      name,
      url,
      isDefault,
      createdAt: new Date()
    };

    // For business users with organization, save to organization
    if (user.userType === 'business' && user.organizationId) {
      const organization = await organizationsCollection.findOne({ _id: user.organizationId });
      
      if (!organization) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      const currentLogos = organization.logos || [];
      
      // If this is the default logo, unset other defaults
      if (isDefault) {
        currentLogos.forEach((logo: { isDefault: boolean }) => logo.isDefault = false);
      }

      const updatedLogos = [...currentLogos, newLogo];

      const result = await organizationsCollection.updateOne(
        { _id: user.organizationId },
        { 
          $set: { 
            logos: updatedLogos,
            updatedAt: new Date()
          } 
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Logo added to organization',
        logo: newLogo
      });
    }

    // For individual users, save to user
    const currentLogos = user.logos || [];
    
    // If this is the default logo, unset other defaults
    if (isDefault) {
      currentLogos.forEach((logo: { isDefault: boolean }) => logo.isDefault = false);
    }

    const updatedLogos = [...currentLogos, newLogo];

    const updateResult = await usersCollection.updateOne(
      { email: session.user.email },
      { 
        $set: { 
          logos: updatedLogos,
          updatedAt: new Date()
        } 
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Logo added to user',
      logo: newLogo
    });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/user/logos - Update a logo
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, name, isDefault } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Logo ID is required' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const organizationsCollection = db.collection('organizations');

    // Get user data
    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // For business users with organization, update in organization
    if (user.userType === 'business' && user.organizationId) {
      const organization = await organizationsCollection.findOne({ _id: user.organizationId });
      
      if (!organization) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      const currentLogos = organization.logos || [];
      const logoIndex = currentLogos.findIndex((logo: { id: string }) => logo.id === id);
      
      if (logoIndex === -1) {
        return NextResponse.json({ error: 'Logo not found' }, { status: 404 });
      }

          // If this is the default logo, unset other defaults
    if (isDefault) {
      currentLogos.forEach((logo: { isDefault: boolean }) => logo.isDefault = false);
    }

    currentLogos[logoIndex] = {
        ...currentLogos[logoIndex],
        name: name || currentLogos[logoIndex].name,
        isDefault: isDefault !== undefined ? isDefault : currentLogos[logoIndex].isDefault
      };

      const result = await organizationsCollection.updateOne(
        { _id: user.organizationId },
        { 
          $set: { 
            logos: currentLogos,
            updatedAt: new Date()
          } 
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Logo updated in organization',
        logo: currentLogos[logoIndex]
      });
    }

    // For individual users, update in user
    const currentLogos = user.logos || [];
    const logoIndex = currentLogos.findIndex((logo: { id: string }) => logo.id === id);
    
    if (logoIndex === -1) {
      return NextResponse.json({ error: 'Logo not found' }, { status: 404 });
    }

    // If this is the default logo, unset other defaults
    if (isDefault) {
      currentLogos.forEach((logo: { isDefault: boolean }) => logo.isDefault = false);
    }

    currentLogos[logoIndex] = {
      ...currentLogos[logoIndex],
      name: name || currentLogos[logoIndex].name,
      isDefault: isDefault !== undefined ? isDefault : currentLogos[logoIndex].isDefault
    };

    const updateResult = await usersCollection.updateOne(
      { email: session.user.email },
      { 
        $set: { 
          logos: currentLogos,
          updatedAt: new Date()
        } 
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Logo updated in user',
      logo: currentLogos[logoIndex]
    });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/user/logos - Delete a logo
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Logo ID is required' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const organizationsCollection = db.collection('organizations');

    // Get user data
    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // For business users with organization, delete from organization
    if (user.userType === 'business' && user.organizationId) {
      const organization = await organizationsCollection.findOne({ _id: user.organizationId });
      
      if (!organization) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      const currentLogos = organization.logos || [];
      const updatedLogos = currentLogos.filter((logo: { id: string }) => logo.id !== id);
      
      if (updatedLogos.length === currentLogos.length) {
        return NextResponse.json({ error: 'Logo not found' }, { status: 404 });
      }

      const result = await organizationsCollection.updateOne(
        { _id: user.organizationId },
        { 
          $set: { 
            logos: updatedLogos,
            updatedAt: new Date()
          } 
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Logo deleted from organization'
      });
    }

    // For individual users, delete from user
    const currentLogos = user.logos || [];
    const updatedLogos = currentLogos.filter((logo: { id: string }) => logo.id !== id);
    
    if (updatedLogos.length === currentLogos.length) {
      return NextResponse.json({ error: 'Logo not found' }, { status: 404 });
    }

    const updateResult = await usersCollection.updateOne(
      { email: session.user.email },
      { 
        $set: { 
          logos: updatedLogos,
          updatedAt: new Date()
        } 
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Logo deleted from user'
    });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 