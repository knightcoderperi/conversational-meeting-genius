import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Star, Zap, Crown, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PricingTier {
  name: string;
  price: number;
  duration: string;
  features: string[];
  popular?: boolean;
  icon: React.ReactNode;
  razorpayPlanId: string;
}

export const UpgradePage: React.FC = () => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');

  const pricingTiers: PricingTier[] = [
    {
      name: 'Basic',
      price: 999,
      duration: '/month',
      features: [
        'Up to 10 hours of recording per month',
        'Basic transcription accuracy',
        'Standard AI chat support',
        'Export meeting summaries',
        'Email support'
      ],
      icon: <Star className="w-6 h-6" />,
      razorpayPlanId: 'plan_basic_monthly'
    },
    {
      name: 'Professional',
      price: 2499,
      duration: '/month',
      features: [
        'Up to 50 hours of recording per month',
        'Advanced multi-speaker transcription',
        'Premium AI analysis with insights',
        'Real-time collaboration features',
        'Custom integrations',
        'Priority support',
        'Advanced analytics dashboard'
      ],
      popular: true,
      icon: <Zap className="w-6 h-6" />,
      razorpayPlanId: 'plan_professional_monthly'
    },
    {
      name: 'Enterprise',
      price: 4999,
      duration: '/month',
      features: [
        'Unlimited recording hours',
        'Ultra-high accuracy transcription',
        'Custom AI models and training',
        'Advanced speaker identification',
        'API access and webhooks',
        'Dedicated account manager',
        'Custom branding options',
        'SLA guarantee'
      ],
      icon: <Crown className="w-6 h-6" />,
      razorpayPlanId: 'plan_enterprise_monthly'
    }
  ];

  const handleUpgrade = async (tier: PricingTier) => {
    if (!user) {
      toast.error('Please log in to upgrade your plan');
      return;
    }

    setIsProcessing(true);
    setSelectedPlan(tier.name);

    try {
      // Create order through Supabase edge function
      const { data, error } = await supabase.functions.invoke('create-payment-order', {
        body: {
          amount: tier.price * 100, // Convert to paise
          currency: 'INR',
          planName: tier.name,
          planId: tier.razorpayPlanId,
          userId: user.id
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data || !data.orderId) {
        throw new Error('Failed to create payment order');
      }

      // Initialize Razorpay
      const options = {
        key: 'rzp_test_9999999999', // This will be replaced by the actual key from environment
        amount: tier.price * 100,
        currency: 'INR',
        name: 'Meeting Transcription Pro',
        description: `${tier.name} Plan Subscription`,
        order_id: data.orderId,
        handler: async (response: any) => {
          try {
            // Verify payment
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                userId: user.id,
                planName: tier.name
              }
            });

            if (verifyError) {
              throw new Error('Payment verification failed');
            }

            toast.success(`Successfully upgraded to ${tier.name} plan!`);
            
            // Redirect to dashboard
            window.location.href = '/';
          } catch (error) {
            console.error('Payment verification error:', error);
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: user.email,
          email: user.email,
        },
        theme: {
          color: '#3B82F6'
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            setSelectedPlan('');
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to initiate payment. Please try again.');
    } finally {
      setIsProcessing(false);
      setSelectedPlan('');
    }
  };

  // Load Razorpay script
  React.useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link 
              to="/" 
              className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Upgrade Your Plan
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Perfect Plan
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Unlock the full potential of AI-powered meeting transcription and analysis. 
            Get more features, better accuracy, and priority support.
          </p>
          
          {/* Feature Highlights */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
            <div className="flex items-center space-x-3 p-4 bg-white/60 dark:bg-gray-800/60 rounded-lg backdrop-blur-sm">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900 dark:text-white">Advanced AI</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Multi-model AI support</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-4 bg-white/60 dark:bg-gray-800/60 rounded-lg backdrop-blur-sm">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900 dark:text-white">High Accuracy</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">99%+ transcription accuracy</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-4 bg-white/60 dark:bg-gray-800/60 rounded-lg backdrop-blur-sm">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Star className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900 dark:text-white">Premium Support</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Priority assistance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingTiers.map((tier) => (
            <Card 
              key={tier.name} 
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                tier.popular 
                  ? 'ring-2 ring-blue-500 shadow-lg transform scale-105' 
                  : 'hover:shadow-lg hover:-translate-y-1'
              }`}
            >
              {tier.popular && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-blue-500 to-purple-600 text-white px-4 py-1 text-sm font-medium">
                  Most Popular
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  tier.popular 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}>
                  {tier.icon}
                </div>
                
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {tier.name}
                </CardTitle>
                
                <div className="text-center">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">
                    ₹{tier.price.toLocaleString()}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300">{tier.duration}</span>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  onClick={() => handleUpgrade(tier)}
                  disabled={isProcessing}
                  className={`w-full ${
                    tier.popular
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
                      : ''
                  }`}
                  variant={tier.popular ? 'default' : 'outline'}
                >
                  {isProcessing && selectedPlan === tier.name ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </div>
                  ) : (
                    `Upgrade to ${tier.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Frequently Asked Questions
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  How accurate is the transcription?
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Our advanced AI provides 99%+ accuracy with multi-speaker identification and real-time processing.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Can I cancel anytime?
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Is my data secure?
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  All recordings and transcriptions are encrypted and stored securely. Your privacy is our top priority.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Do you offer refunds?
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  We offer a 30-day money-back guarantee if you're not satisfied with our service.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Badge */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center space-x-2 px-6 py-3 bg-white/60 dark:bg-gray-800/60 rounded-full backdrop-blur-sm">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Secure payments powered by Razorpay
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};