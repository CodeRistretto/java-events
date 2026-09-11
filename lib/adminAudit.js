import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function logAdminAction({
  adminId,
  action,
  entityType,
  entityId = null,
  oldValue = null,
  newValue = null,
}) {
  const { error } = await supabaseAdmin
    .from("admin_audit_logs")
    .insert({
      admin_id: adminId,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      old_value: oldValue,
      new_value: newValue,
    });

  if (error) {
    console.error("Admin audit log failed:", error);
  }
}
