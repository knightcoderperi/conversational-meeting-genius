
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Crown, Zap, Star, Sparkles, Gem, Rocket, Brain, Target, Eye, Activity, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { loadRazorpay } from '@/utils/razorpayLoader';
import { toast } from 'sonner';

interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
}

export const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({ isOpen, onClose, onUpgrade }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [particles, setParticles] = useState<Array<{ 
    id: number; 
    x: number; 
    y: number; 
    vx: number; 
    vy: number; 
    color: string; 
    size: number;
    opacity: number;
  }>>([]);

  // Premium cursor tracking
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const cursorX = useSpring(mouseX, { stiffness: 500, damping: 28 });
  const cursorY = useSpring(mouseY, { stiffness: 500, damping: 28 });

  // Transform mouse position for background effects
  const backgroundX = useTransform(mouseX, [0, window.innerWidth], [0, 100]);
  const backgroundY = useTransform(mouseY, [0, window.innerHeight], [0, 100]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  useEffect(() => {
    if (isOpen) {
      // Generate premium particle system
      const particleColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
      const newParticles = Array.from({ length: 80 }, (_, i) => ({
        id: i,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
        size: Math.random() * 4 + 1,
        opacity: Math.random() * 0.8 + 0.2
      }));
      setParticles(newParticles);

      // Animate particles with physics
      const interval = setInterval(() => {
        setParticles(prev => prev.map(particle => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vx: particle.x > window.innerWidth || particle.x < 0 ? -particle.vx * 0.98 : particle.vx,
          vy: particle.y > window.innerHeight || particle.y < 0 ? -particle.vy * 0.98 : particle.vy,
          opacity: Math.sin(Date.now() * 0.002 + particle.id) * 0.4 + 0.5
        })));
      }, 60);

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
    { icon: Zap, title: '⚡ Unlimited Meetings', desc: 'No time limits, transcribe forever', gradient: 'from-yellow-400 to-orange-500' },
    { icon: Brain, title: '🧠 Advanced AI Chat', desc: 'Context-aware meeting assistant', gradient: 'from-purple-400 to-pink-500' },
    { icon: Target, title: '🎯 Premium Analytics', desc: 'Deep insights & visualizations', gradient: 'from-blue-400 to-cyan-500' },
    { icon: Award, title: '🏆 Priority Support', desc: '24/7 dedicated assistance', gradient: 'from-green-400 to-emerald-500' },
    { icon: Rocket, title: '🚀 Early Access', desc: 'New features before anyone else', gradient: 'from-red-400 to-pink-500' },
    { icon: Sparkles, title: '✨ Export Options', desc: 'PDF, Word, PowerPoint exports', gradient: 'from-indigo-400 to-purple-500' },
  ];

  const magneticVariants = {
    rest: { scale: 1, rotateZ: 0 },
    hover: { 
      scale: 1.05, 
      rotateZ: 2,
      transition: {
        type: "spring" as const,
        stiffness: 400,
        damping: 17
      }
    },
    tap: { 
      scale: 0.95,
      rotateZ: -1,
      transition: {
        type: "spring" as const,
        stiffness: 600,
        damping: 20
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background: `radial-gradient(circle at ${backgroundX}% ${backgroundY}%, rgba(99, 102, 241, 0.4) 0%, rgba(0, 0, 0, 0.95) 60%)`,
            backdropFilter: 'blur(20px) saturate(180%)'
          }}
        >
          {/* Premium particle system */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map(particle => (
              <motion.div
                key={particle.id}
                className="absolute rounded-full blur-sm"
                style={{
                  width: particle.size,
                  height: particle.size,
                  backgroundColor: particle.color,
                  left: particle.x,
                  top: particle.y,
                  opacity: particle.opacity,
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  rotate: [0, 180, 360],
                }}
                transition={{
                  duration: 4 + Math.random() * 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>

          {/* Dynamic cursor trail */}
          <motion.div
            className="fixed w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full pointer-events-none z-50 mix-blend-difference"
            style={{
              x: cursorX,
              y: cursorY,
              translateX: '-50%',
              translateY: '-50%'
            }}
            animate={{
              scale: [1, 1.3, 1],
              rotate: [0, 180, 360]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear"
            }}
          />

          <motion.div
            initial={{ scale: 0.7, opacity: 0, rotateY: -45, z: -200 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0, z: 0 }}
            exit={{ scale: 0.7, opacity: 0, rotateY: 45, z: -200 }}
            transition={{ 
              type: "spring" as const, 
              damping: 25, 
              stiffness: 120,
              duration: 0.8
            }}
            className="relative w-full max-w-5xl mx-4"
          >
            <Card className="relative overflow-hidden bg-black/40 backdrop-blur-3xl border-2 shadow-2xl">
              {/* Holographic overlay effects */}
              <motion.div 
                className="absolute inset-0 opacity-30"
                animate={{
                  background: [
                    'linear-gradient(45deg, rgba(59, 130, 246, 0.3), rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3))',
                    'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3), rgba(59, 130, 246, 0.3))',
                    'linear-gradient(225deg, rgba(236, 72, 153, 0.3), rgba(59, 130, 246, 0.3), rgba(139, 92, 246, 0.3))',
                    'linear-gradient(315deg, rgba(59, 130, 246, 0.3), rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3))'
                  ]
                }}
                transition={{ duration: 8, repeat: Infinity }}
                style={{
                  borderImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent) 1'
                }}
              />
              
              {/* Animated border glow */}
              <motion.div
                className="absolute inset-0 rounded-lg"
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.3), 0 0 60px rgba(236, 72, 153, 0.2)',
                    '0 0 30px rgba(139, 92, 246, 0.5), 0 0 50px rgba(236, 72, 153, 0.3), 0 0 70px rgba(59, 130, 246, 0.2)',
                    '0 0 25px rgba(236, 72, 153, 0.5), 0 0 45px rgba(59, 130, 246, 0.3), 0 0 65px rgba(139, 92, 246, 0.2)',
                    '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.3), 0 0 60px rgba(236, 72, 153, 0.2)'
                  ]
                }}
                transition={{ duration: 4, repeat: Infinity }}
              />

              <CardHeader className="relative z-10 text-center pb-8">
                <motion.div
                  className="flex items-center justify-between mb-8"
                  initial={{ y: -30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <div />
                  <motion.div
                    variants={magneticVariants}
                    initial="rest"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      className="text-white/80 hover:text-white hover:bg-white/10 rounded-full w-12 h-12"
                    >
                      <X className="w-6 h-6" />
                    </Button>
                  </motion.div>
                </motion.div>

                <motion.div
                  className="relative mb-8"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.4, type: "spring" as const, damping: 15 }}
                >
                  <div className="relative mx-auto w-32 h-32 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-full flex items-center justify-center">
                    <Crown className="w-16 h-16 text-white" />
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-yellow-400/60 to-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    />
                    {/* Crown jewels effect */}
                    {Array.from({ length: 8 }).map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-white rounded-full"
                        style={{
                          left: `${50 + 35 * Math.cos(i * Math.PI / 4)}%`,
                          top: `${50 + 35 * Math.sin(i * Math.PI / 4)}%`,
                        }}
                        animate={{
                          scale: [0, 1, 0],
                          opacity: [0, 1, 0]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: i * 0.2
                        }}
                      />
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <CardTitle className="text-5xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-4">
                    🚀 Upgrade to Pro
                  </CardTitle>
                  <motion.p 
                    className="text-2xl text-white/90 mb-6"
                    animate={{ opacity: [0.9, 1, 0.9] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    Unlock unlimited meetings & revolutionary AI features
                  </motion.p>
                  <div className="flex items-center justify-center space-x-4">
                    <motion.div
                      className="text-6xl font-bold text-white"
                      animate={{ 
                        scale: [1, 1.05, 1],
                        textShadow: [
                          "0 0 20px rgba(255,255,255,0.8)",
                          "0 0 40px rgba(255,255,255,1)",
                          "0 0 20px rgba(255,255,255,0.8)"
                        ]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      ₹29.99
                    </motion.div>
                    <div className="text-white/70">
                      <div className="text-lg">per month</div>
                      <div className="text-base line-through">₹99.99</div>
                    </div>
                  </div>
                  <motion.div
                    animate={{ 
                      scale: [1, 1.05, 1],
                      rotate: [0, 2, -2, 0]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Badge className="mt-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 px-4 py-2 text-lg">
                      🔥 70% OFF Limited Time
                    </Badge>
                  </motion.div>
                </motion.div>
              </CardHeader>

              <CardContent className="relative z-10">
                <div className="grid md:grid-cols-2 gap-6 mb-12">
                  {features.map((feature, index) => (
                    <motion.div
                      key={feature.title}
                      initial={{ x: index % 2 === 0 ? -80 : 80, opacity: 0, rotateY: index % 2 === 0 ? -20 : 20 }}
                      animate={{ x: 0, opacity: 1, rotateY: 0 }}
                      transition={{ 
                        delay: 0.6 + index * 0.1, 
                        type: "spring" as const,
                        damping: 20,
                        stiffness: 100
                      }}
                      whileHover={{ 
                        scale: 1.02, 
                        rotateY: index % 2 === 0 ? 2 : -2,
                        z: 20
                      }}
                      className="group cursor-pointer"
                    >
                      <div className="flex items-center space-x-6 p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-500 relative overflow-hidden">
                        <motion.div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                          style={{
                            background: `linear-gradient(135deg, ${feature.gradient.replace('from-', '').replace(' to-', ', ')})`,
                            opacity: 0.1
                          }}
                        />
                        
                        <motion.div
                          className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform relative`}
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.6 }}
                        >
                          <feature.icon className="w-8 h-8 text-white" />
                          <motion.div
                            className="absolute inset-0 rounded-2xl"
                            animate={{ 
                              boxShadow: [
                                `0 0 20px ${feature.gradient.includes('yellow') ? '#f59e0b' : '#3b82f6'}40`,
                                `0 0 40px ${feature.gradient.includes('yellow') ? '#f59e0b' : '#3b82f6'}80`,
                                `0 0 20px ${feature.gradient.includes('yellow') ? '#f59e0b' : '#3b82f6'}40`
                              ]
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        </motion.div>
                        <div className="relative z-10">
                          <h3 className="font-bold text-white text-xl mb-2">{feature.title}</h3>
                          <p className="text-white/80 text-base">{feature.desc}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  className="flex flex-col sm:flex-row gap-6 justify-center"
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  <motion.div
                    variants={magneticVariants}
                    initial="rest"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <Button
                      onClick={handleUpgrade}
                      disabled={isLoading}
                      className="relative px-16 py-8 text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white border-0 rounded-3xl hover:shadow-2xl hover:shadow-blue-500/50 transition-all duration-500 group overflow-hidden"
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        animate={{ 
                          background: [
                            'linear-gradient(45deg, #3b82f6, #8b5cf6, #ec4899)',
                            'linear-gradient(135deg, #8b5cf6, #ec4899, #3b82f6)',
                            'linear-gradient(225deg, #ec4899, #3b82f6, #8b5cf6)'
                          ]
                        }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />
                      <span className="relative z-10 flex items-center">
                        {isLoading ? (
                          <>
                            <motion.div
                              className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full mr-3"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                            Processing Payment...
                          </>
                        ) : (
                          <>
                            <Rocket className="w-6 h-6 mr-3" />
                            🚀 Upgrade Now
                          </>
                        )}
                      </span>
                      {/* Shimmer effect */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ 
                          duration: 2, 
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    </Button>
                  </motion.div>
                  
                  <motion.div
                    variants={magneticVariants}
                    initial="rest"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <Button
                      variant="outline"
                      onClick={onClose}
                      className="px-12 py-8 text-xl border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 rounded-3xl backdrop-blur-sm transition-all duration-300"
                    >
                      Maybe Later
                    </Button>
                  </motion.div>
                </motion.div>

                <motion.p
                  className="text-center text-white/70 text-base mt-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                >
                  🔒 Secure payment powered by Razorpay • Cancel anytime • No hidden fees
                </motion.p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
