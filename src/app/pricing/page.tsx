'use client'

import { motion } from 'framer-motion'
import { 
  Check, 
  Zap,
  Shield,
  Crown,
  Users,
  Globe,
  Building
} from 'lucide-react'
import Image from 'next/image'
import { Header } from '@/components/landing/header'

const pricingPlans = [
  {
    name: 'Starter',
    price: '$29',
    period: '/month',
    description: 'Perfect for freelancers and small businesses',
    icon: Zap,
    color: 'from-blue-500 to-blue-600',
    features: [
      'Up to 50 invoices per month',
      'Basic invoice templates',
      'Crypto & fiat payments',
      'Email support',
      'Mobile app access',
      'Basic reporting'
    ],
    popular: false
  },
  {
    name: 'Professional',
    price: '$99',
    period: '/month',
    description: 'Ideal for growing businesses and teams',
    icon: Shield,
    color: 'from-purple-500 to-purple-600',
    features: [
      'Unlimited invoices',
      'Advanced invoice templates',
      'Multi-currency support',
      'Priority email support',
      'Team collaboration',
      'Advanced analytics',
      'API access',
      'Custom branding'
    ],
    popular: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations with complex needs',
    icon: Crown,
    color: 'from-orange-500 to-orange-600',
    features: [
      'Everything in Professional',
      'Custom integrations',
      'Dedicated account manager',
      '24/7 phone support',
      'Advanced security features',
      'Custom reporting',
      'White-label solutions',
      'SLA guarantees'
    ],
    popular: false
  }
]

const addOns = [
  {
    name: 'Additional Users',
    price: '$10',
    period: '/user/month',
    description: 'Add team members to your account',
    icon: Users
  },
  {
    name: 'Advanced Analytics',
    price: '$49',
    period: '/month',
    description: 'Get deeper insights into your business',
    icon: Globe
  },
  {
    name: 'Custom Integrations',
    price: 'From $500',
    period: '/setup',
    description: 'Connect with your existing systems',
    icon: Building
  }
]

export default function PricingPage() {
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
              Simple, Transparent Pricing
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-blue-100 max-w-3xl mx-auto"
            >
              Choose the plan that fits your business needs. All plans include our core features with no hidden fees.
            </motion.p>
          </div>
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {pricingPlans.map((plan, index) => {
            const Icon = plan.icon
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative bg-white rounded-2xl shadow-lg border-2 ${
                  plan.popular 
                    ? 'border-purple-500 shadow-purple-500/20' 
                    : 'border-gray-200'
                } overflow-hidden`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-purple-500 text-white text-center py-2 text-sm font-medium">
                    Most Popular
                  </div>
                )}
                
                <div className={`bg-gradient-to-r ${plan.color} p-6 text-white`}>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{plan.name}</h3>
                      <p className="text-blue-100 text-sm">{plan.description}</p>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-blue-100 ml-1">{plan.period}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <ul className="space-y-4">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start space-x-3">
                        <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <div className="mt-8">
                    <button className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                      plan.popular
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}>
                      {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Add-ons Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-20"
        >
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Additional Services
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {addOns.map((addon, index) => {
              const Icon = addon.icon
              return (
                <motion.div
                  key={addon.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{addon.name}</h3>
                      <p className="text-gray-600 text-sm">{addon.description}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-baseline justify-center">
                      <span className="text-2xl font-bold text-gray-900">{addon.price}</span>
                      <span className="text-gray-500 ml-1">{addon.period}</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-20 text-center"
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Frequently Asked Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 mb-2">Can I change plans anytime?</h3>
              <p className="text-gray-600">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 mb-2">Is there a free trial?</h3>
              <p className="text-gray-600">Yes, all plans come with a 14-day free trial. No credit card required to start.</p>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-600">We accept all major credit cards, PayPal, and bank transfers for annual plans.</p>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 mb-2">Do you offer refunds?</h3>
                             <p className="text-gray-600">Yes, we offer a 30-day money-back guarantee if you&apos;re not satisfied with our service.</p>
            </div>
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="text-center mt-16"
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses already using Global Solutions to streamline their operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Start Free Trial
            </button>
            <button className="border border-blue-600 text-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors font-medium">
              Contact Sales
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
} 