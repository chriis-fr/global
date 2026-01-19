'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Menu,
  X,
  ChevronDown,
  Globe,
  Shield,
  Zap,
  Building,
  LayoutDashboard,
  Loader2
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export function Header() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProductsOpen, setIsProductsOpen] = useState(false)
  const [isSolutionsOpen, setIsSolutionsOpen] = useState(false)
  const [navLoading, setNavLoading] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // Optimized handlers for mobile performance

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleNav = useCallback(async (path: string, id: string) => {
    if (navLoading) return;
    setNavLoading(id);
    router.push(path);
  }, [navLoading, router]);

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Products', href: '#', hasDropdown: true },
    { name: 'Solutions', href: '#', hasDropdown: true },
    { name: 'Use Cases', href: '/use-cases' },
    { name: 'Pricing', href: '/pricing' }
  ]

  const products = [
    {
      name: 'Smart Invoicing',
      description: 'Create and manage invoices with blockchain security',
      icon: Building,
      href: '/use-cases'
    },
    {
      name: 'Accounts Payable',
      description: 'Manage your business payments efficiently',
      icon: Shield,
      href: '/use-cases'
    },
    {
      name: 'Accounts Receivable',
      description: 'Get paid in crypto & fiat legally',
      icon: Zap,
      href: '/use-cases'
    },
    {
      name: 'Global Payments',
      description: 'Cross-border transactions with minimal fees',
      icon: Globe,
      href: '/use-cases'
    }
  ]

  const solutions = [
    {
      name: 'For Companies',
      description: 'Enterprise solutions for large organizations',
      icon: Building,
      href: '/use-cases'
    },
    {
      name: 'For Freelancers',
      description: 'Simple tools for independent contractors',
      icon: Shield,
      href: '/use-cases'
    },
    {
      name: 'For Startups',
      description: 'Scalable solutions for growing businesses',
      icon: Zap,
      href: '/use-cases'
    },
    {
      name: 'For Enterprises',
      description: 'Custom solutions for complex needs',
      icon: Globe,
      href: '/use-cases'
    }
  ]

  return (
    <header
      className="fixed left-1/2 -translate-x-1/2 top-3 shadow-inner font-sans bg-opacity-15 w-[90%] border border-gray-300 mx-auto z-50 rounded-2xl bg-white backdrop-blur-md"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src="/chainsnobg.png"
                alt="ChainsERP"
                width={45}
                height={45}
                className="bg-white rounded-lg"
                priority
                fetchPriority="high"
              />
              <span className="text-xl font-sans font-bold text-gray-900">Global Finance</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <div key={item.name} className="relative ">
                {item.hasDropdown ? (
                  <div
                    onMouseEnter={() => {
                      if (item.name === 'Products') setIsProductsOpen(true)
                      if (item.name === 'Solutions') setIsSolutionsOpen(true)
                    }}
                    onMouseLeave={() => {
                      if (item.name === 'Products') setIsProductsOpen(false)
                      if (item.name === 'Solutions') setIsSolutionsOpen(false)
                    }}
                    className="relative"
                  >
                    <button 
                      className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors touch-manipulation active:scale-95"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <span>{item.name}</span>
                      <ChevronDown className="h-4 w-4" />
                    </button>

                    {/* Dropdown */}
                    <AnimatePresence>
                      {((item.name === 'Products' && isProductsOpen) || (item.name === 'Solutions' && isSolutionsOpen)) && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 p-4"
                        >
                          <div className="grid grid-cols-1 gap-3">
                            {(item.name === 'Products' ? products : solutions).map((item) => {
                              const Icon = item.icon
                              return (
                                <Link
                                  key={item.name}
                                  href={item.href}
                                  className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors touch-manipulation active:scale-95"
                                  style={{ touchAction: 'manipulation' }}
                                >
                                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Icon className="h-5 w-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-medium text-gray-900">{item.name}</h3>
                                    <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                                  </div>
                                </Link>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className="text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Only show Dashboard button if user is authenticated */}
            {session && (
              <Link
                href="/dashboard"
                className="flex items-center space-x-2 hover:bg-blue-800 text-white bg-blue-600 py-1 px-4  rounded-lg transition-colors font-medium"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
            )}
            {session ? (
              <button
                onClick={async () => {
                  if (isSigningOut) return;
                  setIsSigningOut(true);
                  try {
                    await signOut({ callbackUrl: '/' });
                  } catch (error) {
                    console.error('Error signing out:', error);
                    setIsSigningOut(false);
                  }
                }}
                disabled={isSigningOut}
                className="text-gray-700 hover:text-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isSigningOut && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{isSigningOut ? 'Signing Out...' : 'Sign Out'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleNav('/auth', 'signin')}
                disabled={navLoading === 'signin'}
                className="text-gray-700 hover:text-blue-600 transition-colors font-medium flex items-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>Sign In</span>
                {navLoading === 'signin' && <Loader2 className="h-4 w-4 animate-spin" />}
              </button>
            )}
            {!session && <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >

              <button
                type="button"
                onClick={() => handleNav('/auth', 'getstarted')}
                disabled={navLoading === 'getstarted'}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>Get Started</span>
                {navLoading === 'getstarted' && <Loader2 className="h-4 w-4 animate-spin" />}
              </button>
            </motion.div>}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(prev => !prev);
                setIsProductsOpen(false);
                setIsSolutionsOpen(false);
              }}
              className="text-gray-700 hover:text-blue-600 transition-colors touch-manipulation active:scale-95"
              style={{ touchAction: 'manipulation' }}
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-gray-200"
            >
              <div className="py-4 space-y-2">
                {navigation.map((item) => (
                  <div key={item.name}>
                    {item.hasDropdown ? (
                      <div>
                        <button
                          onClick={() => {
                            if (item.name === 'Products') {
                              setIsProductsOpen(!isProductsOpen);
                            } else if (item.name === 'Solutions') {
                              setIsSolutionsOpen(!isSolutionsOpen);
                            }
                          }}
                          className="flex items-center justify-between w-full text-gray-700 hover:text-blue-600 transition-colors touch-manipulation active:scale-[0.98] py-2"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <span>{item.name}</span>
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${
                              (item.name === 'Products' && isProductsOpen) || 
                              (item.name === 'Solutions' && isSolutionsOpen)
                                ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        <AnimatePresence>
                          {((item.name === 'Products' && isProductsOpen) || 
                            (item.name === 'Solutions' && isSolutionsOpen)) && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="pl-4 space-y-2 mt-2"
                            >
                              {(item.name === 'Products' ? products : solutions).map((dropdownItem) => {
                                const Icon = dropdownItem.icon;
                                return (
                                  <Link
                                    key={dropdownItem.name}
                                    href={dropdownItem.href}
                                    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors touch-manipulation active:scale-[0.98]"
                                    onClick={() => {
                                      closeMenu();
                                      setIsProductsOpen(false);
                                      setIsSolutionsOpen(false);
                                    }}
                                    style={{ touchAction: 'manipulation' }}
                                  >
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <Icon className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                      <h3 className="text-sm font-medium text-gray-900">{dropdownItem.name}</h3>
                                      <p className="text-xs text-gray-500 mt-1">{dropdownItem.description}</p>
                                    </div>
                                  </Link>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        className="block text-gray-700 hover:text-blue-600 transition-colors touch-manipulation active:scale-[0.98] py-2"
                        onClick={() => {
                          closeMenu();
                          setIsProductsOpen(false);
                          setIsSolutionsOpen(false);
                        }}
                        style={{ touchAction: 'manipulation' }}
                      >
                        {item.name}
                      </Link>
                    )}
                  </div>
                ))}

                {/* Mobile Dashboard button - only show if authenticated */}
                {session && (
                  <Link
                    href="/dashboard"
                    className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors touch-manipulation active:scale-95"
                    onClick={() => {
                      closeMenu();
                    }}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                )}

                <div className="pt-4 border-t border-gray-200 space-y-3">
                  {session ? (
                    <button
                      onClick={async () => {
                        if (isSigningOut) return;
                        setIsSigningOut(true);
                        setIsMenuOpen(false);
                        try {
                          await signOut({ callbackUrl: '/' });
                        } catch (error) {
                          console.error('Error signing out:', error);
                          setIsSigningOut(false);
                        }
                      }}
                      disabled={isSigningOut}
                      className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors w-full text-left touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ touchAction: 'manipulation' }}
                    >
                      {isSigningOut && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span>{isSigningOut ? 'Signing Out...' : 'Sign Out'}</span>
                    </button>
                  ) : (
                    <Link
                      href="/auth"
                      className="block text-gray-700 hover:text-blue-600 transition-colors touch-manipulation active:scale-95"
                      onClick={() => {
                        closeMenu();
                      }}
                      style={{ touchAction: 'manipulation' }}
                    >
                      Sign In
                    </Link>
                  )}
                  <Link
                    href="/auth"
                    className="block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center touch-manipulation active:scale-95"
                    onClick={() => {
                      closeMenu();
                    }}
                    style={{ touchAction: 'manipulation' }}
                  >
                    {session ? 'Go to Dashboard' : 'Get Started'}
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
} 