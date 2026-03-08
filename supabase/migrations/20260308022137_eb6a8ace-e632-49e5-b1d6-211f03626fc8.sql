ALTER TABLE public.sessions ADD COLUMN meeting_link text DEFAULT NULL;
COMMENT ON COLUMN public.sessions.meeting_link IS 'Video conference link (Teams, Zoom, etc.)';