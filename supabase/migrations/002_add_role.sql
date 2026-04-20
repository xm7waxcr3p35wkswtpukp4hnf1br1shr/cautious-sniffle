-- Add role column to api_keys
ALTER TABLE public.api_keys 
ADD COLUMN IF NOT EXISTS role varchar(20) not null default 'user';

-- Update existing admin key
UPDATE public.api_keys SET role = 'admin' WHERE label = 'admin';