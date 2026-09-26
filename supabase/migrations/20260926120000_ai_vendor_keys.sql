-- =====================================================
-- AI Vendor API Keys (BYOK + future generated keys)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_vendor_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  provider        text NOT NULL CHECK (provider IN (
                    'openai', 'xai', 'anthropic', 'google', 'mistral', 'groq', 'other'
                  )),
  
  name            text NOT NULL DEFAULT 'Default',
  key_prefix      text,
  key_hint        text,
  key_encrypted   text NOT NULL,
  
  source          text NOT NULL DEFAULT 'byok' 
                    CHECK (source IN ('byok', 'generated')),
  
  scopes          text[] DEFAULT '{}',
  is_active       boolean NOT NULL DEFAULT true,
  last_used_at    timestamptz,
  expires_at      timestamptz,
  
  metadata        jsonb DEFAULT '{}'::jsonb,
  
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_vendor_keys_user_id_idx 
  ON public.ai_vendor_keys(user_id);

CREATE INDEX IF NOT EXISTS ai_vendor_keys_provider_idx 
  ON public.ai_vendor_keys(provider);

-- RLS
ALTER TABLE public.ai_vendor_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own vendor keys" ON public.ai_vendor_keys;
CREATE POLICY "Users manage own vendor keys"
  ON public.ai_vendor_keys
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
