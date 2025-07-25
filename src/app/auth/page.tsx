'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff,
  Building,
  UserCheck,
  Shield,
  ChevronDown
} from 'lucide-react'
import Image from 'next/image'
import { signIn, useSession } from 'next-auth/react'
import { countries, defaultCountry } from '@/data/countries'
import { getIndustriesByCategory, getIndustryCategories } from '@/data/industries'

export default function AuthPage() {
  const { data: session, status } = useSession()
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    companyName: '',
    userType: 'individual' as 'individual' | 'business',
    phone: '',
    industry: '',
    address: {
      street: '',
      city: '',
      country: defaultCountry.code,
      postalCode: ''
    },
    taxId: ''
  })

  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false)
  const [industryCategories] = useState(getIndustryCategories())
  const [countrySearch, setCountrySearch] = useState('')

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
    if (!target.closest('.dropdown-container') && !target.closest('.phone-country-dropdown')) {
      setShowCountryDropdown(false)
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
        console.log('✅ [Auth] Google sign-in successful, checking onboarding status...')
        // For Google sign-in, we need to check if user exists and has completed onboarding
        try {
          // Wait a moment for session to update
          setTimeout(async () => {
            const response = await fetch('/api/onboarding/status')
            const data = await response.json()
            
            if (data.success && data.data.onboarding.completed) {
              console.log('✅ [Auth] Onboarding completed, redirecting to dashboard')
              window.location.href = '/dashboard'
            } else {
              console.log('⚠️ [Auth] Onboarding not completed, redirecting to onboarding')
              window.location.href = '/onboarding'
            }
          }, 1000)
        } catch (error) {
          console.error('❌ [Auth] Error checking onboarding status:', error)
          window.location.href = '/onboarding'
        }
      }
    } catch (error) {
      console.error('❌ [Auth] Google sign-in error:', error)
      setError('An error occurred during Google sign-in.')
    } finally {
      setLoading(false)
    }
  }

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated' && session) {
      console.log('✅ [Auth] User already authenticated, checking onboarding status...')
      
      // Check if user has completed onboarding
      const checkOnboardingStatus = async () => {
        try {
          const response = await fetch('/api/onboarding/status')
          const data = await response.json()
          
          if (data.success) {
            if (data.data.onboarding.completed) {
              console.log('✅ [Auth] Onboarding completed, redirecting to dashboard')
              window.location.href = '/dashboard'
            } else {
              console.log('⚠️ [Auth] Onboarding not completed, redirecting to onboarding')
              window.location.href = '/onboarding'
            }
          } else {
            console.log('⚠️ [Auth] Could not check onboarding status, redirecting to onboarding')
            window.location.href = '/onboarding'
          }
        } catch (error) {
          console.error('❌ [Auth] Error checking onboarding status:', error)
          // Fallback to onboarding
          window.location.href = '/onboarding'
        }
      }
      
      checkOnboardingStatus()
    }
  }, [session, status])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🚀 [Auth] Form submitted, mode:', isLogin ? 'login' : 'signup')
    console.log('📋 [Auth] Form data:', {
      email: formData.email,
      name: formData.name,
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
          console.log('✅ [Auth] Login successful, checking onboarding status...')
          // Check onboarding status and redirect accordingly
          try {
            const response = await fetch('/api/onboarding/status')
            const data = await response.json()
            
            if (data.success && data.data.onboarding.completed) {
              console.log('✅ [Auth] Onboarding completed, redirecting to dashboard')
              window.location.href = '/dashboard'
            } else {
              console.log('⚠️ [Auth] Onboarding not completed, redirecting to onboarding')
              window.location.href = '/onboarding'
            }
          } catch (error) {
            console.error('❌ [Auth] Error checking onboarding status:', error)
            window.location.href = '/onboarding'
          }
        }
      } else {
        // Handle signup
        console.log('📝 [Auth] Preparing signup data...')
        const signupData = {
          email: formData.email,
          password: formData.password,
          name: formData.userType === 'business' ? formData.companyName : formData.name,
          userType: formData.userType,
          phone: cleanPhoneNumber(formData.phone),
          industry: formData.industry,
          address: formData.address,
          taxId: formData.taxId
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
                window.location.href = '/onboarding'
              } else if (loginResult?.ok) {
                console.log('✅ [Auth] Automatic login successful, checking onboarding status...')
                // For new users, they should always go to onboarding
                window.location.href = '/onboarding'
              }
            } catch (loginError) {
              console.error('❌ [Auth] Error during automatic login:', loginError)
              // Fallback: store user data and redirect anyway
              localStorage.setItem('user', JSON.stringify(data.data))
              window.location.href = '/onboarding'
            }
          } else {
            // Fallback if no autoLogin data
            console.log('⚠️ [Auth] No autoLogin data, using fallback...')
            localStorage.setItem('user', JSON.stringify(data.data))
            window.location.href = '/onboarding'
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-950 flex items-center justify-center p-4">
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
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, userType: 'individual' }))}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          formData.userType === 'individual'
                            ? 'bg-blue-600 text-white'
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

                  {/* Name Fields */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-blue-100">
                      {formData.userType === 'business' ? 'Company Name' : 'Full Name'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name={formData.userType === 'business' ? 'companyName' : 'name'}
                        value={formData.userType === 'business' ? formData.companyName : formData.name}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={formData.userType === 'business' ? 'Enter company name' : 'Enter your full name'}
                        required
                      />
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-300" />
                    </div>
                  </div>

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
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                              className="px-3 py-3 bg-white/5 border border-white/20 border-r-0 rounded-l-lg text-blue-200 text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-1"
                            >
                              {countries.find(c => c.code === formData.address.country)?.phoneCode || '+1'}
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            className="flex-1 pl-4 pr-4 py-3 bg-white/10 border border-white/20 rounded-r-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter your phone number"
                          />
                        </div>
                        
                        {/* Country Dropdown for Phone */}
                        {showCountryDropdown && (
                          <div className="phone-country-dropdown absolute top-full left-0 mt-1 bg-gray-900 border border-gray-600 rounded-lg max-h-60 overflow-y-auto z-20 min-w-64 shadow-xl">
                            <div className="p-2 border-b border-gray-600 bg-gray-800">
                              <input
                                type="text"
                                value={countrySearch}
                                onChange={(e) => setCountrySearch(e.target.value)}
                                placeholder="Search countries..."
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-500 rounded text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="max-h-48 overflow-y-auto bg-gray-900">
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
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-blue-300">
                        Click the country code to change it, or type a phone number to auto-detect country
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
                          className="w-full pl-10 pr-10 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between"
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
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                  required
                />
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-300" />
              </div>
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