import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Search, BookOpen, HelpCircle, MessageSquare, Rocket, Users, FileText,
  Mic, Brain, Shield, Settings, Calendar, ChevronRight, Send, CheckCircle2,
  Lightbulb, ArrowRight, FolderOpen, Gavel, ListTodo, BarChart3
} from "lucide-react";

const guides = [
  {
    category: "Démarrage",
    icon: Rocket,
    color: "text-emerald-500",
    items: [
      {
        title: "Premiers pas avec la plateforme",
        content: `1. **Connexion** — Connectez-vous avec vos identifiants fournis par votre administrateur.\n2. **Tableau de bord** — Découvrez votre tableau de bord avec les statistiques clés.\n3. **Navigation** — Utilisez le menu latéral pour accéder aux différentes sections.\n4. **Profil** — Complétez votre profil dans les paramètres.`,
        tags: ["débutant", "connexion", "navigation"],
      },
      {
        title: "Comprendre l'organisation de la plateforme",
        content: `La plateforme est organisée autour de trois axes :\n\n- **Sessions** — Planifiez et gérez vos réunions de gouvernance.\n- **Gouvernance** — Suivez les décisions, résolutions et actions.\n- **Documents** — Centralisez tous vos documents officiels.\n\nChaque section est accessible depuis le menu latéral.`,
        tags: ["organisation", "structure"],
      },
    ],
  },
  {
    category: "Sessions & Réunions",
    icon: Calendar,
    color: "text-blue-500",
    items: [
      {
        title: "Créer une nouvelle session",
        content: `1. Allez dans **Sessions** depuis le menu.\n2. Cliquez sur **Nouvelle session**.\n3. Remplissez les informations : titre, date, organe, type.\n4. Ajoutez le lieu ou le lien de visioconférence.\n5. Enregistrez la session.`,
        tags: ["session", "création", "réunion"],
      },
      {
        title: "Gérer l'ordre du jour",
        content: `1. Ouvrez une session existante.\n2. Accédez à la section **Ordre du jour**.\n3. Ajoutez des points avec leur nature (information, décision, discussion).\n4. Réorganisez l'ordre par glisser-déposer.\n5. Assignez des présentateurs si nécessaire.`,
        tags: ["ordre du jour", "agenda", "points"],
      },
      {
        title: "Gérer les participants",
        content: `1. Dans la session, ouvrez **Participants**.\n2. Ajoutez des membres depuis la liste.\n3. Marquez la présence le jour de la réunion.\n4. Gérez les procurations si nécessaire.`,
        tags: ["participants", "présence", "membres"],
      },
    ],
  },
  {
    category: "Procès-verbaux & IA",
    icon: Brain,
    color: "text-purple-500",
    items: [
      {
        title: "Générer un PV avec l'IA",
        content: `1. Allez dans **Réunions & PV**.\n2. Créez ou sélectionnez une réunion.\n3. Ajoutez une transcription audio ou textuelle.\n4. Cliquez sur **Générer le PV avec l'IA**.\n5. L'IA analyse la transcription et produit un PV structuré.\n6. Relisez, modifiez si nécessaire, puis validez.`,
        tags: ["PV", "IA", "intelligence artificielle", "procès-verbal"],
      },
      {
        title: "Utiliser l'assistant IA",
        content: `L'assistant IA est disponible via le bouton flottant en bas à droite.\n\nIl peut :\n- **Résumer** des documents ou transcriptions\n- **Suggérer** des ordres du jour\n- **Identifier** des incohérences\n- **Répondre** à vos questions sur la plateforme\n\n⚠️ L'IA est un outil consultatif : elle propose mais ne valide jamais seule.`,
        tags: ["assistant", "IA", "chatbot", "aide"],
      },
    ],
  },
  {
    category: "Gouvernance",
    icon: Gavel,
    color: "text-amber-500",
    items: [
      {
        title: "Créer et suivre des décisions",
        content: `1. Allez dans **Résolutions**.\n2. Cliquez sur **Nouvelle décision**.\n3. Liez-la à une session et un point de l'ordre du jour.\n4. Renseignez les votes (pour, contre, abstention).\n5. Suivez le statut : adoptée, rejetée, en attente.`,
        tags: ["décision", "résolution", "vote"],
      },
      {
        title: "Suivre les actions",
        content: `1. Accédez au **Suivi des actions**.\n2. Créez des actions liées aux décisions.\n3. Assignez un responsable et une échéance.\n4. Suivez l'avancement : en cours, terminée, en retard.`,
        tags: ["actions", "suivi", "tâches"],
      },
    ],
  },
  {
    category: "Gestion",
    icon: Settings,
    color: "text-slate-500",
    items: [
      {
        title: "Gérer les membres",
        content: `1. Allez dans **Membres**.\n2. Ajoutez un nouveau membre avec ses informations.\n3. Assignez-le à un organe (conseil, comité…).\n4. Définissez son rôle et sa qualité.\n5. Gérez les mandats (début, fin).`,
        tags: ["membres", "gestion", "organes"],
      },
      {
        title: "Personnaliser la plateforme",
        content: `1. Accédez à **Personnalisation** dans le menu.\n2. Importez votre logo d'organisation.\n3. Définissez vos couleurs (principale, secondaire, accent).\n4. Personnalisez le nom de la plateforme.\n5. Prévisualisez les changements en temps réel.`,
        tags: ["branding", "personnalisation", "logo", "couleurs"],
      },
      {
        title: "Gérer les documents",
        content: `1. Allez dans **Documents**.\n2. Importez vos fichiers (PDF, Word, images…).\n3. Catégorisez-les (PV, politique, rapport…).\n4. Liez-les à des sessions ou points de l'ordre du jour.\n5. Utilisez la recherche pour retrouver rapidement un document.`,
        tags: ["documents", "fichiers", "stockage"],
      },
    ],
  },
];

