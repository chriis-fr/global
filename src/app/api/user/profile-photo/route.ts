import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/services/userService';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// POST /api/user/profile-photo - Upload profile photo (stored in DB, not local disk)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await UserService.getUserByEmail(session.user.email);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('profilePhoto') as File | null;

    if (!file || !file.size) {
      return NextResponse.json(
        { success: false, message: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, message: 'File must be an image' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, message: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const db = await getDatabase();
    const files = db.collection('fileUploads');

    // Remove old DB-stored photo if it exists
    if (user.avatar && user.avatar.startsWith('/api/files/')) {
      const oldId = user.avatar.replace('/api/files/', '');
      if (ObjectId.isValid(oldId)) {
        await files.deleteOne({ _id: new ObjectId(oldId) }).catch(() => {});
      }
    }

    const now = new Date();
    const doc = {
      ownerType: 'profile-photo',
      ownerId: user._id,
      originalName: file.name,
      contentType: file.type,
      size: bytes.length,
      data: bytes,
      createdAt: now,
    };

    const result = await files.insertOne(doc);
    const profilePhotoUrl = `/api/files/${result.insertedId.toString()}`;

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          avatar: profilePhotoUrl,
          profilePhotoUpdatedAt: now,
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({
      success: true,
      data: { profilePhoto: profilePhotoUrl },
      message: 'Profile photo updated successfully',
    });
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to upload profile photo',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/user/profile-photo - Remove profile photo
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await UserService.getUserByEmail(session.user.email);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const db = await getDatabase();

    // Remove the stored file from DB if it was saved there
    if (user.avatar && user.avatar.startsWith('/api/files/')) {
      const oldId = user.avatar.replace('/api/files/', '');
      if (ObjectId.isValid(oldId)) {
        await db
          .collection('fileUploads')
          .deleteOne({ _id: new ObjectId(oldId) })
          .catch(() => {});
      }
    }

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $unset: { avatar: 1 },
        $set: { profilePhotoUpdatedAt: new Date(), updatedAt: new Date() },
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Profile photo removed successfully',
    });
  } catch (error) {
    console.error('Error removing profile photo:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to remove profile photo',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
