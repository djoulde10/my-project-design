const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const pageHeaders = {
  ...corsHeaders,
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
};

const APP_URL = (Deno.env.get("APP_URL") ?? Deno.env.get("PUBLIC_APP_URL") ?? "https://grigraboard.lovable.app")
  .trim()
  .replace(/\/+$/, "");

function escapeHtml(value: string | null | undefined) {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPage(content: string, status = 200) {
  const response = new Response(content, {
    status,
    headers: new Headers(pageHeaders),
  });
  response.headers.set("content-type", "text/html; charset=utf-8");
  return response;
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

    return new Response(null, {
      status: 302,
      headers: new Headers({
        ...corsHeaders,
        "cache-control": "no-store",
        location: `${APP_URL}/convocation/${encodeURIComponent(token)}`,
      }),
    });
  } catch (error) {
    console.error("public-convocation error", error);
    return renderErrorPage("Erreur interne", "La convocation n’a pas pu être chargée. Veuillez réessayer dans quelques instants.", 500);
  }
});