export default function HelpSupportPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Help & Support</h1>
        <p className="text-blue-200">Get help with your account and find answers to common questions.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Documentation</h2>
          <p className="text-blue-200 mb-4">Browse our comprehensive documentation and guides.</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            View Documentation
          </button>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Contact Support</h2>
          <p className="text-blue-200 mb-4">Get in touch with our support team for assistance.</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Contact Support
          </button>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">FAQ</h2>
          <p className="text-blue-200 mb-4">Find answers to frequently asked questions.</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Browse FAQ
          </button>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Community</h2>
          <p className="text-blue-200 mb-4">Join our community forum and connect with other users.</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Join Community
          </button>
        </div>
      </div>
    </div>
  );
} 