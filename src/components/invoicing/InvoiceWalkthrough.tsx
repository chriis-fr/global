'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Invoice } from '@/models/Invoice';

interface InvoiceWalkthroughData {
  step: number;
  completed: boolean;
  data?: Partial<Invoice>;
}

interface InvoiceWalkthroughProps {
  isOpen: boolean;
  onCloseAction: () => void;
  onCompleteAction: (invoiceData: InvoiceWalkthroughData) => void;
}

export default function InvoiceWalkthrough({ isOpen, onCloseAction, onCompleteAction }: InvoiceWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 9;

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      onCompleteAction({ step: currentStep, completed: true });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Create Invoice</h2>
            <button onClick={onCloseAction} className="text-white/80 hover:text-white">
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-white/20 rounded-full h-2">
            <div 
              className="bg-white h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm">Step {currentStep}/{totalSteps}</span>
            <span className="text-sm font-medium">
              {currentStep === 1 && 'Welcome'}
              {currentStep === 2 && 'Company Details'}
              {currentStep === 3 && 'Upload Logo'}
              {currentStep === 4 && 'Client Information'}
              {currentStep === 5 && 'Currency Selection'}
              {currentStep === 6 && 'Payment Method'}
              {currentStep === 7 && 'Payment Details'}
              {currentStep === 8 && 'Invoice Items'}
              {currentStep === 9 && 'Complete'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="text-center">
            <FileText className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Step {currentStep} - {currentStep === 1 ? 'Welcome to Invoice Creation' : 'In Progress'}
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              {currentStep === 1 && "Hi, you seem to be new to invoices. No worries, this is easy. We will guide you step by step through the flow."}
              {currentStep === 2 && "Check your details. Your invoices and other communications will include this information."}
              {currentStep === 3 && "Upload your company logo. Personalize your invoices with your company logo."}
              {currentStep === 4 && "Who is this invoice for? Improve your invoices' compliance for tax by entering additional details."}
              {currentStep === 5 && "Set your invoice currency. This is the currency that your invoice will be issued in."}
              {currentStep === 6 && "How do you want to get paid? Select the type of invoice you want: regular or recurring."}
              {currentStep === 7 && "Select how you want to receive your funds. Add your payment method in this step."}
              {currentStep === 8 && "List all items to get paid for. Choose the items and services you want to get paid for."}
              {currentStep === 9 && "Congratulations! You're all finished. Onboarding is now complete."}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              currentStep === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          <button
            onClick={handleNext}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>{currentStep === totalSteps ? 'Complete' : 'Next'}</span>
            {currentStep < totalSteps && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </motion.div>
    </div>
  );
} 