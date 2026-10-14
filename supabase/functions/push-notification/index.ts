import { timingSafeEqual } from "node:crypto";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-vybe-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PushEvent = {
  id: string;
  recipient_id: string;
  actor_id: string;
  kind: "follow" | "interest" | "match" | "message";
  category: "messages" | "connections" | "community" | "social";
  conversation_id: string | null;
  attempt_count: number;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};

function isEqualSecret(provided: string, expected: string): boolean {
  const providedBytes = new TextEncoder().encode(provided);
  const expectedBytes = new TextEncoder().encode(expected);
  return providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes);
}

function response(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

function notificationFor(event: PushEvent) {
  const destinations: Record<PushEvent["kind"], string> = {
    follow: "/profile.html",
    interest: "/profile.html",
    match: "/profile.html",
    message: event.conversation_id
      ? `/messages.html?conversation=${encodeURIComponent(event.conversation_id)}`
      : "/messages.html",
  };
  const messages: Record<PushEvent["kind"], { title: string; body: string }> = {
    follow: {
      title: "You caught someone's eye 👀",
      body: "Someone new is following you on VYBES.",
    },
    interest: {
      title: "You caught someone's eye 👀",
      body: "You have a new connection request.",
    },
    match: {
      title: "It's giving connection 💗",
      body: "Someone new wants to connect with you.",
    },
    message: {
      title: "Someone wants your attention 👀",
      body: "You have a new message on VYBES.",
    },
  };
  return {
    ...messages[event.kind],
    url: destinations[event.kind],
    icon: "/img/vybes-icon.svg",
    badge: "/img/vybes-icon.svg",
    timestamp: Date.now(),
    tag: `vybes:${event.id}`,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);

  const expectedSecret = Deno.env.get("VYBE_PUSH_WEBHOOK_SECRET");
  const providedSecret = request.headers.get("x-vybe-push-secret") || "";
  if (!expectedSecret || expectedSecret.length < 32 || !isEqualSecret(providedSecret, expectedSecret)) {
    return response({ error: "Unauthorized." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error("Push function secrets are incomplete.");
    return response({ error: "Push delivery is not configured." }, 500);
  }

  const rawBody = await request.text();
  if (rawBody.length > 4096) return response({ error: "Request is too large." }, 413);

  let eventId: string;
  try {
    const body = JSON.parse(rawBody);
    if (!body || typeof body.event_id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.event_id)) {
      return response({ error: "Invalid push event." }, 400);
    }
    eventId = body.event_id;
  } catch {
    return response({ error: "Invalid push event." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: pendingEvent, error: eventError } = await supabase
    .from("push_notification_outbox")
    .select("id,recipient_id,actor_id,kind,category,conversation_id,attempt_count")
    .eq("id", eventId)
    .eq("status", "pending")
    .maybeSingle();

  if (eventError) {
    console.error("Could not load a queued push event.", eventError.message);
    return response({ error: "Could not load push event." }, 500);
  }
  if (!pendingEvent) return response({ accepted: true, duplicate: true }, 202);

  const { data: event, error: claimError } = await supabase
    .from("push_notification_outbox")
    .update({
      status: "processing",
      attempt_count: pendingEvent.attempt_count + 1,
      last_error: null,
    })
    .eq("id", eventId)
    .eq("status", "pending")
    .select("id,recipient_id,actor_id,kind,category,conversation_id,attempt_count")
    .maybeSingle();

  if (claimError) {
    console.error("Could not claim a queued push event.", claimError.message);
    return response({ error: "Could not claim push event." }, 500);
  }
  if (!event) return response({ accepted: true, duplicate: true }, 202);

  const complete = async (status: string, lastError: string | null = null) => {
    const { error } = await supabase
      .from("push_notification_outbox")
      .update({ status, last_error: lastError, completed_at: new Date().toISOString() })
      .eq("id", event.id)
      .eq("status", "processing");
    if (error) throw error;
  };

  try {
    const [preferencesResult, recipientBlockResult, actorBlockResult] = await Promise.all([
      supabase.from("push_notification_preferences")
        .select("enabled,messages,connections,community,social")
        .eq("user_id", event.recipient_id)
        .maybeSingle(),
      supabase.from("profile_blocks")
        .select("blocker_id")
        .eq("blocker_id", event.recipient_id)
        .eq("blocked_id", event.actor_id)
        .maybeSingle(),
      supabase.from("profile_blocks")
        .select("blocker_id")
        .eq("blocker_id", event.actor_id)
        .eq("blocked_id", event.recipient_id)
        .maybeSingle(),
    ]);

    if (preferencesResult.error || recipientBlockResult.error || actorBlockResult.error) {
      throw preferencesResult.error || recipientBlockResult.error || actorBlockResult.error;
    }
    const preferences = preferencesResult.data;
    if (preferences?.enabled === false || preferences?.[event.category] === false ||
        recipientBlockResult.data || actorBlockResult.data) {
      await complete("suppressed");
      return response({ accepted: true, suppressed: true });
    }

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth_secret")
      .eq("user_id", event.recipient_id)
      .eq("active", true);
    if (subscriptionsError) throw subscriptionsError;
    if (!subscriptions?.length) {
      await complete("no_subscriptions");
      return response({ accepted: true, subscriptions: 0 });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    const payload = JSON.stringify(notificationFor(event as PushEvent));
    let accepted = 0;
    let expired = 0;
    let failed = 0;
    let lastError = "";

    for (const row of subscriptions as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_secret } },
          payload,
          { TTL: 3600, urgency: "normal" },
        );
        accepted += 1;
      } catch (error) {
        const statusCode = typeof error === "object" && error !== null && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
        if (statusCode === 404 || statusCode === 410) {
          const { error: deactivateError } = await supabase
            .from("push_subscriptions")
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq("id", row.id);
          if (deactivateError) throw deactivateError;
          expired += 1;
        } else {
          failed += 1;
          lastError = statusCode ? `Push service returned HTTP ${statusCode}.` : "Push service request failed.";
        }
      }
    }

    const status = accepted > 0
      ? (failed > 0 ? "partial" : "sent")
      : (expired === subscriptions.length ? "no_subscriptions" : "failed");
    await complete(status, lastError || null);
    return response({ accepted: true, subscriptions: subscriptions.length, acceptedByPushService: accepted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected push delivery failure.";
    try {
      await complete("failed", message.slice(0, 1000));
    } catch (updateError) {
      console.error("Could not record push delivery failure.", updateError);
    }
    console.error("Push delivery failed.", message);
    return response({ error: "Push delivery failed." }, 500);
  }
});
