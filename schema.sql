-- ============================================================================
-- SUPABASE POSTGRESQL SCHEMA MIGRATION FOR ALLOMA AI
-- Enable pgvector, create tables for RAG, Nodes, Syllabus, Sources, and Tags
-- ============================================================================

-- 1. Enable pgvector Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Profiles Table (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  photo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Sources Table (Track uploaded files for RAG ingestion)
CREATE TABLE IF NOT EXISTS public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PROCESSING', 'SUCCESS', 'ERROR', 'PARTIAL')) DEFAULT 'PROCESSING',
  source_error_message TEXT,
  page_count INT DEFAULT 0,
  chunk_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Document Chunks Table (RAG Vector Store matching NVIDIA Llama Nemotron 1024d)
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text_content TEXT NOT NULL,
  citation TEXT,
  chunk_index INT DEFAULT 0,
  embedding vector(1024),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
  ON public.document_chunks 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 5. Nodes Table (Knowledge Graph & Study Sessions)
CREATE TABLE IF NOT EXISTS public.nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_range TEXT,
  date DATE,
  focus_duration INT DEFAULT 0,
  contradiction TEXT,
  obsidian_content TEXT,
  ai_analysis TEXT,
  custom_folder TEXT,
  sm2 JSONB DEFAULT '{"interval": 0, "repetition": 0, "easeFactor": 2.5, "nextReviewDate": null}'::jsonb,
  connections TEXT[] DEFAULT '{}',
  tag_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Syllabus Table (Academic Study Targets)
CREATE TABLE IF NOT EXISTS public.syllabus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'completed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tags Table (Categorization tags)
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Row Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Sources RLS
CREATE POLICY "Users can manage own sources" ON public.sources FOR ALL USING (auth.uid() = user_id);

-- Document Chunks RLS
CREATE POLICY "Users can manage own document chunks" ON public.document_chunks FOR ALL USING (auth.uid() = user_id);

-- Nodes RLS
CREATE POLICY "Users can manage own nodes" ON public.nodes FOR ALL USING (auth.uid() = user_id);

-- Syllabus RLS
CREATE POLICY "Users can manage own syllabus" ON public.syllabus FOR ALL USING (auth.uid() = user_id);

-- Tags RLS
CREATE POLICY "Users can manage own tags" ON public.tags FOR ALL USING (auth.uid() = user_id);

-- 9. RPC Function for Vector Similarity Search
CREATE OR REPLACE FUNCTION public.match_document_chunks (
  query_embedding vector(1024),
  match_count INT DEFAULT 3,
  filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  source_id UUID,
  text_content TEXT,
  citation TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.source_id,
    dc.text_content,
    dc.citation,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE (filter_user_id IS NULL OR dc.user_id = filter_user_id)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 10. Trigger for Auto Profile Creation on Supabase Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, photo_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Tadqiqotchi'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      email = EXCLUDED.email,
      photo_url = EXCLUDED.photo_url,
      updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
