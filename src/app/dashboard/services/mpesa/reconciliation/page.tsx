import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { OrganizationService } from '@/lib/services/organizationService';
import SimpleReconciliationPage from '@/components/mpesa/SimpleReconciliationPage';

export default async function ReconciliationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth');

  const organizationId = session.user.organizationId as string | undefined;
  if (!organizationId) redirect('/dashboard');

  const org = await OrganizationService.getOrganizationById(organizationId);
  if (!org?._id) notFound();

  const mpesaEnabled = org.settings?.mpesa?.enabled === true;
  if (!mpesaEnabled) notFound();

  const member = org.members.find((m) => m.userId.toString() === session.user.id);
  const role = member?.role ?? null;
  const isSuperAdmin = (session.user as { adminTag?: boolean }).adminTag === true;
  if (!isSuperAdmin && role !== 'owner' && role !== 'admin') notFound();

  return <SimpleReconciliationPage />;
}
