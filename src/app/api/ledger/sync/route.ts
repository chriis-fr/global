import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { LedgerSyncService } from '@/lib/services/ledgerSyncService';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }


    // Sync all existing invoices and payables to the ledger
    const result = await LedgerSyncService.syncAllExistingData();


    return NextResponse.json({
      success: true,
      message: 'Data sync completed successfully',
      data: result
    });

  } catch (error) {
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to sync data',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
