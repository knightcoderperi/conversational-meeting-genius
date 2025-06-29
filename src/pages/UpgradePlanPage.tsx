
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, Star, Zap, Crown, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { loadRazorpay } from '@/utils/razorpayLoader';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    duration: 'Forever',
    description: 'Perfect for trying out our AI meeting assistant',
    features: [
      '5 meetings per month',
      'Basic transcription',
      'Simple AI chat',
      'Export summaries',
      'Email support'
    ],
    limitations: [
      'Limited meeting duration (30 min)',
      'Basic analytics only',
      'Standard transcription accuracy'
    ],
    color: 'from-gray-500 to-slate-500',
    icon: Sparkles,
    popular: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 999,
    duration: 'per month',
    description: 'Advanced AI features for professionals',
    features: [
      'Unlimited meetings',
      'Advanced multi-speaker transcription',
      'Intelligent AI chatbot',
      'Real-time analytics',
      'Speaker identification',
      'Meeting insights & summaries',
      'Export to multiple formats',
      'Priority support'
    ],
    limitations: [],
    color: 'from-blue-500 to-cyan-500',
    icon: Zap,
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 2999,
    duration: 'per month',
    description: 'Ultimate AI-powered meeting solution for teams',
    features: [
      'Everything in Pro',
      'Unlimited meeting duration',
      'Advanced speaker analytics',
      'Custom AI training',
      'API access',
      'Team collaboration tools',
      'Custom integrations',
      'Dedicated account manager',
      'White-label options'
    ],
    limitations: [],
    color: 'from-purple-500 to-pink-500',
    icon: Crown,
    popular: false
  }
];

export const UpgradePlanPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const handlePlanUpgrade = async (planId: string, amount: number) => {
    if (!user) {
      toast.error('Please login to upgrade your plan');
      navigate('/auth');
      return;
    }

    if (planId === 'free') {
      toast.info('You are already on the free plan');
      return;
    }

    setLoading(planId);

    try {
      // Create Razorpay order
      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: {
          amount: amount,
          currency: 'INR',
          receipt: `upgrade_${planId}_${Date.now()}`,
          notes: {
            plan_id: planId,
            user_id: user.id,
            plan_name: plans.find(p => p.id === planId)?.name
          }
        }
      });

      if (error) {
        throw error;
      }

      // Load Razorpay script
      const Razorpay = await loadRazorpay();

      // Configure Razorpay options
      const options = {
        key: 'rzp_test_your_key_here', // Replace with your Razorpay key
        amount: data.amount,
        currency: data.currency,
        name: 'OmniMeet',
        description: `Upgrade to ${plans.find(p => p.id === planId)?.name} Plan`,
        image: '/lovable-uploads/9edb3bf5-360c-407d-a8a0-289819c45c66.png',
        order_id: data.id,
        handler: function (response: any) {
          handlePaymentSuccess(response, planId);
        },
        prefill: {
          name: user.user_metadata?.full_name || user.email,
          email: user.email,
          contact: user.user_metadata?.phone || ''
        },
        notes: {
          plan_id: planId,
          user_id: user.id
        },
        theme: {
          color: '#8B5CF6'
        }
      };

      const rzp = new Razorpay(options);
      
      rzp.on('payment.failed', function (response: any) {
        handlePaymentFailure(response);
      });

      // Open Razorpay checkout
      rzp.open();

    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Failed to initiate payment. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handlePaymentSuccess = async (response: any, planId: string) => {
    try {
      // Update user subscription in database
      const { error } = await supabase
        .from('user_profiles')
        .update({
          subscription_tier: planId,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (error) {
        throw error;
      }

      toast.success(`🎉 Successfully upgraded to ${plans.find(p => p.id === planId)?.name} plan!`);
      
      // Redirect to dashboard after successful upgrade
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Payment successful but failed to update subscription. Please contact support.');
    }
  };

  const handlePaymentFailure = (response: any) => {
    console.error('Payment failed:', response);
    toast.error('Payment failed. Please try again or contact support.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-xl border-b border-purple-500/20 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="flex items-center text-purple-300 hover:text-purple-100 transition-colors duration-200"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
              </Button>
              <div className="border-l border-purple-500/30 h-6"></div>
              <div className="flex items-center space-x-3">
                <img 
                  src="/lovable-uploads/9edb3bf5-360c-407d-a8a0-289819c45c66.png" 
                  alt="OmniMeet" 
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Upgrade Your Plan
                  </h1>
                  <p className="text-sm text-purple-300">
                    Unlock the full potential of AI-powered meetings
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Choose Your AI Meeting Experience
          </h2>
          <p className="text-xl text-purple-300 mb-8 max-w-3xl mx-auto">
            Transform your meetings with advanced AI transcription, intelligent chatbots, and powerful analytics. 
            Choose the plan that best fits your needs.
          </p>
          <div className="flex items-center justify-center space-x-2 text-emerald-400">
            <Check className="w-5 h-5" />
            <span className="text-sm">30-day money-back guarantee</span>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="relative"
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-1">
                    <Star className="w-3 h-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <Card className={`h-full ${
                plan.popular 
                  ? 'bg-gradient-to-br from-white/20 to-purple-900/40 border-2 border-purple-400 shadow-2xl shadow-purple-500/25' 
                  : 'bg-black/40 border border-purple-500/20'
              } backdrop-blur-xl`}>
                <CardHeader className="text-center pb-8">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r ${plan.color} flex items-center justify-center`}>
                    <plan.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  <CardTitle className="text-2xl font-bold text-white mb-2">
                    {plan.name}
                  </CardTitle>
                  
                  <div className="mb-4">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        ₹{plan.price}
                      </span>
                      <span className="text-sm text-purple-300 ml-2">
                        /{plan.duration}
                      </span>
                    </div>
                  </div>
                  
                  <CardDescription className="text-purple-300">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-4 mb-8">
                    <div>
                      <h4 className="font-semibold text-white mb-3 flex items-center">
                        <Check className="w-4 h-4 mr-2 text-emerald-400" />
                        Features Included:
                      </h4>
                      <ul className="space-y-2">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center text-sm text-purple-200">
                            <Check className="w-4 h-4 mr-3 text-emerald-400 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <Button
                    onClick={() => handlePlanUpgrade(plan.id, plan.price)}
                    disabled={loading === plan.id}
                    className={`w-full py-6 text-lg font-semibold ${
                      plan.popular
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg'
                        : plan.id === 'free'
                        ? 'bg-gray-600 hover:bg-gray-700 text-white'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white'
                    } transition-all duration-300`}
                  >
                    {loading === plan.id ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Processing...
                      </div>
                    ) : plan.id === 'free' ? (
                      'Current Plan'
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Features Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-black/40 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-8"
        >
          <h3 className="text-2xl font-bold text-white text-center mb-8">
            Why Choose OmniMeet?
          </h3>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Zap,
                title: 'Lightning Fast',
                description: 'Real-time transcription with <2s latency'
              },
              {
                icon: Star,
                title: 'AI-Powered',
                description: 'Advanced Groq-powered intelligence'
              },
              {
                icon: Crown,
                title: 'Multi-Speaker',
                description: 'Unlimited speaker identification'
              },
              {
                icon: Sparkles,
                title: 'Smart Analytics',
                description: 'Deep meeting insights & analytics'
              }
            ].map((feature, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold text-white mb-2">{feature.title}</h4>
                <p className="text-sm text-purple-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
