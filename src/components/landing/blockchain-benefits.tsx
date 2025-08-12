'use client'

import { motion } from 'framer-motion'
import { 
  LockKeyhole, 
  History, 
  Banknote, 
  Network,
  ShieldCheck,
  Fingerprint,
  FileText,
  Receipt,
  Users,
  Calculator,
  ArrowRight,
  ArrowLeft,
  Coins,
  Code,
  Globe2
} from 'lucide-react'
import Image from "next/image"
import Link from 'next/link'

const benefits = [
  {
    icon: FileText,
    title: 'Smart Invoicing',
    description: 'Create, manage, and get paid with blockchain-powered smart invoices',
    link: '/services'
  },
  {
    icon: LockKeyhole,
    title: 'Immutable Records',
    description: 'Every transaction is permanently recorded and cannot be altered',
    link: '/services'
  },
  {
    icon: History,
    title: 'Audit Trail',
    description: 'Complete history of all business operations and changes',
    link: '/services'
  },
  {
    icon: Banknote,
    title: 'Smart Payments',
    description: 'Automated payments and settlements using smart contracts',
    link: '/services'
  },
  {
    icon: Network,
    title: 'Decentralized',
    description: 'No single point of failure in data storage and processing',
    link: '/services'
  },
  {
    icon: ShieldCheck,
    title: 'Enhanced Security',
    description: 'Cryptographic security for all business transactions',
    link: '/services'
  },
  {
    icon: Fingerprint,
    title: 'Identity Management',
    description: 'Secure and verifiable digital identities for all users',
    link: '/services'
  }
]

const businessSolutions = [
  {
    icon: ArrowLeft,
    title: 'Accounts Payable',
    description: 'Manage your business payments',
    category: 'For Companies',
    link: '/services'
  },
  {
    icon: ArrowRight,
    title: 'Accounts Receivable',
    description: 'Create invoices & get paid in crypto & fiat legally',
    category: 'For Companies',
    link: '/services'
  },
  {
    icon: Receipt,
    title: 'Expenses',
    description: 'Easily manage your corporate expenses in crypto & fiat',
    category: 'For Companies',
    link: '/services'
  },
  {
    icon: Users,
    title: 'Payroll',
    description: 'Pay your team salaries and bonuses in crypto & fiat',
    category: 'For Companies',
    link: '/services'
  },
  {
    icon: Receipt,
    title: 'Expenses',
    description: 'Get reimbursed for your corporate expenses',
    category: 'For Freelancers',
    link: '/services'
  },
  {
    icon: FileText,
    title: 'Invoicing',
    description: 'The easiest way for freelancers and contractors to get paid in crypto & fiat',
    category: 'For Freelancers',
    link: '/services'
  }
]

const integrations = [
  {
    icon: Calculator,
    title: 'Accounting',
    description: 'Import, categorize, and sync your crypto and fiat transactions with QuickBooks, Xero and more',
    module: 'Integrations',
    link: '/services'
  },
  {
    icon: Code,
    title: 'Accounts Payable & Receivable API',
    description: 'Build custom finance processes and let users manage payables and receivables on your platform',
    module: 'API Solutions',
    link: '/services'
  },
  {
    icon: Coins,
    title: 'Crypto-to-Fiat',
    description: 'Pay in Crypto and your beneficiary receives Fiat',
    module: 'Payment Solutions',
    link: '/services'
  },
  {
    icon: Globe2,
    title: 'Offramp API',
    description: 'Add worldwide offramp capabilities to your platform and unlock a new revenue stream for your business',
    module: 'API Solutions',
    link: '/services'
  }
]

