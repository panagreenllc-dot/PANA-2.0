import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { raw } from "@/lib/db";
import { clerkJsonToUser, isClerkUserId, type ClerkUserJSON } from "@/lib/clerk-sync";
import { upsertMember } from "@/lib/members";

// Clerk → DB user sync (D17). Configure in Clerk: Webhooks → endpoint
// https://panagreen.org/api/webhooks/clerk, events user.created, user.updated, user.deleted.
// The signing secret is read from CLERK_WEBHOOK_SIGNING_SECRET (set by the owner in Vercel).
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    console.error("Clerk webhook received but CLERK_WEBHOOK_SIGNING_SECRET is not set");
    return new Response("Webhook not configured", { status: 503 });
  }

  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        const data = evt.data as unknown as ClerkUserJSON;
        if (!isClerkUserId(data.id)) return new Response("Bad user id", { status: 400 });
        await upsertMember(clerkJsonToUser(data));
        break;
      }
      case "user.deleted": {
        const id = (evt.data as { id?: string }).id;
        if (!isClerkUserId(id)) return new Response("Bad user id", { status: 400 });
        // D9: remove the member's requests, ideas and profile (profile cascades from members).
        const db = raw();
        await db.transaction([
          db`DELETE FROM collaboration_requests WHERE requester_user_id = ${id} OR owner_user_id = ${id}`,
          db`DELETE FROM projects WHERE user_id = ${id}`,
          db`DELETE FROM members WHERE user_id = ${id}`,
        ]);
        break;
      }
      default:
        break; // other events are ignored
    }
  } catch (e) {
    console.error(`Clerk webhook ${evt.type} failed`, e);
    return new Response("Sync failed", { status: 500 }); // Clerk/Svix will retry
  }
  return new Response("ok", { status: 200 });
}
