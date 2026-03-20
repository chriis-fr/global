import { redirect } from 'next/navigation';

/**
 * No list at /waiter — redirect to M-Pesa so breadcrumbs and links never 404.
 */
export default function MpesaWaiterIndexPage() {
  redirect('/dashboard/services/mpesa');
}