const faqItems = [
  { q: "Comment réinitialiser mon mot de passe ?", a: "Cliquez sur « Mot de passe oublié » sur la page de connexion. Un email de réinitialisation vous sera envoyé." },
  { q: "Puis-je exporter un PV en PDF ?", a: "Oui. Ouvrez le PV dans Réunions & PV, puis cliquez sur le bouton d'export PDF. Le document inclura automatiquement le logo et le nom de votre organisation." },
  { q: "Comment ajouter un nouveau membre ?", a: "Allez dans Membres → Nouveau membre. Remplissez les informations requises et assignez-le à un organe." },
  { q: "L'IA peut-elle valider un PV automatiquement ?", a: "Non. L'IA est un outil d'assistance : elle génère des suggestions et des brouillons. Toute validation nécessite une action humaine." },
  { q: "Comment personnaliser les couleurs de la plateforme ?", a: "Allez dans Personnalisation dans le menu Gestion. Vous pourrez définir vos couleurs, logo et nom de plateforme." },
  { q: "Les données sont-elles sécurisées ?", a: "Oui. Toutes les données sont isolées par organisation. Des politiques de sécurité (RLS) garantissent qu'aucune organisation ne peut accéder aux données d'une autre." },
  { q: "Puis-je utiliser la plateforme sur mobile ?", a: "Oui. L'interface est entièrement responsive et s'adapte aux écrans mobiles et tablettes." },
  { q: "Comment déclarer un conflit d'intérêts ?", a: "Allez dans Conflits d'intérêts, cliquez sur Nouvelle déclaration, et renseignez les détails. Le conflit sera suivi jusqu'à sa résolution." },
  { q: "Que faire si une fonctionnalité ne fonctionne pas ?", a: "Utilisez le formulaire de support dans le Centre d'aide ou contactez votre administrateur. Décrivez le problème avec le maximum de détails." },
  { q: "Comment suivre les décisions prises en réunion ?", a: "Utilisez la section Résolutions pour voir toutes les décisions. Chaque décision peut être liée à des actions de suivi avec des responsables et des échéances." },
];

const onboardingSteps = [
  { key: "explore", label: "Explorer le tableau de bord", icon: BarChart3 },
  { key: "members", label: "Ajouter des membres", icon: Users },
  { key: "session", label: "Créer votre première session", icon: Calendar },
  { key: "agenda", label: "Définir un ordre du jour", icon: FileText },
  { key: "meeting", label: "Enregistrer une réunion", icon: Mic },
  { key: "pv", label: "Générer un procès-verbal", icon: Brain },
];

