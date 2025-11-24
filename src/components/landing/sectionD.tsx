import Link from "next/link"

import { motion } from 'framer-motion'
import {
  Calculator,
  Coins,
  Code,
  Globe2
} from 'lucide-react'

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

const SectionD = () => {
    return(
        <div className="border-t border-blue-800 pt-16 mb-12">
          <h3 className="text-2xl font-bold text-center mb-10">
            Integrations and API Solutions
          </h3>
          
          <div className="grid md:grid-cols-2 gap-8">
            {integrations.map((integration, index) => {
              const Icon = integration.icon
              const cardContent = (
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
              return (
                <Link href={integration.link} key={integration.title} style={{ textDecoration: 'none' }}>
                  {cardContent}
                </Link>
              )
            })}
          </div>
        </div>
    )
}

export default SectionD;