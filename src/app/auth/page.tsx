'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff,
  Building,
  Building2,
  UserCheck,
  Shield,
  ChevronDown,
  Receipt,
  ArrowLeft
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { countries, defaultCountry } from '@/data/countries'
import { getIndustriesByCategory, getIndustryCategories } from '@/data/industries'
import { useOnboardingStore } from '@/lib/stores/onboardingStore'

function AuthContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const { setOnboarding } = useOnboardingStore()
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '', // Person's actual name
    companyName: '', // Business/organization name
    userType: 'individual' as 'individual' | 'business',
    phone: '',
    industry: '',
    address: {
      street: '',
      city: '',
      country: defaultCountry.code,
      postalCode: ''
    },
    taxId: '',
    agreeToTerms: false
  })

  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false)
  const [industryCategories] = useState(getIndustryCategories())
  const [countrySearch, setCountrySearch] = useState('')
  const [isEmailLocked, setIsEmailLocked] = useState(false)

  // Handle invoice token from URL
  useEffect(() => {
    const invoiceToken = searchParams.get('invoiceToken')
    const email = searchParams.get('email')
    
    if (invoiceToken && email) {
      // Pre-fill email and switch to signup mode
      setFormData(prev => ({
        ...prev,
        email: decodeURIComponent(email)
      }))
      setIsLogin(false) // Switch to signup mode
      setIsEmailLocked(true) // Lock the email field
    }
  }, [searchParams])

  // Handle invitation data from localStorage
  useEffect(() => {
    const invitationData = localStorage.getItem('invitationData')
    
    if (invitationData) {
      try {
        const data = JSON.parse(invitationData)
        console.log('📧 [Auth] Invitation data found:', data)
        
        // Pre-fill all organization data since they're joining an existing company
        setFormData(prev => ({
          ...prev,
          email: data.email,
          userType: 'business', // Invitations are for business accounts
          companyName: data.organizationName, // Pre-fill with organization name
          industry: data.organizationIndustry || '', // Pre-fill with organization industry if available
          // Keep other fields empty for user to fill
          fullName: '', // User needs to enter their full name
          phone: '',
          address: {
            street: '',
            city: '',
            country: defaultCountry.code,
            postalCode: ''
          },
          taxId: ''
        }))
        setIsLogin(false) // Switch to signup mode
        setIsEmailLocked(true) // Lock the email field
        
        console.log('✅ [Auth] Pre-filled form with organization invitation data:', {
          email: data.email,
          companyName: data.organizationName,
          industry: data.organizationIndustry
        })
      } catch (error) {
        console.error('❌ [Auth] Error parsing invitation data:', error)
        localStorage.removeItem('invitationData') // Clean up invalid data
      }
    }
  }, [])

  // Helper function to format phone number
  const formatPhoneNumber = (phone: string, countryCode: string) => {
    const country = countries.find(c => c.code === countryCode)
    if (!country || !phone) return phone

    // Remove any existing country code
    const cleanPhone = phone.replace(/^\+?\d+\s?/, '')
    
    // Format with country code (no space)
    return country.phoneCode + cleanPhone
  }

  // Clean phone number for database storage
  const cleanPhoneNumber = (phone: string) => {
    if (!phone) return phone
    
    // Remove all spaces and ensure proper format
    const cleaned = phone.replace(/\s+/g, '')
    console.log('📞 [Auth] Phone number cleaned:', { original: phone, cleaned })
    return cleaned
  }

  // Close dropdowns when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Element
    if (!target.closest('.dropdown-container')) {
      setShowIndustryDropdown(false)
      setCountrySearch('')
    }
  }

  // Add click outside listener
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Auto-select country based on phone code
    if (name === 'phone') {
      // Handle different phone number formats
      let phoneCode = ''
      
      if (value.startsWith('+')) {
        // Format: +254123456789
        phoneCode = value.match(/^\+\d+/)?.[0] || ''
      } else if (value.includes(' ')) {
        // Format: +254 123456789
        phoneCode = value.split(' ')[0]
      } else if (value.match(/^\d{1,4}/)) {
        // Format: 254123456789 (without +)
        const codeMatch = value.match(/^(\d{1,4})/)
        if (codeMatch) {
          phoneCode = '+' + codeMatch[1]
        }
      }
      
      if (phoneCode) {
        const matchingCountry = countries.find(country => country.phoneCode === phoneCode)
        if (matchingCountry) {
          console.log('📞 [Auth] Auto-selecting country based on phone code:', matchingCountry.name)
          handleAddressChange('country', matchingCountry.code)
        }
      }
    }
  }

  const handleAddressChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value
      }
    }))

    // If country changed, update phone number format if it exists
    if (field === 'country' && formData.phone) {
      const newCountry = countries.find(c => c.code === value)
      const currentCountry = countries.find(c => c.code === formData.address.country)
      
      if (newCountry && currentCountry && newCountry.phoneCode !== currentCountry.phoneCode) {
        // Format phone number with new country code
        const newPhoneNumber = formatPhoneNumber(formData.phone, value)
        setFormData(prev => ({
          ...prev,
          phone: newPhoneNumber
        }))
        console.log('📞 [Auth] Updated phone number format for new country:', newPhoneNumber)
      }
    }
  }

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Handle Google sign in
  const handleGoogleSignIn = async () => {
    console.log('🔐 [Auth] Initiating Google sign-in...')
    setLoading(true)
    setError('')
    
    try {
      const result = await signIn('google', { 
        callbackUrl: '/onboarding',
        redirect: false 
      })
      
      if (result?.error) {
        console.error('❌ [Auth] Google sign-in error:', result.error)
        setError('Google sign-in failed. Please try again.')
      } else if (result?.ok) {
        console.log('✅ [Auth] Google sign-in successful, redirecting...')
        // Session will be updated automatically, redirect will happen via useEffect
        // The useEffect will check session data and redirect appropriately
        // No need to manually redirect here - let useEffect handle it
      }
    } catch (error) {
      console.error('❌ [Auth] Google sign-in error:', error)
      setError('An error occurred during Google sign-in.')
    } finally {
      setLoading(false)
    }
  }

  // Redirect if already authenticated - use session data (no API call needed)
  useEffect(() => {
    if (status === 'authenticated' && session) {
      // Use onboarding data from session (already fetched during login)
      // Consider completed if: completed === true OR currentStep === 4 (final step)
      const isCompleted = session.user?.onboarding?.completed || session.user?.onboarding?.currentStep === 4
      
      // Initialize Zustand store from session immediately
      if (session.user?.onboarding && session.user?.services) {
        setOnboarding(
          {
            completed: isCompleted,
            currentStep: session.user.onboarding.currentStep || 1,
            completedSteps: session.user.onboarding.completedSteps || [],
            serviceOnboarding: session.user.onboarding.serviceOnboarding || {}
          },
          session.user.services as Record<string, boolean>
        )
      }
      
      if (isCompleted) {
        window.location.href = '/dashboard'
      } else {
        window.location.href = '/onboarding'
      }
    }
  }, [session, status, setOnboarding])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🚀 [Auth] Form submitted, mode:', isLogin ? 'login' : 'signup')
    console.log('📋 [Auth] Form data:', {
      email: formData.email,
      name: formData.fullName,
      userType: formData.userType,
      hasPassword: !!formData.password,
      hasAddress: !!formData.address
    })
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        // Handle login using NextAuth credentials
        console.log('🔐 [Auth] Attempting login with credentials...')
        const loginResult = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false
        })
        
        if (loginResult?.error) {
          console.error('❌ [Auth] Login failed:', loginResult.error)
          setError('Invalid email or password')
        } else if (loginResult?.ok) {
          console.log('✅ [Auth] Login successful, redirecting...')
          // Session will be updated automatically, redirect will happen via useEffect
          // The useEffect will check session data and redirect appropriately
          // No need to manually redirect here - let useEffect handle it
        }
      } else {
        // Handle signup
        console.log('📝 [Auth] Preparing signup data...')
        
        // Validate terms agreement
        if (!formData.agreeToTerms) {
          setError('You must agree to the Terms of Service and Privacy Policy to continue.')
          setLoading(false)
          return
        }
        
        // Check if this is an organization invitation
        const isInvitationSignup = !!!!localStorage.getItem('invitationData')
        
        const signupData = {
          email: formData.email,
          password: formData.password,
          name: formData.fullName, // Always use the person's full name
          companyName: formData.companyName, // Business name (for business users)
          userType: formData.userType,
          phone: cleanPhoneNumber(formData.phone),
          industry: formData.industry,
          address: formData.address,
          taxId: formData.taxId,
          termsAgreement: {
            agreed: true,
            agreedAt: new Date(),
            termsVersion: '1.0'
          },
          // Add invitation flag if this is an organization invitation
          isInvitationSignup
        }
        console.log('📤 [Auth] Sending signup request with data:', {
          email: signupData.email,
          name: signupData.name,
          userType: signupData.userType,
          phone: signupData.phone,
          hasPassword: !!signupData.password,
          hasAddress: !!signupData.address
        })

        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(signupData),
        })

        console.log('📥 [Auth] Received signup response, status:', response.status)
        const data = await response.json()
        console.log('📋 [Auth] Response data:', data)
        
        if (data.success) {
          console.log('✅ [Auth] Signup successful, attempting automatic login...')
          
          // Automatically log in the user using NextAuth credentials
          if (data.autoLogin) {
            try {
              console.log('🔐 [Auth] Initiating automatic login with credentials...')
              const loginResult = await signIn('credentials', {
                email: data.autoLogin.email,
                password: data.autoLogin.password,
                redirect: false
              })
              
              if (loginResult?.error) {
                console.error('❌ [Auth] Automatic login failed:', loginResult.error)
                // Fallback: store user data and redirect anyway
                localStorage.setItem('user', JSON.stringify(data.data))
                // If this was an organization invitation, go to dashboard
                if (!!localStorage.getItem('invitationData')) {
                  window.location.href = '/dashboard'
                } else {
                  window.location.href = '/onboarding'
                }
              } else if (loginResult?.ok) {
                console.log('✅ [Auth] Automatic login successful, checking for invoice token...')
                
                // Check if this signup was triggered by an invoice token
                const invoiceToken = searchParams.get('invoiceToken')
                if (invoiceToken) {
                  console.log('🔗 [Auth] Processing invoice token:', invoiceToken)
                  try {
                    // Process the invoice token to create payable
                    const invoiceResponse = await fetch('/api/invoice-access/process-signup', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        userId: data.data._id,
                        token: invoiceToken
                      }),
                    })
                    
                    const invoiceData = await invoiceResponse.json()
                    if (invoiceData.success) {
                      console.log('✅ [Auth] Invoice payable created successfully')
                      // Redirect to payables page to show the invoice
                      window.location.href = '/dashboard/services/payables'
                    } else {
                      console.log('⚠️ [Auth] Failed to create invoice payable:', invoiceData.message)
                      // Still redirect to onboarding
                      window.location.href = '/onboarding'
                    }
                  } catch (invoiceError) {
                    console.error('❌ [Auth] Error processing invoice token:', invoiceError)
                    // Fallback to onboarding
                    window.location.href = '/onboarding'
                  }
                } else {
                  // Check if this signup was triggered by an organization invitation
                  const invitationData = localStorage.getItem('invitationData')
                  if (invitationData) {
                    console.log('🔗 [Auth] Processing organization invitation...')
                    try {
                      const invitation = JSON.parse(invitationData)
                      
                      // Complete the invitation acceptance
                      const invitationResponse = await fetch('/api/organization/complete-invitation', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          token: invitation.token,
                          userId: data.data._id
                        }),
                      })
                      
                      const invitationResult = await invitationResponse.json()
                      if (invitationResult.success) {
                        console.log('✅ [Auth] Organization invitation completed successfully')
                        // Clean up invitation data
                        localStorage.removeItem('invitationData')
                        // Redirect to dashboard
                        window.location.href = '/dashboard'
                      } else {
                        console.log('⚠️ [Auth] Failed to complete organization invitation:', invitationResult.message)
                        // Clean up invitation data and redirect to dashboard (skip onboarding for org members)
                        localStorage.removeItem('invitationData')
                        window.location.href = '/dashboard'
                      }
                    } catch (invitationError) {
                      console.error('❌ [Auth] Error processing organization invitation:', invitationError)
                      // Clean up invitation data and fallback to dashboard
                      localStorage.removeItem('invitationData')
                      window.location.href = '/dashboard'
                    }
                  } else {
                    // No special tokens: route based on organization membership
                    try {
                      const orgResp = await fetch('/api/organization')
                      const orgJson = await orgResp.json()
                      if (orgJson.success && orgJson.data?.hasOrganization) {
                        window.location.href = '/dashboard'
                      } else {
                        window.location.href = '/onboarding'
                      }
                    } catch {
                      window.location.href = '/onboarding'
                    }
                  }
                }
              }
            } catch (loginError) {
              console.error('❌ [Auth] Error during automatic login:', loginError)
              // Fallback: store user data and redirect anyway
              localStorage.setItem('user', JSON.stringify(data.data))
              if (!!localStorage.getItem('invitationData')) {
                window.location.href = '/dashboard'
              } else {
                window.location.href = '/onboarding'
              }
            }
          } else {
            // Fallback if no autoLogin data
            console.log('⚠️ [Auth] No autoLogin data, using fallback...')
            localStorage.setItem('user', JSON.stringify(data.data))
            if (!!localStorage.getItem('invitationData')) {
              window.location.href = '/dashboard'
            } else {
              // Try org-based routing
              try {
                const orgResp = await fetch('/api/organization')
                const orgJson = await orgResp.json()
                if (orgJson.success && orgJson.data?.hasOrganization) {
                  window.location.href = '/dashboard'
                } else {
                  window.location.href = '/onboarding'
                }
              } catch {
                window.location.href = '/onboarding'
              }
            }
          }
        } else {
          console.log('❌ [Auth] Signup failed:', data.message)
          setError(data.message)
        }
      }
    } catch (error) {
      console.error('❌ [Auth] Auth error:', error)
      console.error('🔍 [Auth] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      })
      setError('An error occurred. Please try again.')
    } finally {
      console.log('🏁 [Auth] Auth process completed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-950 flex items-center justify-center p-4 relative">
      {/* Back Button - Top Left Corner */}
      <Link
        href="/"
        className="absolute top-4 left-4 inline-flex items-center gap-2 text-blue-200 hover:text-white transition-colors text-sm font-medium z-10"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Website
      </Link>
      
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/chainsnobg.png"
              alt="ChainsERP"
              width={80}
              height={80}
              className="bg-white rounded-xl"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome to Global Finance
          </h1>
          <p className="text-blue-200">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        {/* Auth Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20"
        >
          {/* Toggle Buttons */}
          <div className="flex bg-white/10 rounded-lg p-1 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                isLogin 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                !isLogin 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Invoice Signup Notice */}
          {isEmailLocked && searchParams.get('invoiceToken') && (
            <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Receipt className="h-5 w-5 text-blue-400" />
                <h3 className="text-blue-200 font-medium">Invoice Access Required</h3>
              </div>
              <p className="text-blue-300 text-sm">
                You&apos;re creating an account to access an invoice sent to <strong>{formData.email}</strong>. 
                This email address cannot be changed as it&apos;s linked to the invoice.
              </p>
            </div>
          )}

          {/* Organization Invitation Notice */}
          {isEmailLocked && !!localStorage.getItem('invitationData') && (
            <div className="mb-6 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <UserCheck className="h-5 w-5 text-green-400" />
                <h3 className="text-green-200 font-medium">Organization Invitation</h3>
              </div>
              <p className="text-green-300 text-sm">
                You&apos;ve been invited to join an organization. Company name and industry are pre-filled since you&apos;re joining an existing organization.
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* User Type Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-blue-100">
                      Account Type
                      {isEmailLocked && !!localStorage.getItem('invitationData') && (
                        <span className="ml-2 text-xs text-green-300 bg-green-900/30 px-2 py-1 rounded">
                          Business Only
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, userType: 'individual' }))}
                        disabled={isEmailLocked && !!!!localStorage.getItem('invitationData')} // Disable for organization invitations
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          formData.userType === 'individual'
                            ? 'bg-blue-600 text-white'
                            : isEmailLocked && !!!!localStorage.getItem('invitationData')
                            ? 'bg-white/5 text-blue-300 cursor-not-allowed'
                            : 'bg-white/10 text-blue-200 hover:bg-white/20'
                        }`}
                      >
                        <User className="h-4 w-4" />
                        Individual
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, userType: 'business' }))}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          formData.userType === 'business'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/10 text-blue-200 hover:bg-white/20'
                        }`}
                      >
                        <Building className="h-4 w-4" />
                        Business
                      </button>
                    </div>
                  </div>

                  {/* Full Name Field - Always shown */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-blue-100">
                      Full Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 border rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/10 border-white/20"
                        placeholder="Enter your full name"
                        required
                      />
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-300" />
                    </div>
                  </div>

                  {/* Company Name Field - Only for business users */}
                  {formData.userType === 'business' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-blue-100">
                        Company Name
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          name="companyName"
                          value={formData.companyName}
                          onChange={handleInputChange}
                          disabled={isEmailLocked && !!localStorage.getItem('invitationData')} // Disable for organization invitations
                          className={`w-full pl-10 pr-4 py-3 border rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            isEmailLocked && !!localStorage.getItem('invitationData')
                              ? 'bg-white/5 border-white/10 text-blue-200 cursor-not-allowed' 
                              : 'bg-white/10 border-white/20'
                          }`}
                          placeholder="Enter company name"
                          required
                        />
                        <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-300" />
                      </div>
                    </div>
                  )}

                  {/* Additional Fields for Signup */}
                  <motion.div
                    key="additional-fields"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    {/* Phone */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-blue-100">
                        Phone Number
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="w-full pl-4 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="+123 000 000"
                        />
                      </div>
                      <p className="text-xs text-blue-300/70">
                        Include your country code (e.g., +1 for US, +254 for Kenya)
                      </p>
                    </div>

                    {/* Industry */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-blue-100">
                        Industry (Optional)
                      </label>
                      <div className="relative dropdown-container">
                        <button
                          type="button"
                          onClick={() => setShowIndustryDropdown(!showIndustryDropdown)}
                          disabled={isEmailLocked && !!localStorage.getItem('invitationData')} // Disable for organization invitations
                          className={`w-full pl-10 pr-10 py-3 border rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between ${
                            isEmailLocked && !!localStorage.getItem('invitationData')
                              ? 'bg-white/5 border-white/10 text-blue-200 cursor-not-allowed' 
                              : 'bg-white/10 border-white/20'
                          }`}
                        >
                          <span className={formData.industry ? 'text-white' : 'text-blue-200'}>
                            {formData.industry || 'Select your industry'}
                          </span>
                          <ChevronDown className={`h-5 w-5 text-blue-300 transition-transform ${showIndustryDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-300" />
                        
                        {showIndustryDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-600 rounded-lg max-h-60 overflow-y-auto z-10 shadow-xl">
                            {industryCategories.map(category => (
                              <div key={category}>
                                <div className="px-3 py-2 text-xs font-medium text-blue-300 bg-gray-800 border-b border-gray-600">
                                  {category}
                                </div>
                                {getIndustriesByCategory(category).map(industry => (
                                  <button
                                    key={industry.id}
                                    type="button"
                                    onClick={() => {
                                      setFormData(prev => ({ ...prev, industry: industry.name }))
                                      setShowIndustryDropdown(false)
                                    }}
                                    className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 transition-colors border-b border-gray-700"
                                  >
                                    {industry.name}
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Address Fields */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-blue-100">
                        Address
                      </label>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={formData.address.street}
                          onChange={(e) => handleAddressChange('street', e.target.value)}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Street Address"
                          required
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={formData.address.city}
                            onChange={(e) => handleAddressChange('city', e.target.value)}
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="City"
                            required
                          />
                          <input
                            type="text"
                            value={formData.address.postalCode}
                            onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Postal Code"
                            required
                          />
                        </div>
                        <div className="relative dropdown-container">
                          <button
                            type="button"
                            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between"
                          >
                          <span className="text-white">
                            {countries.find(c => c.code === formData.address.country)?.name || 'Select country'}
                          </span>
                          <ChevronDown className={`h-5 w-5 text-blue-300 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showCountryDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-600 rounded-lg max-h-60 overflow-y-auto z-10 shadow-xl">
                            {/* Search input */}
                            <div className="p-2 border-b border-gray-600 bg-gray-800">
                              <input
                                type="text"
                                value={countrySearch}
                                onChange={(e) => setCountrySearch(e.target.value)}
                                placeholder="Search countries or phone codes..."
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-500 rounded text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            {countries
                              .filter(country => 
                                country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                country.phoneCode.includes(countrySearch) ||
                                country.code.toLowerCase().includes(countrySearch.toLowerCase())
                              )
                              .map(country => (
                              <button
                                key={country.code}
                                type="button"
                                onClick={() => {
                                  handleAddressChange('country', country.code)
                                  setShowCountryDropdown(false)
                                  setCountrySearch('')
                                }}
                                className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 transition-colors flex items-center justify-between border-b border-gray-700"
                              >
                                <span>{country.name}</span>
                                <span className="text-blue-300 text-sm font-medium">{country.phoneCode}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        </div>
                      </div>
                    </div>

                    {/* Tax ID */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-blue-100">
                        Tax ID (Optional)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          name="taxId"
                          value={formData.taxId}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter your tax ID"
                        />
                        <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-300" />
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-blue-100">
                Email Address
                {isEmailLocked && searchParams.get('invoiceToken') && (
                  <span className="ml-2 text-xs text-blue-300 bg-blue-900/30 px-2 py-1 rounded">
                    Locked to invoice recipient
                  </span>
                )}
                {isEmailLocked && !!localStorage.getItem('invitationData') && (
                  <span className="ml-2 text-xs text-green-300 bg-green-900/30 px-2 py-1 rounded">
                    From invitation
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isEmailLocked}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isEmailLocked 
                      ? 'bg-white/5 border-white/10 text-blue-200 cursor-not-allowed' 
                      : 'bg-white/10 border-white/20'
                  }`}
                  placeholder={
                    isEmailLocked && searchParams.get('invoiceToken') 
                      ? "Email locked to invoice recipient" 
                      : isEmailLocked && !!localStorage.getItem('invitationData')
                      ? "Email from invitation"
                      : "Enter your email"
                  }
                  required
                />
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-300" />
              </div>
              {isEmailLocked && searchParams.get('invoiceToken') && (
                <p className="text-xs text-blue-300 mt-1">
                  This email address is locked because you&apos;re creating an account to access an invoice sent to this address.
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-blue-100">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                  required
                />
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-300" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-300 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Signup only) */}
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  key="confirm-password"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-2"
                >
                  <label className="text-sm font-medium text-blue-100">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Confirm your password"
                      required
                    />
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-300" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-300 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Terms Agreement (Signup only) */}
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  key="terms-agreement"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-2"
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      name="agreeToTerms"
                      checked={formData.agreeToTerms}
                      onChange={(e) => setFormData(prev => ({ ...prev, agreeToTerms: e.target.checked }))}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      required
                    />
                    <label className="text-sm text-blue-200 leading-relaxed">
                      I agree to the{' '}
                      <a
                        href="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        Terms of Service
                      </a>
                      {' '}and{' '}
                      <a
                        href="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        Privacy Policy
                      </a>
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  {isLogin ? 'Signing In...' : 'Creating Account...'}
                </>
              ) : isLogin ? (
                <>
                  <UserCheck className="h-5 w-5" />
                  Sign In
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5" />
                  Create Account
                </>
              )}
            </motion.button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-transparent text-blue-200">Or continue with</span>
              </div>
            </div>

            {/* Google Sign In Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 bg-white text-gray-800 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </motion.button>
          </form>

          {/* Additional Links */}
          <div className="mt-6 text-center">
            {isLogin ? (
              <p className="text-blue-200 text-sm">
                                 Don&apos;t have an account?{' '}
                <button
                  onClick={() => setIsLogin(false)}
                  className="text-blue-400 hover:text-white font-medium"
                >
                  Sign up here
                </button>
              </p>
            ) : (
              <p className="text-blue-200 text-sm">
                Already have an account?{' '}
                <button
                  onClick={() => setIsLogin(true)}
                  className="text-blue-400 hover:text-white font-medium"
                >
                  Sign in here
                </button>
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
} 