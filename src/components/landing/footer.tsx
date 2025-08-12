'use client'

import { 
  Mail, 
  Phone, 
  Linkedin, 
  Twitter, 
  MapPin, 
  Shield,
  Users,
  Building,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

const footerLinks = {
  product: [
    { name: 'Smart Invoicing', href: '/services' },
    { name: 'Accounts Payable', href: '/services' },
    { name: 'Accounts Receivable', href: '/services' },
    { name: 'Global Payments', href: '/services' },
    { name: 'API Solutions', href: '/services' }
  ],
  solutions: [
    { name: 'For Companies', href: '/services' },
    { name: 'For Freelancers', href: '/services' },
    { name: 'For Startups', href: '/services' },
    { name: 'For Enterprises', href: '/services' }
  ],
  company: [
    { name: 'About Us', href: '/about' },
    { name: 'Careers', href: '/careers' },
    { name: 'Press', href: '/press' },
    { name: 'Partners', href: '/partners' }
  ],
  support: [
    { name: 'Help Center', href: '/help' },
    { name: 'Documentation', href: '/docs' },
    { name: 'Contact Support', href: '/support' },
    { name: 'Status', href: '/status' }
  ],
  legal: [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Cookie Policy', href: '/cookies' },
    { name: 'GDPR', href: '/gdpr' }
  ]
}

const socialLinks = [
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com/company/chainserp',
    icon: Linkedin,
    color: 'hover:text-blue-600'
  },
  {
    name: 'X (Twitter)',
    href: 'https://x.com/chainserp',
    icon: Twitter,
    color: 'hover:text-black dark:hover:text-white'
  }
]

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                 <div className="grid grid-cols-1 lg:grid-cols-6 gap-8">
           {/* Company Info */}
           <div className="lg:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <Image
                src="/chainsnobg.png"
                alt="ChainsERP"
                width={40}
                height={40}
                className="bg-white rounded-lg"
              />
              <span className="text-xl font-bold">Chains ERP Global</span>
            </div>
            <p className="text-gray-300 text-sm mb-6 max-w-md">
              Blockchain-powered global business solutions. Enterprise-grade security and transparency 
              for modern international operations.
            </p>
            
            {/* Contact Info */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-sm text-gray-300">
                <Mail className="h-4 w-4 text-blue-400" />
                <a href="mailto:hello@chains-erp.com" className="hover:text-white transition-colors">
                  hello@chains-erp.com
                </a>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-300">
                <Phone className="h-4 w-4 text-blue-400" />
                <a href="tel:+254705343984" className="hover:text-white transition-colors">
                  +254 705 343 984
                </a>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-300">
                <MapPin className="h-4 w-4 text-blue-400" />
                <span>Nairobi, Kenya</span>
              </div>
            </div>
          </div>

                     {/* Product Links - Hidden on mobile */}
           <div className="hidden lg:block">
             <h3 className="text-sm font-semibold text-white mb-4 flex items-center">
               <Building className="h-4 w-4 mr-2 text-blue-400" />
               Product
             </h3>
             <ul className="space-y-2">
               {footerLinks.product.map((link) => (
                 <li key={link.name}>
                   <Link 
                     href={link.href}
                     className="text-sm text-gray-300 hover:text-white transition-colors flex items-center group"
                   >
                     <ArrowRight className="h-3 w-3 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                     {link.name}
                   </Link>
                 </li>
               ))}
             </ul>
           </div>

           {/* Solutions Links - Hidden on mobile */}
           <div className="hidden lg:block">
             <h3 className="text-sm font-semibold text-white mb-4 flex items-center">
               <Users className="h-4 w-4 mr-2 text-blue-400" />
               Solutions
             </h3>
             <ul className="space-y-2">
               {footerLinks.solutions.map((link) => (
                 <li key={link.name}>
                   <Link 
                     href={link.href}
                     className="text-sm text-gray-300 hover:text-white transition-colors flex items-center group"
                   >
                     <ArrowRight className="h-3 w-3 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                     {link.name}
                   </Link>
                 </li>
               ))}
             </ul>
           </div>

           {/* Company Links - Hidden on mobile */}
           <div className="hidden lg:block">
             <h3 className="text-sm font-semibold text-white mb-4 flex items-center">
               <Building className="h-4 w-4 mr-2 text-blue-400" />
               Company
             </h3>
             <ul className="space-y-2">
               {footerLinks.company.map((link) => (
                 <li key={link.name}>
                   <Link 
                     href={link.href}
                     className="text-sm text-gray-300 hover:text-white transition-colors flex items-center group"
                   >
                     <ArrowRight className="h-3 w-3 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                     {link.name}
                   </Link>
                 </li>
               ))}
             </ul>
           </div>

           {/* Support & Legal - Hidden on mobile */}
           <div className="hidden lg:block">
             <h3 className="text-sm font-semibold text-white mb-4 flex items-center">
               <Shield className="h-4 w-4 mr-2 text-blue-400" />
               Support & Legal
             </h3>
             <ul className="space-y-2">
               {footerLinks.support.map((link) => (
                 <li key={link.name}>
                   <Link 
                     href={link.href}
                     className="text-sm text-gray-300 hover:text-white transition-colors flex items-center group"
                   >
                     <ArrowRight className="h-3 w-3 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                     {link.name}
                   </Link>
                 </li>
               ))}
               <div className="border-t border-gray-700 mt-3 pt-3">
                 {footerLinks.legal.map((link) => (
                   <li key={link.name} className="mb-2">
                     <Link 
                       href={link.href}
                       className="text-xs text-gray-400 hover:text-white transition-colors flex items-center group"
                     >
                       <ArrowRight className="h-2 w-2 mr-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                       {link.name}
                     </Link>
                   </li>
                 ))}
               </div>
             </ul>
           </div>
        </div>

                 {/* Social Links */}
         <div className="border-t border-gray-800 mt-8 pt-8">
           <div className="flex justify-center">
             <div className="flex items-center space-x-4">
               <span className="text-sm text-gray-400">Follow us:</span>
               {socialLinks.map((social) => {
                 const Icon = social.icon
                 return (
                   <a
                     key={social.name}
                     href={social.href}
                     target="_blank"
                     rel="noopener noreferrer"
                     className={`p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors ${social.color}`}
                     aria-label={social.name}
                   >
                     <Icon className="h-4 w-4" />
                   </a>
                 )
               })}
             </div>
           </div>
         </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
                         <div className="flex items-center space-x-2 text-sm text-gray-400">
               <span>© 2025 Chains ERP Global. All rights reserved.</span>
             </div>
            
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>Last updated: {new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
} 