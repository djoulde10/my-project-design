import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, MapPin, Video, CheckCircle, AlertCircle } from "lucide-react";

interface SessionData {
  id: string;
  title: string;
  session_date: string;
  location: string | null;
  meeting_link: string | null;
  convocation_letter: string | null;
}

export default function ConvocationView() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [alreadyViewed, setAlreadyViewed] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Stocker le token et rediriger vers login
      sessionStorage.setItem("pending_convocation_token", token || "");
      navigate("/auth", { replace: true });
      return;
    }
    if (!token) {
      setError("Lien invalide");
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error: rpcErr } = await supabase.rpc("mark_convocation_viewed" as any, { _token: token });
      if (rpcErr) {
        setError(rpcErr.message);
        setLoading(false);
        return;
      }
      const result = data as any;
      if (!result?.success) {
        setError(result?.error || "Impossible d'accéder à cette convocation");
        setLoading(false);
        return;
      }
      setSession(result.session as SessionData);
      setAlreadyViewed(result.already_viewed);
      setLoading(false);
    })();
  }, [token, user, authLoading, navigate]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <CardTitle>Accès refusé</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate("/")}>Retour à l'accueil</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) return null;

  const dateFmt = new Date(session.session_date).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle className="w-4 h-4 text-green-600" />
          {alreadyViewed ? "Déjà consultée" : "Marquée comme consultée"}
        </div>
        <Card>
          <CardHeader className="border-b bg-primary/5">
            <CardTitle className="text-2xl">{session.title}</CardTitle>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{dateFmt}</span>
              {session.location && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{session.location}</span>}
              {session.meeting_link && (
                <a href={session.meeting_link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                  <Video className="w-4 h-4" />Rejoindre la visioconférence
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {session.convocation_letter ? (
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: session.convocation_letter }} />
            ) : (
              <p className="text-muted-foreground italic">Aucune lettre de convocation rédigée pour cette session.</p>
            )}
            <div className="mt-8 pt-6 border-t flex gap-3">
              <Button onClick={() => navigate("/sessions")}>Voir mes sessions</Button>
              <Button variant="outline" onClick={() => navigate("/")}>Tableau de bord</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
