import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Shield, Database, Server } from "lucide-react";

export default function AdminSettings() {
  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Configuration</h1>
        <p className="text-muted-foreground text-sm mt-1">Paramètres globaux de la plateforme</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" /> Plateforme
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex justify-between"><span>Version</span><span className="font-mono">1.0.0</span></div>
            <div className="flex justify-between"><span>Environnement</span><span className="font-mono">Production</span></div>
            <div className="flex justify-between"><span>Région</span><span>EMEA</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" /> Base de données
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Les tables de données sont gérées automatiquement par Lovable Cloud.</p>
            <p>Les sauvegardes sont automatiques.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Sécurité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex justify-between"><span>RLS</span><span className="text-success font-medium">Activé</span></div>
            <div className="flex justify-between"><span>Multi-tenant</span><span className="text-success font-medium">Activé</span></div>
            <div className="flex justify-between"><span>Isolation</span><span className="text-success font-medium">Par company_id</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" /> Fonctionnalités
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex justify-between"><span>IA (Assistant)</span><span className="text-success font-medium">Activé</span></div>
            <div className="flex justify-between"><span>TTS</span><span className="text-success font-medium">Activé</span></div>
            <div className="flex justify-between"><span>Notifications email</span><span className="text-success font-medium">Activé</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
