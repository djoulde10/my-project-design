import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { showSuccess, showError } from "@/lib/toastHelpers";
import { Shield, ArrowLeft } from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      showError(error, "Impossible d'envoyer le lien de réinitialisation");
    } else {
      showSuccess("saved", "Un e-mail de réinitialisation a été envoyé. Vérifiez votre boîte de réception.");
      setShowForgotPassword(false);
    }
    setResetLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showError(error, "Échec de la connexion");
      } else {
        navigate("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        showError(error, "Échec de l'inscription");
      } else {
        showSuccess("user_created", "Vérifiez votre e-mail pour confirmer votre compte.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Decorative background for desktop */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-accent/[0.06] blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg shadow-primary/25 mb-4">
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">GovBoard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Plateforme de gouvernance d'entreprise</p>
        </div>

        {!showForgotPassword ? (
          <Card className="shadow-xl shadow-foreground/[0.03] border-border/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">{isLogin ? "Connexion" : "Inscription"}</CardTitle>
              <CardDescription>
                {isLogin ? "Accédez à votre espace de gouvernance" : "Créez votre compte"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nom complet</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Jean Dupont" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="vous@entreprise.com" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Mot de passe</Label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        Mot de passe oublié ?
                      </button>
                    )}
                  </div>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
                </div>
                <Button type="submit" className="w-full h-10" disabled={loading}>
                  {loading ? "Chargement..." : isLogin ? "Se connecter" : "S'inscrire"}
                </Button>
              </form>
              <div className="mt-5 pt-4 border-t text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {isLogin ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-xl shadow-foreground/[0.03] border-border/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Réinitialiser le mot de passe</CardTitle>
              <CardDescription>Entrez votre e-mail pour recevoir un lien de réinitialisation.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resetEmail">Email</Label>
                  <Input
                    id="resetEmail"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    placeholder="vous@entreprise.com"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1 h-10" disabled={resetLoading}>
                    {resetLoading ? "Envoi..." : "Envoyer le lien"}
                  </Button>
                </div>
              </form>
              <div className="mt-4 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Retour à la connexion
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-[11px] text-muted-foreground/60 mt-6">
          © {new Date().getFullYear()} GovBoard — Tous droits réservés
        </p>
      </div>
    </div>
  );
}
