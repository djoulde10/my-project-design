import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const APP_URL = (Deno.env.get("APP_URL") ?? Deno.env.get("PUBLIC_APP_URL") ?? "https://grigraboard.lovable.app")
      .trim()
      .replace(/\/+$/, "");

    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: require an authenticated user (block anon / unauthenticated callers)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims || claimsData.claims.role !== "authenticated" || !claimsData.claims.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Require user to have permission to manage sessions
    const userId = claimsData.claims.sub as string;
    const { data: hasPerm } = await admin.rpc("user_has_permission", {
      _user_id: userId, _permission_nom: "modifier_session",
    });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!hasPerm && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional payload : { session_id, only_unread }
    let session_id: string | undefined;
    let only_unread = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        session_id = body.session_id;
        only_unread = !!body.only_unread;
      } catch { /* no body */ }
    }

    // Fetch pending convocations
    let query = admin.from("convocation_views").select("*").limit(100);
    if (session_id) {
      query = query.eq("session_id", session_id);
      if (only_unread) {
        // Relance: emails déjà envoyés mais pas encore vus
        query = query.eq("email_status", "sent").is("viewed_at", null);
      } else {
        query = query.eq("email_status", "pending");
      }
    } else {
      query = query.eq("email_status", "pending");
    }

    const { data: pending, error: fetchErr } = await query;
    if (fetchErr) throw new Error(fetchErr.message);

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ message: "Aucune convocation en attente", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by session for efficient session data fetching
    const sessionIds = [...new Set(pending.map((p: any) => p.session_id))];
    const { data: sessions } = await admin
      .from("sessions")
      .select("id, title, session_date, location, meeting_link, convocation_letter, organ_id, company_id, organs(name), companies(nom)")
      .in("id", sessionIds);
    const sessionMap = new Map((sessions ?? []).map((s: any) => [s.id, s]));

    let sentCount = 0;
    let failedCount = 0;

    for (const conv of pending) {
      const sess: any = sessionMap.get(conv.session_id);
      if (!sess) continue;

      const link = `${APP_URL}/convocation/${encodeURIComponent(conv.token)}`;
      const dateFmt = (() => {
        try {
          return new Date(sess.session_date).toLocaleDateString("fr-FR", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          });
        } catch { return sess.session_date; }
      })();

      const isReminder = only_unread && conv.email_status === "sent";
      const subject = isReminder
        ? `Rappel : convocation à consulter — ${sess.title}`
        : `Convocation : ${sess.title}`;

      const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Tahoma,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">
        <tr><td style="background:#1e3a5f;padding:24px 32px;">
          <h1 style="color:#f5c542;margin:0;font-size:20px;font-weight:700;">${sess.companies?.nom || "GovBoard"}</h1>
          <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:12px;">Convocation officielle</p>
        </td></tr>
        <tr><td style="padding:32px;">
          ${isReminder ? '<p style="color:#c2410c;font-weight:600;margin:0 0 12px;">📌 Rappel — vous n\'avez pas encore consulté cette convocation</p>' : ''}
          <h2 style="color:#1e3a5f;margin:0 0 12px;font-size:18px;">${sess.title}</h2>
          <p style="color:#4a5568;margin:0 0 8px;font-size:14px;"><strong>Organe :</strong> ${sess.organs?.name || "—"}</p>
          <p style="color:#4a5568;margin:0 0 8px;font-size:14px;"><strong>Date :</strong> ${dateFmt}</p>
          ${sess.location ? `<p style="color:#4a5568;margin:0 0 8px;font-size:14px;"><strong>Lieu :</strong> ${sess.location}</p>` : ''}
          ${sess.meeting_link ? `<p style="color:#4a5568;margin:0 0 8px;font-size:14px;"><strong>Visioconférence :</strong> ${sess.meeting_link}</p>` : ''}
          <p style="color:#4a5568;margin:24px 0 24px;font-size:14px;line-height:1.6;">
            Vous êtes convoqué(e) à cette session. Cliquez ci-dessous pour consulter la convocation officielle et l'ordre du jour.
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td style="background:#1e3a5f;border-radius:8px;padding:14px 28px;">
            <a href="${link}" style="color:#fff;text-decoration:none;font-size:14px;font-weight:600;">Voir la convocation →</a>
          </td></tr></table>
          <p style="color:#94a3b8;margin:24px 0 0;font-size:12px;">Ce lien est personnel et sécurisé. Ne le partagez pas.</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;margin:0;font-size:11px;text-align:center;">Email automatique — ne pas répondre.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

      try {
        const resp = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: "GovBoard <onboarding@resend.dev>",
            to: [conv.email],
            subject,
            html,
          }),
        });

        if (!resp.ok) {
          const err = await resp.text();
          await admin.from("convocation_views").update({
            email_status: "failed",
            error_message: `${resp.status}: ${err.slice(0, 200)}`,
          }).eq("id", conv.id);
          failedCount++;
          continue;
        }

        await admin.from("convocation_views").update({
          email_status: "sent",
          sent_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", conv.id);

        // Notification in-app
        await admin.from("notifications").insert({
          user_id: conv.user_id,
          type: "convocation_sent",
          title: isReminder ? "Rappel : convocation" : "Nouvelle convocation",
          message: `Convocation à la session "${sess.title}" — ${dateFmt}`,
          link: `/convocation/${conv.token}`,
          metadata: { session_id: conv.session_id, token: conv.token },
        });

        sentCount++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        await admin.from("convocation_views").update({
          email_status: "failed",
          error_message: msg.slice(0, 200),
        }).eq("id", conv.id);
        failedCount++;
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, failed: failedCount, total: pending.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-convocations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur interne" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
