
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Crown, Zap, Star, Sparkles, Gem, Rocket, Brain } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { loadRazorpay } from '@/utils/razorpayLoader';
import { toast } from 'sonner';

interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
}

export const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({ isOpen, onClose, onUpgrade }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; vx: number; vy: number }>>([]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Generate floating particles
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      }));
      setParticles(newParticles);

      // Animate particles
      const interval = setInterval(() => {
        setParticles(prev => prev.map(particle => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vx: particle.x > window.innerWidth || particle.x < 0 ? -particle.vx : particle.vx,
          vy: particle.y > window.innerHeight || particle.y < 0 ? -particle.vy : particle.vy,
        })));
      }, 50);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      // Load Razorpay script
      await loadRazorpay();

      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: {
          amount: 2999, // ₹29.99
          currency: 'INR',
          receipt: `upgrade_${Date.now()}`,
          notes: {
            plan: 'pro_monthly',
            upgrade_date: new Date().toISOString()
          }
        }
      });

      if (error) throw error;

      // Initialize Razorpay checkout
      const options = {
        key: process.env.RAZORPAY_KEY_ID || 'rzp_test_your_key_here',
        amount: data.amount,
        currency: data.currency,
        name: 'AI Meeting Pro',
        description: 'Upgrade to Pro Plan - Unlimited Meetings',
        order_id: data.id,
        handler: async (response: any) => {
          toast.success('🎉 Welcome to Pro! Your upgrade is complete!', {
            description: 'All premium features are now unlocked!'
          });
          onUpgrade?.();
          onClose();
        },
        prefill: {
          name: 'Valued Customer',
          email: 'customer@example.com',
        },
        theme: {
          color: '#6366f1'
        },
        modal: {
          backdropclose: false,
          escape: false,
          handleback: false,
        }
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to initialize payment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Zap, title: 'Unlimited Meetings', desc: 'No time limits, transcribe forever' },
    { icon: Brain, title: 'Advanced AI Chat', desc: 'Context-aware meeting assistant' },
    { icon: Star, title: 'Premium Analytics', desc: 'Deep insights & visualizations' },
    { icon: Gem, title: 'Priority Support', desc: '24/7 dedicated assistance' },
    { icon: Rocket, title: 'Early Access', desc: 'New features before anyone else' },
    { icon: Sparkles, title: 'Export Options', desc: 'PDF, Word, PowerPoint exports' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl"
          style={{
            background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99, 102, 241, 0.3) 0%, rgba(0, 0, 0, 0.8) 50%)`
          }}
        >
          {/* Floating particles */}
          {particles.map(particle => (
            <motion.div
              key={particle.id}
              className="absolute w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-600 rounded-full opacity-70"
              style={{
                left: particle.x,
                top: particle.y,
              }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: particle.id * 0.1,
              }}
            />
          ))}

          <motion.div
            initial={{ scale: 0.8, opacity: 0, rotateY: -30 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            exit={{ scale: 0.8, opacity: 0, rotateY: 30 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="relative w-full max-w-4xl mx-4"
          >
            <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900/95 via-purple-900/30 to-blue-900/95 border-2 border-gradient-to-r from-purple-500/50 to-blue-500/50 backdrop-blur-2xl shadow-2xl">
              {/* Holographic overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-50" />
              
              {/* Animated glow effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-green-500/20"
                animate={{
                  background: [
                    'linear-gradient(45deg, rgba(168, 85, 247, 0.2), rgba(59, 130, 246, 0.2), rgba(34, 197, 94, 0.2))',
                    'linear-gradient(45deg, rgba(59, 130, 246, 0.2), rgba(34, 197, 94, 0.2), rgba(168, 85, 247, 0.2))',
                    'linear-gradient(45deg, rgba(34, 197, 94, 0.2), rgba(168, 85, 247, 0.2), rgba(59, 130, 246, 0.2))',
                  ]
                }}
                transition={{ duration: 8, repeat: Infinity }}
              />

              <CardHeader className="relative z-10 text-center pb-8">
                <motion.div
                  className="flex items-center justify-between mb-6"
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-white/80 hover:text-white hover:bg-white/10 rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </motion.div>

                <motion.div
                  className="relative mb-6"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3, type: "spring", damping: 15 }}
                >
                  <div className="relative mx-auto w-24 h-24 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-full flex items-center justify-center">
                    <Crown className="w-12 h-12 text-white" />
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-yellow-400/50 to-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <CardTitle className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-2">
                    Upgrade to Pro
                  </CardTitle>
                  <p className="text-xl text-white/80 mb-4">
                    Unlock unlimited meetings & advanced AI features
                  </p>
                  <div className="flex items-center justify-center space-x-2">
                    <motion.div
                      className="text-5xl font-bold text-white"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      ₹29.99
                    </motion.div>
                    <div className="text-white/60">
                      <div className="text-sm">per month</div>
                      <div className="text-xs line-through">₹99.99</div>
                    </div>
                  </div>
                  <Badge className="mt-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
                    70% OFF Limited Time
                  </Badge>
                </motion.div>
              </CardHeader>

              <CardContent className="relative z-10">
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  {features.map((feature, index) => (
                    <motion.div
                      key={feature.title}
                      initial={{ x: index % 2 === 0 ? -50 : 50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.5 + index * 0.1, type: "spring" }}
                      className="flex items-center space-x-4 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 group"
                    >
                      <motion.div
                        className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                      >
                        <feature.icon className="w-6 h-6 text-white" />
                      </motion.div>
                      <div>
                        <h3 className="font-semibold text-white text-lg">{feature.title}</h3>
                        <p className="text-white/70 text-sm">{feature.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  className="flex flex-col sm:flex-row gap-4 justify-center"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <Button
                    onClick={handleUpgrade}
                    disabled={isLoading}
                    className="relative px-12 py-6 text-lg font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white border-0 rounded-2xl hover:shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 group overflow-hidden"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      animate={{ x: [-100, 100] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                    <span className="relative z-10 flex items-center">
                      {isLoading ? (
                        <>
                          <motion.div
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full mr-2"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Rocket className="w-5 h-5 mr-2" />
                          Upgrade Now
                        </>
                      )}
                    </span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="px-8 py-6 text-lg border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 rounded-2xl backdrop-blur-sm"
                  >
                    Maybe Later
                  </Button>
                </motion.div>

                <motion.p
                  className="text-center text-white/60 text-sm mt-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  Secure payment powered by Razorpay • Cancel anytime • No hidden fees
                </motion.p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
