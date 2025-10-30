'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Shield, CheckCircle, XCircle, Clock } from 'lucide-react';
import Image from 'next/image';
import { validateInvitationToken, acceptInvitationForNewUser, completeInvitationAcceptance, declineInvitation } from '@/lib/actions/invitation';
import PermissionMatrix from '@/components/organization/PermissionMatrix';
import { type RoleKey } from '@/lib/utils/roles';
import { type PermissionSet } from '@/models/Organization';

interface InvitationData {
  organizationName: string;
  inviterName: string;
  role: string;
  permissions: PermissionSet;
  email: string;
  expiresAt: Date;
}

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [token, setToken] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  const isInitialized = useRef(false);

  const checkAuthentication = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session');
      const session = await response.json();
      const isAuth = !!session?.user;
      setIsAuthenticated(isAuth);
      console.log('🔐 [Auth Check] Authentication status:', isAuth);
    } catch (error) {
      console.error('Error checking authentication:', error);
      setIsAuthenticated(false);
    }
  }, []);

  const validateInvitation = useCallback(async () => {
    try {
      console.log('🔍 [Invitation Page] Validating invitation with token:', token);
      const result = await validateInvitationToken(token);
      
      console.log('🔍 [Invitation Page] Validation result:', result);
      
      if (result.success && result.data) {
        console.log('✅ [Invitation Page] Invitation data received:', result.data);
        setInvitationData(result.data);
        console.log('📧 [Invitation Page] Invitation validated for:', result.data.email);
      } else {
        console.log('❌ [Invitation Page] Validation failed:', result.error);
        setMessage({ type: 'error', text: result.error || 'Invalid or expired invitation' });
      }
    } catch (error) {
      console.error('❌ [Invitation Page] Error validating invitation:', error);
      setMessage({ type: 'error', text: 'Failed to validate invitation' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const getToken = async () => {
      const resolvedParams = await params;
      setToken(resolvedParams.token);
    };
    getToken();
  }, [params]);

  useEffect(() => {
    if (token && !isInitialized.current) {
      isInitialized.current = true;
      console.log('🚀 [Invitation Page] Initializing with token:', token);
      validateInvitation();
      checkAuthentication();
    }
  }, [token, validateInvitation, checkAuthentication]);


  const handleAcceptInvitation = async () => {
    setAccepting(true);
    try {
      // Always get invitation data first
      const invitationResult = await acceptInvitationForNewUser(token);
      
      if (invitationResult.success && invitationResult.data) {
        // Store invitation data in localStorage for signup page
        localStorage.setItem('invitationData', JSON.stringify({
          token,
          email: invitationResult.data.email,
          organizationName: invitationResult.data.organizationName,
          organizationIndustry: invitationResult.data.organizationIndustry,
          inviterName: invitationResult.data.inviterName,
          role: invitationResult.data.role
        }));
        
        if (isAuthenticated) {
          // User is authenticated - try to complete invitation directly
          try {
            const result = await completeInvitationAcceptance(token);
            if (result.success) {
              setMessage({ type: 'success', text: 'Welcome to the organization! Redirecting to dashboard...' });
              setTimeout(() => {
                router.push('/dashboard');
              }, 2000);
            } else {
              setMessage({ type: 'error', text: result.error || 'Failed to accept invitation' });
            }
          } catch (error) {
            console.log('⚠️ [Invitation] User authenticated but invitation completion failed, redirecting to auth page');
            console.error('❌ [Invitation] Invitation completion error:', error);
            // Redirect to auth page for signup
            router.push('/auth');
            return;
          }
        } else {
          // User not authenticated - redirect to auth page for signup
          router.push('/auth');
          return;
        }
      } else {
        setMessage({ type: 'error', text: invitationResult.error || 'Failed to process invitation' });
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setMessage({ type: 'error', text: 'Failed to accept invitation' });
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineInvitation = async () => {
    setDeclining(true);
    try {
      const result = await declineInvitation(token);

      if (result.success) {
        setMessage({ type: 'success', text: 'Invitation declined. Redirecting to home...' });
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to decline invitation' });
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
      setMessage({ type: 'error', text: 'Failed to decline invitation' });
    } finally {
      setDeclining(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Shield className="h-6 w-6 text-yellow-500" />;
      case 'admin':
        return <Shield className="h-6 w-6 text-blue-500" />;
      case 'financeManager':
        return <Shield className="h-6 w-6 text-green-500" />;
      case 'accountant':
        return <Shield className="h-6 w-6 text-purple-500" />;
      case 'approver':
        return <Shield className="h-6 w-6 text-orange-500" />;
      default:
        return <Shield className="h-6 w-6 text-gray-400" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-600/20 text-yellow-300 border-yellow-500/50';
      case 'admin':
        return 'bg-blue-600/20 text-blue-300 border-blue-500/50';
      case 'financeManager':
        return 'bg-green-600/20 text-green-300 border-green-500/50';
      case 'accountant':
        return 'bg-purple-600/20 text-purple-300 border-purple-500/50';
      case 'approver':
        return 'bg-orange-600/20 text-orange-300 border-orange-500/50';
      default:
        return 'bg-gray-600/20 text-gray-300 border-gray-500/50';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="max-w-md mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-white/20 rounded mb-4"></div>
              <div className="h-4 bg-white/20 rounded mb-6"></div>
              <div className="h-10 bg-white/20 rounded mb-4"></div>
              <div className="h-10 bg-white/20 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!invitationData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="max-w-md mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Invalid Invitation</h1>
            <p className="text-blue-200 mb-6">
              This invitation link is invalid or has expired.
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto w-full">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image
                src="/chains.png"
                alt="ERP Logo"
                width={64}
                height={64}
                className="h-20 w-20  rounded-2xl"
              />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">You&apos;re Invited!</h1>
            <p className="text-blue-200">
              You&apos;ve been invited to join <strong>{invitationData.organizationName}</strong>
            </p>
          </div>

          {/* Authentication Status */}
          {isAuthenticated === false && (
            <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-blue-400" />
                <div>
                  <h3 className="text-blue-200 font-semibold">New User</h3>
                  <p className="text-blue-300 text-sm">
                    You&apos;ll need to create an account to accept this invitation. 
                    Your email is already verified through this invitation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Invitation Details */}
          <div className="bg-white/5 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {getRoleIcon(invitationData.role)}
                <div>
                  <h3 className="text-white font-semibold">Role: {invitationData.role}</h3>
                  <p className="text-blue-200 text-sm">Invited by {invitationData.inviterName}</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full border text-sm flex items-center space-x-1 ${getRoleBadgeColor(invitationData.role)}`}>
                <span className="capitalize">{invitationData.role}</span>
              </div>
            </div>

            <div className="flex items-center space-x-1 text-gray-400 text-sm mb-4">
              <Clock className="h-4 w-4" />
              <span>Expires {new Date(invitationData.expiresAt).toLocaleDateString()}</span>
            </div>

            <div className="flex items-center space-x-1 text-gray-400 text-sm mb-4">
              <Mail className="h-4 w-4" />
              <span>Email: {invitationData.email}</span>
            </div>

            {/* Permissions Preview */}
            <div className="border-t border-white/10 pt-4">
              <button
                onClick={() => setShowPermissions(!showPermissions)}
                className="flex items-center space-x-2 text-blue-300 hover:text-white transition-colors"
              >
                <Shield className="h-4 w-4" />
                <span>{showPermissions ? 'Hide' : 'Show'} Role Permissions</span>
              </button>

              {showPermissions && (
                <div className="mt-4">
                  <PermissionMatrix 
                    role={invitationData.role as RoleKey}
                    permissions={invitationData.permissions}
                    showDetails={true}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-600/20 border border-green-500/50 text-green-200' 
                : 'bg-red-600/20 border border-red-500/50 text-red-200'
            }`}>
              {message.text}
            </div>
          )}


          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={handleAcceptInvitation}
              disabled={accepting || declining}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {accepting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Accepting...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>{!isAuthenticated ? 'Sign Up & Accept' : 'Accept Invitation'}</span>
                </>
              )}
            </button>

            <button
              onClick={handleDeclineInvitation}
              disabled={accepting || declining}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {declining ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Declining...</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  <span>Decline</span>
                </>
              )}
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-gray-400 text-sm">
            <p>By accepting this invitation, you agree to join the organization and follow its policies.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
