'use client'

import { motion } from 'framer-motion'
import { 
  Building, 
  User, 
  Globe, 
  Shield,
  Briefcase,
  Rocket
} from 'lucide-react'
import Image from 'next/image'
import { Header } from '@/components/landing/header'

const useCases = [
  {
    title: 'Enterprise Companies',
    description: 'Large organizations managing global operations',
    icon: Building,
    features: [
      'Multi-currency invoicing and payments',
      'Automated accounts payable/receivable',
      'Compliance and audit trails',
      'Integration with existing ERP systems'
    ],
    color: 'from-blue-500 to-blue-600'
  },
  {
    title: 'Freelancers & Contractors',
    description: 'Independent professionals getting paid globally',
    icon: User,
    features: [
      'Simple invoice creation and management',
      'Crypto and fiat payment acceptance',
      'Automated payment reminders',
      'Professional invoice templates'
    ],
    color: 'from-green-500 to-green-600'
  },
  {
    title: 'Startups & Scale-ups',
    description: 'Growing businesses with global ambitions',
    icon: Rocket,
    features: [
      'Scalable payment infrastructure',
      'Multi-country business operations',
      'Real-time financial reporting',
      'API integration capabilities'
    ],
    color: 'from-purple-500 to-purple-600'
  },
  {
    title: 'E-commerce Businesses',
    description: 'Online stores with international customers',
    icon: Globe,
    features: [
      'Global payment processing',
      'Multi-currency checkout',
      'Automated reconciliation',
      'Fraud protection and security'
    ],
    color: 'from-orange-500 to-orange-600'
  },
  {
    title: 'Financial Services',
    description: 'Banks and fintech companies',
    icon: Shield,
    features: [
      'Regulatory compliance tools',
      'Advanced security features',
      'Custom integration APIs',
      'White-label solutions'
    ],
    color: 'from-red-500 to-red-600'
  },
  {
    title: 'Consulting Firms',
    description: 'Professional services with global clients',
    icon: Briefcase,
    features: [
      'Project-based invoicing',
      'Time tracking integration',
      'Client portal access',
      'Multi-language support'
    ],
    color: 'from-indigo-500 to-indigo-600'
  }
]

export default function UseCasesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* Hero Section */}
      <div className="pt-16 bg-gradient-to-br from-blue-900 to-blue-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center mb-6"
            >
              <Image
                src="/chainsnobg.png"
                alt="Global Solutions"
                width={80}
                height={80}
                className="bg-white rounded-xl"
              />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl font-bold mb-6"
            >
              Use Cases
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-blue-100 max-w-3xl mx-auto"
            >
              Discover how Global Solutions transforms business operations across different industries and company sizes
            </motion.p>
          </div>
        </div>
      </div>

      {/* Use Cases Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {useCases.map((useCase, index) => {
            const Icon = useCase.icon
            return (
              <motion.div
                key={useCase.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow"
              >
                {/* Header */}
                <div className={`bg-gradient-to-r ${useCase.color} p-6 text-white`}>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{useCase.title}</h3>
                      <p className="text-blue-100 text-sm">{useCase.description}</p>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Key Features:</h4>
                  <ul className="space-y-3">
                    {useCase.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-600 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <div className="mt-6">
                    <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                      Learn More
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-16"
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses already using Global Solutions to streamline their operations and expand globally.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Get Started Free
            </button>
            <button className="border border-blue-600 text-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors font-medium">
              Schedule Demo
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
} 