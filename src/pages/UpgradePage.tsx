import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Crown,
  Check,
  Zap,
  Users,
  Clock,
  Shield,
  Star,
  ArrowLeft,
  CreditCard,
  Video,
  Mic,
  Bot,
  Cloud
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const plans = [
  {
    name: 'Free',
    price: 0,
    currency: 'USD',
    period: 'month',
    description: 'Perfect for trying out our platform',
    features: [
      '5 meetings per month',
      '30 minutes per meeting',
      'Basic transcription',
      'Standard audio quality',
      'Email support'
    ],
    limitations: [
      'No video recording',
      'No speaker identification',
      'No AI chat assistance',
      'No cloud storage'
    ],
    buttonText: 'Current Plan',
    variant: 'outline' as const,
    popular: false
  },
  {
    name: 'Pro',
    price: 29,
    currency: 'USD',
    period: 'month',
    description: 'Ideal for professionals and small teams',
    features: [
      'Unlimited meetings',
      'Unlimited duration',
      'HD video recording',
      'Multi-speaker transcription',
      'AI chat assistant',
      '50GB cloud storage',
      'Real-time collaboration',
      'Priority support'
    ],
    limitations: [],
    buttonText: 'Upgrade to Pro',
    variant: 'default' as const,
    popular: true
  },
  {
    name: 'Enterprise',
    price: 99,
    currency: 'USD',
    period: 'month',
    description: 'Advanced features for large organizations',
    features: [
      'Everything in Pro',
      'Advanced analytics',
      'Custom integrations',
      'SSO authentication',
      'Unlimited cloud storage',
      'API access',
      'Custom branding',
      'Dedicated support',
      'SLA guarantee'
    ],
    limitations: [],
    buttonText: 'Contact Sales',
    variant: 'secondary' as const,
    popular: false
  }
];

export const UpgradePage = () => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleUpgrade = async (planName: string, price: number) => {
    if (!user) {
      toast.error('Please sign in to upgrade');
      return;
    }

    if (planName === 'Enterprise') {
      window.open('mailto:sales@example.com?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }

    setIsProcessing(true);
    setSelectedPlan(planName);

    try {
      // Create order via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('create-payment-order', {
        body: {
          amount: price * 100, // Convert to cents
          currency: 'USD',
          plan_name: planName,
          user_id: user.id
        }
      });

      if (error) throw error;

      // Initialize Razorpay
      const options = {
        key: 'rzp_test_key', // This will be replaced with actual key from env
        amount: price * 100,
        currency: 'USD',
        name: 'Meeting Transcription Pro',
        description: `${planName} Plan Subscription`,
        order_id: data.order_id,
        handler: async (response: any) => {
          try {
            // Verify payment
            const verifyResponse = await supabase.functions.invoke('verify-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_name: planName,
                user_id: user.id
              }
            });

            if (verifyResponse.error) throw verifyResponse.error;

            toast.success(`Successfully upgraded to ${planName} plan!`);
            
            // Redirect to dashboard
            window.location.href = '/';
          } catch (error) {
            console.error('Payment verification failed:', error);
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: user.user_metadata?.full_name || '',
          email: user.email || ''
        },
        theme: {
          color: '#3B82F6'
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            setSelectedPlan(null);
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error) {
      console.error('Payment initialization failed:', error);
      toast.error('Failed to initialize payment. Please try again.');
      setIsProcessing(false);
      setSelectedPlan(null);
    }
  };

  React.useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link 
              to="/" 
              className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </Link>
            <div className="flex items-center space-x-2">
              <Crown className="w-6 h-6 text-yellow-500" />
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                Upgrade Your Plan
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full">
              <Zap className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Unlock Premium Features
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Get unlimited meetings, HD recording, AI assistance, and advanced transcription features
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Video className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">HD Recording</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Crystal clear video and audio recording
            </p>
          </div>
          
          <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Mic className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Multi-Speaker</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Identify and transcribe multiple speakers
            </p>
          </div>
          
          <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Bot className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">AI Assistant</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Smart meeting insights and summaries
            </p>
          </div>
          
          <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Cloud className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Cloud Storage</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Secure cloud storage for all recordings
            </p>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => (
            <Card 
              key={plan.name} 
              className={`relative ${plan.popular ? 'ring-2 ring-blue-500 shadow-lg' : ''} transition-all duration-200 hover:shadow-lg`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-1">
                    <Star className="w-3 h-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                  {plan.name}
                </CardTitle>
                <div className="flex items-center justify-center mt-4">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">
                    ${plan.price}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">
                    /{plan.period}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mt-2">
                  {plan.description}
                </p>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center">
                      <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>

                {plan.limitations.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Limitations:
                      </p>
                      {plan.limitations.map((limitation, index) => (
                        <div key={index} className="flex items-center">
                          <div className="w-5 h-5 mr-3 flex-shrink-0 flex items-center justify-center">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {limitation}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <Button
                  onClick={() => handleUpgrade(plan.name, plan.price)}
                  variant={plan.variant}
                  className="w-full mt-6"
                  disabled={isProcessing || plan.name === 'Free'}
                >
                  {isProcessing && selectedPlan === plan.name ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      {plan.name !== 'Free' && (
                        <CreditCard className="w-4 h-4 mr-2" />
                      )}
                      {plan.buttonText}
                    </div>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trust Indicators */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Trusted by Professionals
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Join thousands of users who trust our platform for their meeting needs
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Secure & Private
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                End-to-end encryption and secure cloud storage
              </p>
            </div>

            <div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                24/7 Support
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Dedicated support team ready to help you succeed
              </p>
            </div>

            <div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                99.9% Uptime
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Reliable service you can count on for important meetings
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};