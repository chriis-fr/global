import Link from "next/link"
import {
    FileText,
    Receipt,
    Users,
    ArrowRight,
    ArrowLeft,
} from 'lucide-react'
import { motion } from 'framer-motion'

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


const SectionC = () => {

    return(
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
                  const cardContent = (
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
                  return (
                    <Link href={solution.link} key={solution.title} style={{ textDecoration: 'none' }}>
                      {cardContent}
                    </Link>
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
                  const cardContent = (
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
                  return (
                    <Link href={solution.link} key={solution.title} style={{ textDecoration: 'none' }}>
                      {cardContent}
                    </Link>
                  )
                })}
            </div>
          </div>
        </div>
    )
}

export default SectionC;