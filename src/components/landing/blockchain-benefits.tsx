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
    link: '/invoicing'
  },
  {
    icon: LockKeyhole,
    title: 'Immutable Records',
    description: 'Every transaction is permanently recorded and cannot be altered'
  },
  {
    icon: History,
    title: 'Audit Trail',
    description: 'Complete history of all business operations and changes'
  },
  {
    icon: Banknote,
    title: 'Smart Payments',
    description: 'Automated payments and settlements using smart contracts'
  },
  {
    icon: Network,
    title: 'Decentralized',
    description: 'No single point of failure in data storage and processing'
  },
  {
    icon: ShieldCheck,
    title: 'Enhanced Security',
    description: 'Cryptographic security for all business transactions'
  },
  {
    icon: Fingerprint,
    title: 'Identity Management',
    description: 'Secure and verifiable digital identities for all users'
  }
]

const businessSolutions = [
  {
    icon: ArrowLeft,
    title: 'Accounts Payable',
    description: 'Manage your business payments',
    category: 'For Companies'
  },
  {
    icon: ArrowRight,
    title: 'Accounts Receivable',
    description: 'Create invoices & get paid in crypto & fiat legally',
    category: 'For Companies'
  },
  {
    icon: Receipt,
    title: 'Expenses',
    description: 'Easily manage your corporate expenses in crypto & fiat',
    category: 'For Companies'
  },
  {
    icon: Users,
    title: 'Payroll',
    description: 'Pay your team salaries and bonuses in crypto & fiat',
    category: 'For Companies'
  },
  {
    icon: Receipt,
    title: 'Expenses',
    description: 'Get reimbursed for your corporate expenses',
    category: 'For Freelancers'
  },
  {
    icon: FileText,
    title: 'Invoicing',
    description: 'The easiest way for freelancers and contractors to get paid in crypto & fiat',
    category: 'For Freelancers'
  }
]

const integrations = [
  {
    icon: Calculator,
    title: 'Accounting',
    description: 'Import, categorize, and sync your crypto and fiat transactions with QuickBooks, Xero and more',
    module: 'Integrations'
  },
  {
    icon: Code,
    title: 'Accounts Payable & Receivable API',
    description: 'Build custom finance processes and let users manage payables and receivables on your platform',
    module: 'API Solutions'
  },
  {
    icon: Coins,
    title: 'Crypto-to-Fiat',
    description: 'Pay in Crypto and your beneficiary receives Fiat',
    module: 'Payment Solutions'
  },
  {
    icon: Globe2,
    title: 'Offramp API',
    description: 'Add worldwide offramp capabilities to your platform and unlock a new revenue stream for your business',
    module: 'API Solutions'
  }
]

export function BlockchainBenefits() {
  return (
    <section className="py-16 bg-gradient-to-br from-blue-900 to-blue-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="flex justify-center">
            <Image
              src="/chainsnobg.png"
              alt="ChainsERP"
              width={150}
              height={150}
              className="bg-white mb-4 rounded-2xl"
            />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Blockchain-Powered {' '}
            <span className="bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent">
              Global Business
            </span>
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto">
            Enterprise-grade security and transparency with blockchain technology, 
            designed for modern global business operations
          </p>
        </div>

        {/* Core Benefits */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-center mb-10">
            Core Blockchain Benefits
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon
              const isClickable = benefit.link
              const cardContent = (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-6 rounded-xl bg-white/5 hover:bg-white/10 transition-colors ${isClickable ? 'cursor-pointer ring-2 ring-blue-400/50 hover:ring-blue-500' : ''}`}
                >
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-blue-100">
                    {benefit.description}
                  </p>
                </motion.div>
              )
              return isClickable ? (
                <Link href={benefit.link!} key={benefit.title} legacyBehavior>
                  <a style={{ textDecoration: 'none' }}>{cardContent}</a>
                </Link>
              ) : cardContent
            })}
          </div>
        </div>

        {/* Business Solutions */}
        <div className="border-t border-blue-800 pt-16 mb-12">
          <h3 className="text-2xl font-bold text-center mb-10">
            Business Solutions
          </h3>
          
          {/* For Companies */}
          <div className="mb-12">
            <h4 className="text-xl font-semibold mb-6 text-blue-200">For Companies</h4>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {businessSolutions
                .filter(solution => solution.category === 'For Companies')
                .map((solution, index) => {
                  const Icon = solution.icon
                  return (
                    <motion.div
                      key={solution.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-6 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                        <Icon className="h-6 w-6 text-blue-400" />
                      </div>
                      <h4 className="text-lg font-semibold mb-2">
                        {solution.title}
                      </h4>
                      <p className="text-blue-100 text-sm">
                        {solution.description}
                      </p>
                    </motion.div>
                  )
                })}
            </div>
          </div>

          {/* For Freelancers */}
          <div className="mb-12">
            <h4 className="text-xl font-semibold mb-6 text-blue-200">For Freelancers</h4>
            <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
              {businessSolutions
                .filter(solution => solution.category === 'For Freelancers')
                .map((solution, index) => {
                  const Icon = solution.icon
                  return (
                    <motion.div
                      key={solution.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-6 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                        <Icon className="h-6 w-6 text-blue-400" />
                      </div>
                      <h4 className="text-lg font-semibold mb-2">
                        {solution.title}
                      </h4>
                      <p className="text-blue-100 text-sm">
                        {solution.description}
                      </p>
                    </motion.div>
                  )
                })}
            </div>
          </div>
        </div>

        {/* Integrations and API Solutions */}
        <div className="border-t border-blue-800 pt-16 mb-12">
          <h3 className="text-2xl font-bold text-center mb-10">
            Integrations and API Solutions
          </h3>
          
          <div className="grid md:grid-cols-2 gap-8">
            {integrations.map((integration, index) => {
              const Icon = integration.icon
              return (
                <motion.div
                  key={integration.title}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 0.3 }}
                  className="flex bg-white/5 rounded-xl overflow-hidden cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <div className="w-16 flex-shrink-0 bg-blue-800/30 flex items-center justify-center">
                    <Icon className="h-8 w-8 text-blue-400" />
                  </div>
                  <div className="p-5">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                      {integration.module}
                    </span>
                    <h4 className="text-lg font-semibold mb-2 mt-1">
                      {integration.title}
                    </h4>
                    <p className="text-blue-100 text-sm">
                      {integration.description}
                    </p>
                  </div>
                </motion.div>
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
            <h3 className="text-xl font-medium mb-4">
              Why Blockchain for Global Business?
            </h3>
            <p className="max-w-2xl mx-auto text-blue-100 mb-6">
              Traditional international business faces challenges with trust, transparency, 
              and transaction costs. Our blockchain integration eliminates these barriers, 
              allowing you to operate globally with confidence.
            </p>
            <button className="px-6 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors font-medium">
              Learn More About Blockchain Integration
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  )
} 