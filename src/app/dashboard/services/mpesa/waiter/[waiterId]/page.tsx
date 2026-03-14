import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { OrganizationService } from '@/lib/services/organizationService';
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Receipt,
} from 'lucide-react';

interface WaiterDetailPageProps {
  params: Promise<{ waiterId: string }>;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function WaiterDetailPage({ params }: WaiterDetailPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth');

  const organizationId = session.user.organizationId as string | undefined;
  if (!organizationId) redirect('/dashboard');

  const { waiterId } = await params;
  if (!waiterId) notFound();

  const org = await OrganizationService.getOrganizationById(organizationId);
  if (!org?._id) notFound();

  const mpesaEnabled = org.settings?.mpesa?.enabled === true;
  if (!mpesaEnabled) notFound();

  const member = org.members.find((m) => m.userId.toString() === session.user.id);
  const role = member?.role ?? null;
  if (role !== 'owner' && role !== 'admin') notFound();

  const waiterMember = org.members.find((m) => m.userId.toString() === waiterId);
  if (!waiterMember || waiterMember.role !== 'waiter') notFound();

  const db = await connectToDatabase();
  const users = db.collection('users');
  const sessionsCol = db.collection('mpesa_stk_sessions');

  const waiterUser = await users.findOne(
    { _id: new ObjectId(waiterId) },
    { projection: { name: 1, email: 1 } }
  );
  if (!waiterUser) notFound();

  const orgObjectId = new ObjectId(organizationId);
  const waiterObjectId = new ObjectId(waiterId);
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const allSessions = await sessionsCol
    .find({
      organizationId: orgObjectId,
      waiterUserId: waiterObjectId,
    })
    .sort({ createdAt: -1 })
    .toArray();

  const successfulSessions = allSessions.filter((s) => s.status === 'success');
  const totalAmount = (s: { amount?: number }[]) =>
    s.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);

  const inRange = (createdAt: Date, start: Date) => new Date(createdAt) >= start;

  const todaySessions = successfulSessions.filter((s) =>
    inRange(s.createdAt as Date, todayStart)
  );
  const weekSessions = successfulSessions.filter((s) =>
    inRange(s.createdAt as Date, weekStart)
  );
  const monthSessions = successfulSessions.filter((s) =>
    inRange(s.createdAt as Date, monthStart)
  );

  const todayAmount = totalAmount(todaySessions);
  const weekAmount = totalAmount(weekSessions);
  const monthAmount = totalAmount(monthSessions);
  const allTimeAmount = totalAmount(successfulSessions);

  const todayCount = todaySessions.length;
  const weekCount = weekSessions.length;
  const monthCount = monthSessions.length;
  const allTimeCount = successfulSessions.length;

  const waiterName = (waiterUser.name as string) || 'Waiter';
  const waiterEmail = (waiterUser.email as string) || '';

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
        <Link
          href="/dashboard/services/mpesa"
          className="inline-flex items-center gap-2 text-blue-200 hover:text-white text-sm font-medium mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to M-Pesa
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/20">
              <User className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">{waiterName}</h1>
              {waiterEmail && (
                <div className="flex items-center gap-2 text-blue-200 text-sm mt-0.5">
                  <Mail className="h-4 w-4" />
                  {waiterEmail}
                </div>
              )}
              <p className="text-xs text-blue-300 mt-1">Waiter · Collections are read-only</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
          <div className="flex items-center gap-2 text-blue-200 text-sm mb-1">
            <Calendar className="h-4 w-4" />
            Today
          </div>
          <p className="text-2xl font-semibold text-white">
            KES {todayAmount.toLocaleString()}
          </p>
          <p className="text-xs text-blue-300">{todayCount} successful</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
          <div className="flex items-center gap-2 text-blue-200 text-sm mb-1">
            <Calendar className="h-4 w-4" />
            This week
          </div>
          <p className="text-2xl font-semibold text-white">
            KES {weekAmount.toLocaleString()}
          </p>
          <p className="text-xs text-blue-300">{weekCount} successful</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
          <div className="flex items-center gap-2 text-blue-200 text-sm mb-1">
            <Calendar className="h-4 w-4" />
            This month
          </div>
          <p className="text-2xl font-semibold text-white">
            KES {monthAmount.toLocaleString()}
          </p>
          <p className="text-xs text-blue-300">{monthCount} successful</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
          <div className="flex items-center gap-2 text-blue-200 text-sm mb-1">
            <Receipt className="h-4 w-4" />
            All time
          </div>
          <p className="text-2xl font-semibold text-white">
            KES {allTimeAmount.toLocaleString()}
          </p>
          <p className="text-xs text-blue-300">{allTimeCount} successful</p>
        </div>
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-300" />
            Collections (saved, read-only)
          </h2>
          <p className="text-xs text-blue-200">
            {allSessions.length} prompt{allSessions.length !== 1 ? 's' : ''} total
          </p>
        </div>

        {allSessions.length === 0 ? (
          <p className="text-sm text-blue-200">No M-Pesa prompts recorded for this waiter yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-blue-200 border-b border-white/10">
                  <th className="py-2 pr-4 text-left font-medium">Date / Time</th>
                  <th className="py-2 px-4 text-left font-medium">Amount (KES)</th>
                  <th className="py-2 px-4 text-left font-medium">Status</th>
                  <th className="py-2 px-4 text-left font-medium">Phone</th>
                  <th className="py-2 px-4 text-left font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {allSessions.map((s) => {
                  const createdAt = s.createdAt as Date;
                  const isSuccess = s.status === 'success';
                  return (
                    <tr key={(s._id as ObjectId).toString()} className="border-b border-white/5">
                      <td className="py-2 pr-4 text-blue-100">
                        {createdAt
                          ? createdAt.toLocaleString(undefined, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </td>
                      <td className="py-2 px-4 text-blue-100 font-medium">
                        {Number(s.amount ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-4">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300">
                            <CheckCircle className="h-4 w-4" />
                            Success
                          </span>
                        ) : s.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 text-red-300">
                            <XCircle className="h-4 w-4" />
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-300">
                            <Clock className="h-4 w-4" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-blue-100 font-mono text-xs">
                        {(s.phoneNumber as string) || '—'}
                      </td>
                      <td className="py-2 px-4 text-blue-100 font-mono text-xs">
                        {(s.mpesaReceiptNumber as string) || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
