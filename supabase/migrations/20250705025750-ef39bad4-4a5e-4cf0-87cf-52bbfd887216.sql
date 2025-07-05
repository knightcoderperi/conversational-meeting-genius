-- Create payment orders table for Razorpay integration
CREATE TABLE public.payment_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  payment_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own payment orders" 
ON public.payment_orders 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payment orders" 
ON public.payment_orders 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add subscription fields to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN subscription_tier TEXT DEFAULT 'free',
ADD COLUMN subscription_expires_at TIMESTAMP WITH TIME ZONE;

-- Create storage bucket for recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('recordings', 'recordings', false);

-- Create storage policies for recordings
CREATE POLICY "Users can upload their own recordings" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own recordings" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);