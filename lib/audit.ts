import sql from "@/lib/db";

/** Best-effort admin audit trail; never blocks the action it records. (Not a server action.) */
export async function audit(adminId: string, action: string, targetType: string, targetId: string, note?: string) {
  try {
    await sql`INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, note)
              VALUES (${adminId}, ${action}, ${targetType}, ${targetId}, ${note ?? null})`;
  } catch (e) {
    console.error("audit log write failed", e);
  }
}
