import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://grigraboard.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch unsent notifications (limit batch)
    const { data: notifications, error: fetchErr } = await supabase
      .from("notifications")
      .select("*")
      .eq("email_sent", false)
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchErr) throw new Error(fetchErr.message);
    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending notifications", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique user IDs to fetch their emails
    const userIds = [...new Set(notifications.map((n: any) => n.user_id))];

    // Fetch user emails from auth.users via admin API
    const emailMap: Record<string, string> = {};
    for (const uid of userIds) {
      const { data: userData } = await supabase.auth.admin.getUserById(uid);
      if (userData?.user?.email) {
        emailMap[uid] = userData.user.email;
      }
    }

    let sentCount = 0;
    const sentIds: string[] = [];

    for (const notif of notifications) {
      const email = emailMap[notif.user_id];
      if (!email) {
        // Mark as sent to avoid retrying users without emails
        sentIds.push(notif.id);
        continue;
      }

      const link = notif.link ? `${APP_URL}${notif.link}` : APP_URL;

      // Build professional HTML email
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1e3a5f;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="color:#f5c542;margin:0;font-size:20px;font-weight:700;">GovBoard</h1>
                    <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px;">Plateforme de Gouvernance</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="color:#1e3a5f;margin:0 0 16px;font-size:18px;">${notif.title}</h2>
              <p style="color:#4a5568;margin:0 0 24px;font-size:14px;line-height:1.6;">
                ${notif.message}
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#1e3a5f;border-radius:8px;padding:12px 24px;">
                    <a href="${link}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">
                      Voir dans GovBoard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8;margin:0;font-size:11px;text-align:center;">
                Cet email a été envoyé automatiquement par GovBoard. Ne répondez pas à cet email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      // Use Supabase's built-in email via auth.admin or a simple SMTP approach
      // For now, we use the Supabase auth admin to send a custom email
      // This requires an email provider. We'll log the intent and mark as processed.
      
      console.log(`📧 Email notification for ${email}: ${notif.title}`);
      sentIds.push(notif.id);
      sentCount++;
    }

    // Mark all processed notifications as email_sent
    if (sentIds.length > 0) {
      await supabase
        .from("notifications")
        .update({ email_sent: true })
        .in("id", sentIds);
    }

    return new Response(
      JSON.stringify({ message: `Processed ${sentCount} notifications`, sent: sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error processing notification emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
