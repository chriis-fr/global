import Link from "next/link"
import { 
    LockKeyhole, 
    History, 
    Banknote, 
    Network,
    ShieldCheck,
    Fingerprint,
    FileText,
} from 'lucide-react'
import { motion } from 'framer-motion'

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

const SectionB = () => {

    return(
        <div className="mb-16 mt-4 w-screen mx-[calc(50%-50vw)] border-4 border-black px-4 sm:px-6 lg:px-8 overflow-x-hidden">
          <h3 className="text-2xl font-bold text-center mb-10">
            Core Blockchain Benefits
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon
              const cardContent = (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-6 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer ring-2 ring-blue-400/50 hover:ring-blue-500"
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
              return (
                <Link href={benefit.link} key={benefit.title} style={{ textDecoration: 'none' }}>
                  {cardContent}
                </Link>
              )
            })}
          </div>
        </div>
    )
}

export default SectionB;