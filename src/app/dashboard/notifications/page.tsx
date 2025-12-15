'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  Bell, 
  Check, 
  Trash2, 
  Search,
  Eye,
  EyeOff,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
  Mail,
  Settings,
  LayoutDashboard
} from 'lucide-react';
import { Notification, NotificationType, NotificationPriority, NotificationStatus } from '@/models/Notification';
import { formatDateTimeReadable } from '@/lib/utils/dateFormat';

interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
  byStatus: Record<NotificationStatus, number>;
}

export default function NotificationsPage() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unread: 0,
    read: 0,
    byType: {} as Record<NotificationType, number>,
    byPriority: {} as Record<NotificationPriority, number>,
    byStatus: {} as Record<NotificationStatus, number>
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<NotificationPriority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<NotificationStatus | 'all'>('all');

  const loadNotifications = useCallback(async () => {
    if (!session?.user) return;

    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await fetch(`/api/notifications?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.data.notifications);
        setStats(data.data.stats);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [session?.user, searchTerm, typeFilter, priorityFilter, statusFilter]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        // Update local state
        setNotifications(prev => 
          prev.map(notification => 
            notification._id?.toString() === notificationId 
              ? { ...notification, status: 'read' as NotificationStatus, readAt: new Date() }
              : notification
          )
        );
        
        // Reload stats
        loadNotifications();
      }
    } catch {
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;
    
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Remove from local state
        setNotifications(prev => 
          prev.filter(notification => notification._id?.toString() !== notificationId)
        );
        
        // Reload stats
        loadNotifications();
      }
    } catch {
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT'
      });
      
      if (response.ok) {
        // Update all notifications to read
        setNotifications(prev => 
          prev.map(notification => ({
            ...notification,
            status: 'read' as NotificationStatus,
            readAt: new Date()
          }))
        );
        
        // Reload stats
        loadNotifications();
      }
    } catch {
    }
  };

  const handleCreateTestNotification = async () => {
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST'
      });
      
      if (response.ok) {
        // Reload notifications
        loadNotifications();
        alert('Test notification created successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to create test notification: ${error.message}`);
      }
    } catch {
      alert('Failed to create test notification');
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'invoice_created':
      case 'invoice_paid':
      case 'invoice_overdue':
        return <Mail className="h-5 w-5" />;
      case 'payment_received':
      case 'payment_failed':
        return <CheckCircle className="h-5 w-5" />;
      case 'system_update':
        return <Info className="h-5 w-5" />;
      case 'security_alert':
        return <AlertCircle className="h-5 w-5" />;
      case 'reminder':
        return <Clock className="h-5 w-5" />;
      case 'approval_request':
      case 'approval_status':
        return <Check className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: NotificationPriority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: NotificationStatus) => {
    switch (status) {
      case 'unread':
        return 'bg-blue-100 text-blue-800';
      case 'read':
        return 'bg-gray-100 text-gray-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'sent':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Use consistent date formatting utility to avoid hydration mismatches
  const formatDate = formatDateTimeReadable;

  const filteredNotifications = notifications.filter(notification => {
    if (typeFilter !== 'all' && notification.type !== typeFilter) return false;
    if (priorityFilter !== 'all' && notification.priority !== priorityFilter) return false;
    if (statusFilter !== 'all' && notification.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Notifications</h1>
          <p className="text-blue-200">Stay updated with your latest activities and alerts</p>
        </div>
        <div className="flex space-x-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCreateTestNotification}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span>Test Notification</span>
          </motion.button>
          {stats.unread > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleMarkAllAsRead}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Check className="h-4 w-4" />
              <span>Mark All Read</span>
            </motion.button>
          )}
          <Link
            href="/dashboard/settings/notifications"
            className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors border border-white/20"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Total</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-500/20 rounded-lg">
              <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Unread</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{stats.unread}</p>
            </div>
            <div className="p-2 sm:p-3 bg-yellow-500/20 rounded-lg">
              <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Read</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{stats.read}</p>
            </div>
            <div className="p-2 sm:p-3 bg-green-500/20 rounded-lg">
              <EyeOff className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">High Priority</p>
              <p className="text-xl sm:text-2xl font-bold text-white">
                {(stats.byPriority.high || 0) + (stats.byPriority.urgent || 0)}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-red-500/20 rounded-lg">
              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-400" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black placeholder-gray-600 font-medium"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as NotificationType | 'all')}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
          >
            <option value="all">All Types</option>
            <option value="invoice_created">Invoice Created</option>
            <option value="invoice_paid">Invoice Paid</option>
            <option value="invoice_overdue">Invoice Overdue</option>
            <option value="payment_received">Payment Received</option>
            <option value="payment_failed">Payment Failed</option>
            <option value="system_update">System Update</option>
            <option value="security_alert">Security Alert</option>
            <option value="reminder">Reminder</option>
            <option value="approval_request">Approval Request</option>
            <option value="approval_status">Approval Status</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as NotificationPriority | 'all')}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as NotificationStatus | 'all')}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
          >
            <option value="all">All Status</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
          </select>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              <span className="text-white text-lg">Loading notifications...</span>
            </div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="h-16 w-16 text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No notifications found</h3>
            <p className="text-blue-200 mb-6">
              {searchTerm || typeFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'You\'re all caught up! No new notifications.'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredNotifications.map((notification, index) => (
              <motion.div
                key={notification._id?.toString() || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 sm:p-6 hover:bg-white/5 transition-colors ${
                  notification.status === 'unread' ? 'bg-white/5' : ''
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      {getNotificationIcon(notification.type)}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {notification.title}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getPriorityColor(notification.priority)}`}>
                          {notification.priority}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(notification.status)}`}>
                          {notification.status}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-blue-200 mb-3 line-clamp-2">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm text-blue-200">
                        <span>{formatDate(notification.createdAt.toString())}</span>
                        {notification.actionUrl && (
                          <Link
                            href={notification.actionUrl}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            View Details
                          </Link>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {notification.status === 'unread' && (
                          <button
                            onClick={() => handleMarkAsRead(notification._id?.toString() || '')}
                            className="text-blue-400 hover:text-blue-300 transition-colors p-2 rounded-lg hover:bg-white/10"
                            title="Mark as read"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteNotification(notification._id?.toString() || '')}
                          className="text-red-400 hover:text-red-300 transition-colors p-2 rounded-lg hover:bg-white/10"
                          title="Delete notification"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Dashboard Button */}
      <Link
        href="/dashboard"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-blue-600/80 backdrop-blur-sm text-white rounded-full shadow-lg hover:bg-blue-700/90 transition-all duration-300 hover:scale-110"
      >
        <LayoutDashboard className="h-6 w-6" />
      </Link>
    </div>
  );
} 