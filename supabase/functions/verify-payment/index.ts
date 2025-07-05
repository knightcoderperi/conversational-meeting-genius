import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      userId, 
      planName 
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId) {
      throw new Error('Missing required payment verification parameters');
    }

    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!razorpayKeySecret) {
      throw new Error('Razorpay API key secret not configured');
    }

    console.log('Verifying payment:', { 
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      userId: userId.slice(0, 8) + '...'
    });

    // Verify signature
    const crypto = await import('node:crypto');
    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      throw new Error('Invalid payment signature');
    }

    console.log('Payment signature verified successfully');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update payment order status
    const { error: orderUpdateError } = await supabase
      .from('payment_orders')
      .update({
        status: 'completed',
        payment_id: razorpay_payment_id,
        signature: razorpay_signature,
        completed_at: new Date().toISOString()
      })
      .eq('order_id', razorpay_order_id);

    if (orderUpdateError) {
      console.error('Error updating payment order:', orderUpdateError);
      throw new Error('Failed to update payment order');
    }

    // Update user subscription
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1); // Add 1 month

    const { error: profileUpdateError } = await supabase
      .from('user_profiles')
      .update({
        subscription_tier: planName.toLowerCase(),
        subscription_end_date: subscriptionEndDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('Error updating user profile:', profileUpdateError);
      throw new Error('Failed to update user subscription');
    }

    console.log('Payment verification completed successfully');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Payment verified and subscription activated',
      subscriptionEndDate: subscriptionEndDate.toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in verify-payment function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});