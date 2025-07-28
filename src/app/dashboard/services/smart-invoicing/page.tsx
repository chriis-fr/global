'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Plus, 
  FileText, 
  DollarSign, 
  Calendar,
  ArrowRight,
  Building2,
  Users,
  TrendingUp,
  List,
  LayoutDashboard,
  Settings,
  AlertCircle
} from 'lucide-react';
import { Invoice } from '@/models/Invoice';

// Add a local type for invoices with an id
interface InvoiceWithId extends Partial<Invoice> {
  id: number;
}

export default function SmartInvoicingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [invoices] = useState<InvoiceWithId[]>([]);
  const [serviceOnboarding, setServiceOnboarding] = useState<{
    completed?: boolean;
    businessInfo?: Record<string, unknown>;
    invoiceSettings?: Record<string, unknown>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkServiceOnboarding();
  }, [session]);

  const checkServiceOnboarding = async () => {
    try {
      const response = await fetch('/api/onboarding/service?service=smartInvoicing');
      const data = await response.json();
      if (data.success) {
        setServiceOnboarding(data.data.serviceOnboarding);
      }
    } catch (error) {
      console.error('Error checking service onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = () => {
    if (!serviceOnboarding?.completed) {
      router.push('/dashboard/services/smart-invoicing/onboarding');
    } else {
      router.push('/dashboard/services/smart-invoicing/create');
    }
  };

  const handleViewInvoices = () => {
    router.push('/dashboard/services/smart-invoicing/invoices');
  };

  const handleServiceSetup = () => {
    router.push('/dashboard/services/smart-invoicing/onboarding');
  };

  const handleManageClients = () => {
    console.log('👥 [Smart Invoicing] Navigating to client management');
    router.push('/dashboard/clients');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Smart Invoicing</h1>
          <p className="text-blue-200">
            Create, manage, and get paid with both fiat and blockchain payments seamlessly
          </p>
        </div>
        <div className="flex space-x-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleViewInvoices}
            className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors border border-white/20"
          >
            <List className="h-5 w-5" />
            <span>View Invoices</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCreateInvoice}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Create Invoice</span>
          </motion.button>
        </div>
      </div>

      {/* Service Onboarding Check */}
      {!loading && !serviceOnboarding?.completed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-600/20 border border-yellow-500/50 rounded-xl p-6"
        >
          <div className="flex items-start space-x-4">
            <AlertCircle className="h-6 w-6 text-yellow-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-100 mb-2">
                Service Setup Required
              </h3>
              <p className="text-yellow-200 mb-4">
                Before you can create invoices, you need to configure your business information and invoice settings.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleServiceSetup}
                className="flex items-center space-x-2 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
              >
                <Settings className="h-4 w-4" />
                <span>Complete Setup</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Total Invoices</p>
              <p className="text-2xl font-bold text-white">{invoices.length}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-400" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-white">
                ${invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0).toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-400" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Pending</p>
              <p className="text-2xl font-bold text-white">
                {invoices.filter(inv => inv.status === 'draft').length}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-yellow-400" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Paid</p>
              <p className="text-2xl font-bold text-white">
                {invoices.filter(inv => inv.status === 'paid').length}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-400" />
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
          onClick={handleCreateInvoice}
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Plus className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Create New Invoice</h3>
              <p className="text-blue-200 text-sm">Start with our guided walkthrough</p>
            </div>
            <ArrowRight className="h-5 w-5 text-blue-400 ml-auto" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
          onClick={handleManageClients}
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Manage Clients</h3>
              <p className="text-blue-200 text-sm">Add and organize your clients</p>
            </div>
            <ArrowRight className="h-5 w-5 text-blue-400 ml-auto" />
          </div>
        </motion.div>

        {/* Only show Team Settings for business users with organizations */}
        {session?.user?.userType === 'business' && session?.user?.organizationId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
            onClick={() => router.push('/dashboard/settings/organization')}
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Team Settings</h3>
                <p className="text-blue-200 text-sm">Configure team permissions</p>
              </div>
              <ArrowRight className="h-5 w-5 text-blue-400 ml-auto" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Recent Invoices */}
      {invoices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20"
        >
          <div className="p-6 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">Recent Invoices</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {invoices.slice(0, 5).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <FileText className="h-5 w-5 text-blue-400" />
                    <div>
                      <p className="text-white font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-blue-200 text-sm">{invoice.clientDetails?.companyName || 'Client'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">${invoice.totalAmount?.toLocaleString()}</p>
                    <p className="text-blue-200 text-sm">{invoice.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {invoices.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-12 border border-white/20 text-center"
        >
          <FileText className="h-16 w-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No invoices yet</h3>
          <p className="text-blue-200 mb-6">
            Create your first invoice to get started with our comprehensive invoicing system.
          </p>
          <button
            onClick={handleCreateInvoice}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors mx-auto"
          >
            <Plus className="h-5 w-5" />
            <span>Create Your First Invoice</span>
          </button>
        </motion.div>
      )}

      {/* Floating Dashboard Button */}
      <Link
        href="/dashboard"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 hover:scale-110"
      >
        <LayoutDashboard className="h-6 w-6" />
      </Link>
    </div>
  );
} 