'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Menu, 
  X, 
  ChevronDown,
  Globe,
  Shield,
  Zap,
  Building,
  LayoutDashboard
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import { useSession, signOut } from 'next-auth/react'

export function Header() {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProductsOpen, setIsProductsOpen] = useState(false)
  const [isSolutionsOpen, setIsSolutionsOpen] = useState(false)

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
      href: '/auth'
    },
    {
      name: 'Accounts Payable',
      description: 'Manage your business payments efficiently',
      icon: Shield,
      href: '/auth'
    },
    {
      name: 'Accounts Receivable',
      description: 'Get paid in crypto & fiat legally',
      icon: Zap,
      href: '/auth'
    },
    {
      name: 'Global Payments',
      description: 'Cross-border transactions with minimal fees',
      icon: Globe,
      href: '/auth'
    }
  ]

  const solutions = [
    {
      name: 'For Companies',
      description: 'Enterprise solutions for large organizations',
      icon: Building,
      href: '/auth'
    },
    {
      name: 'For Freelancers',
      description: 'Simple tools for independent contractors',
      icon: Shield,
      href: '/auth'
    },
    {
      name: 'For Startups',
      description: 'Scalable solutions for growing businesses',
      icon: Zap,
      href: '/auth'
    },
    {
      name: 'For Enterprises',
      description: 'Custom solutions for complex needs',
      icon: Globe,
      href: '/auth'
    }
  ]

  return (
    <header className="fixed left-1/2 -translate-x-1/2  top-3 shadow-inner font-sans bg-opacity-15 w-[90%] border-red-500 border mx-auto z-50 rounded-2xl bg-white backdrop-blur-md ">
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
              />
              <span className="text-xl font-sans font-bold text-gray-900">Global Finance</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <div key={item.name} className="relative border ">
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
                    <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
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
                                  className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
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
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-gray-700 hover:text-blue-600 transition-colors font-medium"
              >
                Sign Out
              </button>
            ) : (
              <Link
                href="/auth"
                className="text-gray-700 hover:text-blue-600 transition-colors font-medium"
              >
                Sign In
              </Link>
            )}
            {!session &&<motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              
               <Link
                href="/auth"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                
                {'Get Started'}
              </Link>
            </motion.div>}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-blue-600 transition-colors"
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
              <div className="py-4 space-y-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="block text-gray-700 hover:text-blue-600 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
                
                {/* Mobile Dashboard button - only show if authenticated */}
                {session && (
                  <Link
                    href="/dashboard"
                    className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                )}
                
                <div className="pt-4 border-t border-gray-200 space-y-3">
                  {session ? (
                    <button
                      onClick={() => {
                        signOut({ callbackUrl: '/' });
                        setIsMenuOpen(false);
                      }}
                      className="block text-gray-700 hover:text-blue-600 transition-colors w-full text-left"
                    >
                      Sign Out
                    </button>
                  ) : (
                    <Link
                      href="/auth"
                      className="block text-gray-700 hover:text-blue-600 transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Sign In
                    </Link>
                  )}
                  <Link
                    href="/auth"
                    className="block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
                    onClick={() => setIsMenuOpen(false)}
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