export function BlockchainBenefits() {
  return (
    <section className="py-4 md:py-8 bg-gradient-to-br from-blue-900 to-blue-950 text-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-4 md:mb-8">
          <div className="flex justify-center">
            <Image
              src="/chainsnobg.png"
              alt="ChainsERP"
              width={80}
              height={80}
              className="bg-white mb-2 rounded-xl md:w-[120px] md:h-[120px]"
            />
          </div>
          <h1 className="text-xl md:text-3xl lg:text-5xl font-bold text-white mb-2 md:mb-4">
            Blockchain-Powered {' '}
            <span className="bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent">
              Global Business
            </span>
          </h1>
          <p className="text-sm md:text-lg text-blue-100 max-w-2xl mx-auto">
            Enterprise-grade security and transparency with blockchain technology
          </p>
        </div>

        {/* Core Benefits */}
        <div className="mb-4 md:mb-8">
          <h3 className="text-lg md:text-xl font-bold text-center mb-3 md:mb-6">
            Core Blockchain Benefits
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon
              const cardContent = (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-2 md:p-6 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer ring-1 ring-blue-400/30 hover:ring-blue-500"
                >
                  <div className="w-8 h-8 md:w-12 md:h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-2 md:mb-4">
                    <Icon className="h-4 w-4 md:h-6 md:w-6 text-blue-400" />
                  </div>
                  <h3 className="text-xs md:text-lg font-semibold mb-1 md:mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-blue-100 text-xs md:text-sm leading-tight">
                    {benefit.description}
                  </p>
                </motion.div>
              )
              return (
                <Link href={benefit.link} key={benefit.title} style={{ textDecoration: 'none' }}>
                  {cardContent}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Business Solutions */}
        <div className="border-t border-blue-800 pt-4 md:pt-8 mb-4 md:mb-8">
          <h3 className="text-lg md:text-xl font-bold text-center mb-3 md:mb-6">
            Business Solutions
          </h3>
          
          {/* For Companies */}
          <div className="mb-4 md:mb-6">
            <h4 className="text-sm md:text-lg font-semibold mb-2 md:mb-4 text-blue-200">For Companies</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-4">
              {businessSolutions
                .filter(solution => solution.category === 'For Companies')
                .map((solution, index) => {
                  const Icon = solution.icon
                  const cardContent = (
                    <motion.div
                      key={solution.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-2 md:p-6 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <div className="w-6 h-6 md:w-12 md:h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-1 md:mb-4">
                        <Icon className="h-3 w-3 md:h-6 md:w-6 text-blue-400" />
                      </div>
                      <h4 className="text-xs md:text-lg font-semibold mb-1 md:mb-2">
                        {solution.title}
                      </h4>
                      <p className="text-blue-100 text-xs md:text-sm leading-tight">
                        {solution.description}
                      </p>
                    </motion.div>
                  )
                  return (
                    <Link href={solution.link} key={solution.title} style={{ textDecoration: 'none' }}>
                      {cardContent}
                    </Link>
                  )
                })}
            </div>
          </div>

          {/* For Freelancers */}
          <div className="mb-4 md:mb-6">
            <h4 className="text-sm md:text-lg font-semibold mb-2 md:mb-4 text-blue-200">For Freelancers</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
              {businessSolutions
                .filter(solution => solution.category === 'For Freelancers')
                .map((solution, index) => {
                  const Icon = solution.icon
                  const cardContent = (
                    <motion.div
                      key={solution.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-2 md:p-6 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <div className="w-6 h-6 md:w-12 md:h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-1 md:mb-4">
                        <Icon className="h-3 w-3 md:h-6 md:w-6 text-blue-400" />
                      </div>
                      <h4 className="text-xs md:text-lg font-semibold mb-1 md:mb-2">
                        {solution.title}
                      </h4>
                      <p className="text-blue-100 text-xs md:text-sm leading-tight">
                        {solution.description}
                      </p>
                    </motion.div>
                  )
                  return (
                    <Link href={solution.link} key={solution.title} style={{ textDecoration: 'none' }}>
                      {cardContent}
                    </Link>
                  )
                })}
            </div>
          </div>
        </div>

        {/* Integrations and API Solutions */}
        <div className="border-t border-blue-800 pt-4 md:pt-8 mb-4 md:mb-8">
          <h3 className="text-lg md:text-xl font-bold text-center mb-3 md:mb-6">
            Integrations and API Solutions
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            {integrations.map((integration, index) => {
              const Icon = integration.icon
              const cardContent = (
                <motion.div
                  key={integration.title}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 0.3 }}
                  className="flex bg-white/5 rounded-lg overflow-hidden cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <div className="w-8 md:w-16 flex-shrink-0 bg-blue-800/30 flex items-center justify-center">
                    <Icon className="h-4 w-4 md:h-8 md:w-8 text-blue-400" />
                  </div>
                  <div className="p-2 md:p-6">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                      {integration.module}
                    </span>
                    <h4 className="text-sm md:text-lg font-semibold mb-1 md:mb-2 mt-1">
                      {integration.title}
                    </h4>
                    <p className="text-blue-100 text-xs md:text-sm leading-tight">
                      {integration.description}
                    </p>
                  </div>
                </motion.div>
              )
              return (
                <Link href={integration.link} key={integration.title} style={{ textDecoration: 'none' }}>
                  {cardContent}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="text-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <h3 className="text-base md:text-lg font-medium mb-2 md:mb-3">
              Why Blockchain for Global Business?
            </h3>
            <p className="max-w-xl mx-auto text-blue-100 mb-3 md:mb-4 text-xs md:text-sm">
              Traditional international business faces challenges with trust, transparency, 
              and transaction costs. Our blockchain integration eliminates these barriers.
            </p>
            <button className="px-3 md:px-4 py-1.5 md:py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors font-medium text-xs md:text-sm">
              Learn More
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  )
} 