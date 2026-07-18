import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

serve(async (req) => {
  try {
    const { grant_type, code, refresh_token, redirect_uri } = await req.json();

    // Get the client_secret from Supabase secrets (set via: supabase secrets set WHOOP_CLIENT_SECRET=xxx)
    const clientSecret = Deno.env.get("WHOOP_CLIENT_SECRET");
    const clientId = Deno.env.get("WHOOP_CLIENT_ID");

    if (!clientSecret || !clientId) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body: Record<string, string> = {
      grant_type,
      client_id: clientId,
      client_secret: clientSecret,
    };

    if (grant_type === "authorization_code") {
      body.code = code;
      body.redirect_uri = redirect_uri;
      body.scope = "offline";
    } else if (grant_type === "refresh_token") {
      body.refresh_token = refresh_token;
      body.scope = "offline";
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid grant_type" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(WHOOP_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return tokens to the client (client_secret is never exposed)
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whoop-token: unhandled error", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
