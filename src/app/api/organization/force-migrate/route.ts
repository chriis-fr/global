// MIGRATION ENDPOINT - COMMENTED OUT (No longer needed)
// All existing organizations have been migrated, new organizations use proper structure

// import { NextResponse } from 'next/server';
// import { getServerSession } from 'next-auth';
// import { authOptions } from '@/lib/auth';
// import { OrganizationService } from '@/lib/services/organizationService';
// import { UserService } from '@/lib/services/userService';

// POST /api/organization/force-migrate - Force migrate organization members
// export async function POST() {
//   try {
//     const session = await getServerSession(authOptions);
//     
//     if (!session?.user?.email) {
//       return NextResponse.json(
//         { success: false, message: 'Unauthorized' },
//         { status: 401 }
//       );
//     }

//     const user = await UserService.getUserByEmail(session.user.email);
//     
//     if (!user || !user.organizationId) {
//       return NextResponse.json(
//         { success: false, message: 'User does not belong to an organization' },
//         { status: 400 }
//       );
//     }

//     console.log('🔄 [Force Migration] Starting migration for organization:', user.organizationId.toString());

//     // Force migrate organization members
//     const migratedOrganization = await OrganizationService.migrateOrganizationMembers(user.organizationId.toString());
//     
//     if (!migratedOrganization) {
//       return NextResponse.json(
//         { success: false, message: 'Failed to migrate organization members' },
//         { status: 500 }
//       );
//     }

//     console.log('✅ [Force Migration] Migration completed successfully');

//     return NextResponse.json({
//       success: true,
//       message: 'Organization members migrated successfully',
//       data: {
//         organizationId: migratedOrganization._id?.toString(),
//         memberCount: migratedOrganization.members.length,
//         members: migratedOrganization.members.map(member => ({
//           userId: member.userId.toString(),
//           role: member.role,
//           email: member.email,
//           name: member.name,
//           hasJoinedAt: !!member.joinedAt,
//           hasPermissions: !!member.permissions
//         }))
//       },
//       timestamp: new Date().toISOString()
//     });
//   } catch (error) {
//     console.error('Error force migrating organization members:', error);
//     return NextResponse.json(
//       { 
//         success: false, 
//         message: 'Failed to migrate organization members',
//         error: error instanceof Error ? error.message : 'Unknown error'
//       },
//       { status: 500 }
//     );
//   }
// }
