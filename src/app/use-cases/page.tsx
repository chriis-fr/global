'use client'

import { 
  Building, 
  User, 
  Globe, 
  Shield,
  Rocket,
  FileText,
  Receipt,
  CreditCard
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'

// Lazy load heavy components
const Header = dynamic(() => import('@/components/landing/header').then(mod => ({ default: mod.Header })), { ssr: true })
const Footer = dynamic(() => import('@/components/landing/footer').then(mod => ({ default: mod.Footer })), { ssr: true })

// Products - matching header dropdown
const products = [
  {
    title: 'Smart Invoicing',
    description: 'Create and manage invoices with blockchain security',
    icon: FileText,
    features: [
      'Blockchain-secured invoice creation',
      'Multi-currency support',
      'Automated payment tracking',
      'Professional invoice templates'
    ],
    color: 'from-blue-300 to-blue-900'
  },
  {
    title: 'Accounts Payable',
    description: 'Manage your business payments efficiently',
    icon: Receipt,
    features: [
      'Streamlined bill management',
      'Automated payment processing',
      'Vendor relationship management',
      'Payment approval workflows'
    ],
    color: 'from-blue-300 to-blue-900'
  },
  {
    title: 'Accounts Receivable',
    description: 'Get paid in crypto & fiat legally',
    icon: CreditCard,
    features: [
      'Crypto and fiat payment acceptance',
      'Automated payment reminders',
      'Real-time payment tracking',
      'Multi-currency invoicing'
    ],
    color: 'from-blue-300 to-blue-900'
  },
  {
    title: 'Global Payments',
    description: 'Cross-border transactions with minimal fees',
    icon: Globe,
    features: [
      'Cross-border payment processing',
      'Low transaction fees',
      'Multi-currency support',
      'Real-time exchange rates'
    ],
    color: 'from-blue-300 to-blue-900'
  }
]

// Solutions - matching header dropdown
const solutions = [
  {
    title: 'For Companies',
    description: 'Enterprise solutions for large organizations',
    icon: Building,
    features: [
      'Multi-currency invoicing and payments',
      'Automated accounts payable/receivable',
      'Compliance and audit trails',
      'Integration with existing ERP systems'
    ],
    color: 'from-blue-300 to-blue-900'
  },
  {
    title: 'For Freelancers',
    description: 'Simple tools for independent contractors',
    icon: User,
    features: [
      'Simple invoice creation and management',
      'Crypto and fiat payment acceptance',
      'Automated payment reminders',
      'Professional invoice templates'
    ],
    color: 'from-blue-300 to-blue-900'
  },
  {
    title: 'For Startups',
    description: 'Scalable solutions for growing businesses',
    icon: Rocket,
    features: [
      'Scalable payment infrastructure',
      'Multi-country business operations',
      'Real-time financial reporting',
      'API integration capabilities'
    ],
    color: 'from-blue-300 to-blue-900'
  },
  {
    title: 'For Enterprises',
    description: 'Custom solutions for complex needs',
    icon: Shield,
    features: [
      'Regulatory compliance tools',
      'Advanced security features',
      'Custom integration APIs',
      'White-label solutions'
    ],
    color: 'from-blue-300 to-blue-900'
  }
]

export default function UseCasesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br crossBg from-gray-50 to-gray-100">
      <Header />
      
      {/* Hero Section - Matching landing page theme - Render immediately for LCP */}
      <div className="pt-16 bg-gradient-to-br from-blue-900 to-blue-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <Image
                src="/chainsnobg.png"
                alt="Global Finance"
                width={80}
                height={80}
                className="bg-white rounded-xl"
                priority
                fetchPriority="high"
                quality={90}
              />
            </div>
            <h1 
              className="text-4xl md:text-6xl font-bold mb-6"
              style={{ contentVisibility: 'auto' }}
            >
              Products & Solutions
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Discover how Global Finance transforms business operations with blockchain-secured financial solutions
            </p>
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="max-w-7xl mx-auto px-4 crossB sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Our Products</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Powerful tools designed to streamline your financial operations
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-20">
          {products.map((product) => {
            const Icon = product.icon
            return (
              <div
                key={product.title}
                className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300"
                style={{ contentVisibility: 'auto' }}
              >
                <div className={`bg-gradient-to-r ${product.color} p-6 text-white`}>
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{product.title}</h3>
                      <p className="text-blue-100 text-sm mt-1">{product.description}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Key Features:</h4>
                  <ul className="space-y-3 mb-6">
                    {product.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-600 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>

        {/* Solutions Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Solutions by Business Type</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Tailored solutions for different business sizes and needs
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-20">
          {solutions.map((solution) => {
            const Icon = solution.icon
            return (
              <div
                key={solution.title}
                className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300"
                style={{ contentVisibility: 'auto' }}
              >
                <div className={`bg-gradient-to-r ${solution.color} p-6 text-white`}>
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{solution.title}</h3>
                      <p className="text-blue-100 text-sm mt-1">{solution.description}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Key Features:</h4>
                  <ul className="space-y-3 mb-6">
                    {solution.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-600 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA Section - Matching pricing page style */}
        <div className="text-center bg-white rounded-2xl shadow-lg border border-gray-200 p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto text-lg">
            Join businesses already using Global Finance to streamline their operations and expand globally.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/pricing"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center"
            >
              View Pricing
            </Link>
            <Link
              href="/auth"
              className="border border-blue-600 text-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors font-medium text-center"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
} 