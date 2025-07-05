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
    const { amount, currency, planName, planId, userId } = await req.json();

    if (!amount || !currency || !planName || !userId) {
      throw new Error('Missing required payment parameters');
    }

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay API keys not configured');
    }

    console.log('Creating payment order:', { 
      amount, 
      currency, 
      planName, 
      userId: userId.slice(0, 8) + '...' 
    });

    // Create Razorpay order
    const orderData = {
      amount: amount, // Amount in paise
      currency: currency,
      receipt: `receipt_${userId}_${Date.now()}`,
      notes: {
        plan_name: planName,
        plan_id: planId,
        user_id: userId
      }
    };

    const credentials = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error('Razorpay API error:', razorpayResponse.status, errorText);
      throw new Error(`Razorpay API error: ${razorpayResponse.status}`);
    }

    const order = await razorpayResponse.json();
    console.log('Razorpay order created:', order.id);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store order in database
    const { error: dbError } = await supabase
      .from('payment_orders')
      .insert({
        order_id: order.id,
        user_id: userId,
        amount: amount,
        currency: currency,
        plan_name: planName,
        plan_id: planId,
        status: 'created',
        razorpay_order_data: order
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store order in database');
    }

    return new Response(JSON.stringify({ 
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId,
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-payment-order function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});