export default function HelpCenter() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("guides");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("onboarding_steps") || "[]");
    } catch { return []; }
  });

  const toggleStep = (key: string) => {
    setCompletedSteps(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      localStorage.setItem("onboarding_steps", JSON.stringify(next));
      return next;
    });
  };

  const filteredGuides = useMemo(() => {
    if (!search.trim()) return guides;
    const q = search.toLowerCase();
    return guides.map(cat => ({
      ...cat,
      items: cat.items.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        item.tags.some(t => t.includes(q))
      ),
    })).filter(cat => cat.items.length > 0);
  }, [search]);

  const filteredFaq = useMemo(() => {
    if (!search.trim()) return faqItems;
    const q = search.toLowerCase();
    return faqItems.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [search]);

  const handleSupportSubmit = async () => {
    if (!supportSubject.trim() || !supportMessage.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user!.id,
        subject: supportSubject,
        description: supportMessage,
      });
      if (error) throw error;
      toast.success("Votre demande a été envoyée avec succès");
      setSupportSubject("");
      setSupportMessage("");
    } catch {
      toast.error("Erreur lors de l'envoi. Veuillez réessayer.");
    } finally {
      setSending(false);
    }
  };

  const progress = Math.round((completedSteps.length / onboardingSteps.length) * 100);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Centre d'aide</h1>
        <p className="text-muted-foreground mt-1">Guides, tutoriels et assistance pour utiliser la plateforme efficacement.</p>
      </div>

      {/* Search */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher dans l'aide (ex: PV, membres, IA…)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Onboarding Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Guide de démarrage</CardTitle>
            </div>
            <Badge variant="secondary">{progress}%</Badge>
          </div>
          <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {onboardingSteps.map(step => {
              const done = completedSteps.includes(step.key);
              return (
                <button
                  key={step.key}
                  onClick={() => toggleStep(step.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                    done ? "bg-primary/10 text-primary" : "bg-muted/50 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${done ? "text-primary" : "text-muted-foreground/40"}`} />
                  <step.icon className="w-4 h-4 flex-shrink-0" />
                  <span className={done ? "line-through opacity-70" : ""}>{step.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="guides" className="gap-1.5"><BookOpen className="w-4 h-4" />Guides</TabsTrigger>
          <TabsTrigger value="faq" className="gap-1.5"><HelpCircle className="w-4 h-4" />FAQ</TabsTrigger>
          <TabsTrigger value="support" className="gap-1.5"><MessageSquare className="w-4 h-4" />Support</TabsTrigger>
        </TabsList>

        {/* Guides */}
        <TabsContent value="guides" className="space-y-6 mt-4">
          {filteredGuides.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Aucun guide trouvé pour « {search} »</CardContent></Card>
          )}
          {filteredGuides.map(cat => (
            <div key={cat.category}>
              <div className="flex items-center gap-2 mb-3">
                <cat.icon className={`w-5 h-5 ${cat.color}`} />
                <h2 className="font-semibold text-lg">{cat.category}</h2>
                <Badge variant="outline" className="ml-auto text-xs">{cat.items.length} guide{cat.items.length > 1 ? "s" : ""}</Badge>
              </div>
              <Accordion type="multiple" className="space-y-2">
                {cat.items.map((item, i) => (
                  <AccordionItem key={i} value={`${cat.category}-${i}`} className="border rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-medium hover:no-underline">
                      <span className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-muted-foreground" />
                        {item.title}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="prose prose-sm max-w-none text-muted-foreground">
                        {item.content.split("\n").map((line, j) => {
                          const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                          return <p key={j} className="my-1" dangerouslySetInnerHTML={{ __html: bold }} />;
                        })}
                      </div>
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        {item.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq" className="mt-4">
          {filteredFaq.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Aucune question trouvée pour « {search} »</CardContent></Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {filteredFaq.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline">
                    <span className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-primary" />
                      {item.q}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        {/* Support */}
        <TabsContent value="support" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="w-4 h-4" />
                Contacter le support
              </CardTitle>
              <CardDescription>Décrivez votre problème ou question. Notre équipe vous répondra dans les meilleurs délais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Sujet</label>
                <Input
                  placeholder="Ex: Problème de génération de PV"
                  value={supportSubject}
                  onChange={e => setSupportSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Description</label>
                <Textarea
                  placeholder="Décrivez votre problème avec le maximum de détails…"
                  value={supportMessage}
                  onChange={e => setSupportMessage(e.target.value)}
                  rows={5}
                />
              </div>
              <Button onClick={handleSupportSubmit} disabled={sending} className="gap-2">
                <Send className="w-4 h-4" />
                {sending ? "Envoi…" : "Envoyer la demande"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
