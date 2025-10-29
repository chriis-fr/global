import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';

interface Logo {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
  createdAt: Date;
}

// GET /api/user/logo - Get user's logos
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get logos from user's settings
    const logos = user.logos || [];
    const defaultLogo = logos.find((logo: Logo) => logo.isDefault) || logos[0] || null;
    
    return NextResponse.json({ 
      success: true, 
      logos,
      defaultLogo,
      logoUrl: defaultLogo?.url || null,
      logoSource: defaultLogo ? 'user_logos' : null
    });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/user/logo - Add a new logo
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

    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const newLogo: Logo = {
      id: Date.now().toString(),
      name,
      url,
      isDefault,
      createdAt: new Date()
    };

    const currentLogos: Logo[] = user.logos || [];
    
    // If this is the default logo, unset other defaults
    if (isDefault) {
      currentLogos.forEach((logo: Logo) => logo.isDefault = false);
    }

    const updatedLogos = [...currentLogos, newLogo];

    const result = await usersCollection.updateOne(
      { email: session.user.email },
      { 
        $set: { 
          logos: updatedLogos,
          updatedAt: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Logo added successfully',
      logo: newLogo
    });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/user/logo - Update a logo
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

    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentLogos: Logo[] = user.logos || [];
    const logoIndex = currentLogos.findIndex((logo: Logo) => logo.id === id);
    
    if (logoIndex === -1) {
      return NextResponse.json({ error: 'Logo not found' }, { status: 404 });
    }

    // If this is the default logo, unset other defaults
    if (isDefault) {
      currentLogos.forEach((logo: Logo) => logo.isDefault = false);
    }

    currentLogos[logoIndex] = {
      ...currentLogos[logoIndex],
      name: name || currentLogos[logoIndex].name,
      isDefault: isDefault !== undefined ? isDefault : currentLogos[logoIndex].isDefault
    };

    const result = await usersCollection.updateOne(
      { email: session.user.email },
      { 
        $set: { 
          logos: currentLogos,
          updatedAt: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Logo updated successfully',
      logo: currentLogos[logoIndex]
    });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/user/logo - Delete a logo
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

    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentLogos: Logo[] = user.logos || [];
    const updatedLogos = currentLogos.filter((logo: Logo) => logo.id !== id);
    
    if (updatedLogos.length === currentLogos.length) {
      return NextResponse.json({ error: 'Logo not found' }, { status: 404 });
    }

    const result = await usersCollection.updateOne(
      { email: session.user.email },
      { 
        $set: { 
          logos: updatedLogos,
          updatedAt: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Logo deleted successfully'
    });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 