import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const pageHeaders = {
  ...corsHeaders,
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

function escapeHtml(value: string | null | undefined) {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(date: string) {
  try {
    return new Date(date).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return date;
  }
}

function renderPage(content: string, status = 200) {
  return new Response(content, { status, headers: pageHeaders });
}

function renderErrorPage(title: string, message: string, status = 400) {
  return renderPage(`<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3f5f8;
        --surface: #ffffff;
        --text: #172033;
        --muted: #667085;
        --line: #d9e0ea;
        --accent: #17375e;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: radial-gradient(circle at top, #ffffff 0%, var(--bg) 50%, #eaf0f8 100%);
        font-family: "Segoe UI", Tahoma, sans-serif;
        color: var(--text);
      }
      .card {
        width: min(560px, 100%);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 32px;
        box-shadow: 0 24px 80px rgba(23, 55, 94, 0.08);
      }
      h1 {
        margin: 0 0 12px;
        font-size: clamp(28px, 5vw, 40px);
        line-height: 1.05;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.7;
        font-size: 15px;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </main>
  </body>
</html>`, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim();

    if (!token) {
      return renderErrorPage("Lien incomplet", "Le lien de convocation est incomplet. Merci d’utiliser le bouton reçu par e-mail.", 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return renderErrorPage("Service indisponible", "La convocation ne peut pas être chargée pour le moment. Veuillez réessayer dans quelques instants.", 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: convocation, error: convocationError } = await admin
      .from("convocation_views")
      .select("id, session_id, viewed_at")
      .eq("token", token)
      .maybeSingle();

    if (convocationError) {
      throw new Error(convocationError.message);
    }

    if (!convocation) {
      return renderErrorPage("Lien invalide", "Cette convocation n’existe pas ou n’est plus disponible.", 404);
    }

    if (!convocation.viewed_at) {
      await admin
        .from("convocation_views")
        .update({ viewed_at: new Date().toISOString() })
        .eq("id", convocation.id);
    }

    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("title, session_date, location, meeting_link, convocation_letter, organs(name), companies(nom)")
      .eq("id", convocation.session_id)
      .maybeSingle();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!session) {
      return renderErrorPage("Session introuvable", "La session liée à cette convocation est introuvable.", 404);
    }

    const companyName = escapeHtml(session.companies?.nom ?? "GovBoard");
    const title = escapeHtml(session.title);
    const organ = escapeHtml(session.organs?.name ?? "—");
    const date = escapeHtml(formatDate(session.session_date));
    const location = session.location ? `<span><strong>Lieu :</strong> ${escapeHtml(session.location)}</span>` : "";
    const meetingLink = session.meeting_link
      ? `<a class="meeting-link" href="${escapeHtml(session.meeting_link)}" target="_blank" rel="noreferrer">Rejoindre la visioconférence</a>`
      : "";
    const letter = session.convocation_letter?.trim().length
      ? session.convocation_letter
      : `<div class="empty-state"><p>Aucune lettre de convocation validée n’est disponible pour cette session.</p></div>`;

    return renderPage(`<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Convocation officielle — ${title}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #eef2f7;
        --surface: #ffffff;
        --surface-soft: #f8fafc;
        --text: #162033;
        --muted: #5f6c82;
        --line: #dbe2ec;
        --accent: #163a63;
        --accent-soft: #edf4fb;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 48px 20px;
        background:
          radial-gradient(circle at top left, rgba(255,255,255,0.95), rgba(255,255,255,0) 30%),
          linear-gradient(180deg, #f8fbff 0%, var(--bg) 100%);
        color: var(--text);
        font-family: "Segoe UI", Tahoma, sans-serif;
      }
      .shell {
        width: min(1040px, 100%);
        margin: 0 auto;
      }
      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(22, 58, 99, 0.08);
        color: var(--accent);
        font-size: 13px;
        font-weight: 600;
      }
      .print-button {
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        background: var(--accent);
        color: #fff;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }
      .document {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 28px;
        overflow: hidden;
        box-shadow: 0 28px 90px rgba(22, 58, 99, 0.08);
      }
      .hero {
        padding: 36px;
        background: linear-gradient(135deg, #17375e 0%, #214e83 100%);
        color: #fff;
      }
      .eyebrow {
        margin: 0 0 10px;
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.7);
      }
      h1 {
        margin: 0;
        font-size: clamp(28px, 4vw, 40px);
        line-height: 1.1;
      }
      .company {
        margin: 0 0 18px;
        font-size: 15px;
        color: #f7d96e;
        font-weight: 700;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 24px;
        margin-top: 22px;
        font-size: 14px;
        color: rgba(255,255,255,0.88);
      }
      .meta strong {
        color: #fff;
      }
      .meeting-link {
        color: #fff;
        font-weight: 700;
      }
      .body {
        padding: 36px;
      }
      .letter {
        color: var(--text);
        font-size: 16px;
        line-height: 1.8;
      }
      .letter h1, .letter h2, .letter h3 {
        color: var(--text);
        line-height: 1.25;
      }
      .letter h1 { font-size: 28px; margin: 0 0 20px; }
      .letter h2 { font-size: 22px; margin: 32px 0 14px; }
      .letter h3 { font-size: 18px; margin: 24px 0 12px; }
      .letter p { margin: 14px 0; }
      .letter ul, .letter ol { margin: 16px 0; padding-left: 22px; }
      .letter li { margin: 8px 0; }
      .letter table {
        width: 100%;
        border-collapse: collapse;
        margin: 24px 0;
      }
      .letter td, .letter th {
        border: 1px solid var(--line);
        padding: 10px 12px;
        text-align: left;
        vertical-align: top;
      }
      .letter blockquote {
        margin: 24px 0;
        padding: 14px 18px;
        border-left: 4px solid var(--accent);
        background: var(--accent-soft);
      }
      .empty-state {
        padding: 20px;
        border: 1px dashed var(--line);
        border-radius: 18px;
        background: var(--surface-soft);
        color: var(--muted);
      }
      @media (max-width: 720px) {
        body { padding: 24px 12px; }
        .hero, .body { padding: 24px 20px; }
        .toolbar { flex-direction: column; align-items: stretch; }
        .print-button { width: 100%; }
      }
      @media print {
        body { padding: 0; background: #fff; }
        .toolbar { display: none; }
        .document {
          border: 0;
          border-radius: 0;
          box-shadow: none;
        }
        .hero {
          color: #000;
          background: #fff;
          border-bottom: 1px solid #ccc;
        }
        .eyebrow, .company, .meta { color: #000; }
        .meeting-link { color: #000; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="toolbar">
        <div class="badge">Convocation consultée et tracée</div>
        <button type="button" class="print-button" onclick="window.print()">Imprimer la convocation</button>
      </div>

      <main class="document">
        <header class="hero">
          <p class="eyebrow">Lettre de convocation officielle</p>
          <p class="company">${companyName}</p>
          <h1>${title}</h1>
          <div class="meta">
            <span><strong>Organe :</strong> ${organ}</span>
            <span><strong>Date :</strong> ${date}</span>
            ${location}
            ${meetingLink}
          </div>
        </header>

        <section class="body">
          <article class="letter">${letter}</article>
        </section>
      </main>
    </div>
  </body>
</html>`);
  } catch (error) {
    console.error("public-convocation error", error);
    return renderErrorPage("Erreur interne", "La convocation n’a pas pu être chargée. Veuillez réessayer dans quelques instants.", 500);
  }
});