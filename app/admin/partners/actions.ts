"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseUuid } from "@/lib/incubator";
import { parseOffer, parsePartner } from "@/lib/partners";
import {
  convertInquiry, createOffer, createPartner, getOffer, offerAction, reinstateBadge, revokeBadge, setInquiryStatus,
  setPartnerStatus, updateOffer, updatePartner,
} from "@/lib/partners-repo";

const to = (path: string, q: Record<string, string>) => `${path}?${new URLSearchParams(q).toString()}`;
const refresh = () => { revalidatePath("/admin", "layout"); revalidatePath("/partners", "layout"); revalidatePath("/incubator/resources"); };
const note = (fd: FormData, k = "note", max = 1000) => String(fd.get(k) ?? "").trim().slice(0, max) || null;

// ---------- Inquiries ----------

export async function inquiryStatusAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  const status = String(fd.get("status") ?? "");
  if (!id || !["contacted", "declined", "spam", "new"].includes(status)) redirect(to("/admin/partners", { error: "Invalid request." }));
  const ok = await setInquiryStatus(id, status, admin.id, note(fd, "admin_note", 2000));
  if (ok) await audit(admin.id, `inquiry_${status}`, "partner_inquiry", id);
  refresh();
  redirect(to("/admin/partners", ok ? { notice: `inquiry-${status}` } : { error: "That inquiry was already handled." }));
}

export async function convertInquiryAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  const org = String(fd.get("org_name") ?? "partner");
  if (!id) redirect(to("/admin/partners", { error: "Invalid request." }));
  const partnerId = await convertInquiry(id, admin.id, org);
  if (!partnerId) redirect(to("/admin/partners", { error: "That inquiry was already handled." }));
  await audit(admin.id, "inquiry_convert", "partner_inquiry", id, partnerId);
  refresh();
  redirect(to(`/admin/partners/${partnerId}`, { notice: "converted" }));
}

// ---------- Partners ----------

export async function createPartnerAction(fd: FormData) {
  const admin = await requireAdmin();
  const { data, error } = parsePartner(fd);
  if (!data) redirect(to("/admin/partners", { error: error ?? "Invalid partner." }));
  const id = await createPartner(data, admin.id);
  await audit(admin.id, "partner_create", "partner", id, data.name);
  refresh();
  redirect(to(`/admin/partners/${id}`, { notice: "created" }));
}

export async function updatePartnerAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  if (!id) redirect(to("/admin/partners", { error: "Invalid partner." }));
  const { data, error } = parsePartner(fd);
  if (!data) redirect(to(`/admin/partners/${id}`, { error: error ?? "Invalid partner." }));
  const ok = await updatePartner(id, data, note(fd, "admin_note", 2000));
  if (ok) await audit(admin.id, "partner_update", "partner", id);
  refresh();
  redirect(to(`/admin/partners/${id}`, ok ? { notice: "saved" } : { error: "Partner not found." }));
}

export async function partnerStatusAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  const status = String(fd.get("status") ?? "");
  if (!id) redirect(to("/admin/partners", { error: "Invalid partner." }));
  const ok = await setPartnerStatus(id, status, admin.id);
  if (ok) await audit(admin.id, `partner_${status}`, "partner", id);
  refresh();
  redirect(to(`/admin/partners/${id}`, ok ? { notice: `status-${status}` } : { error: "Status not changed." }));
}

// ---------- Offers ----------

export async function createOfferAction(fd: FormData) {
  const admin = await requireAdmin();
  const partnerId = parseUuid(fd.get("partner_id"));
  if (!partnerId) redirect(to("/admin/partners", { error: "Invalid partner." }));
  const { data, error } = parseOffer(fd);
  if (!data) redirect(to(`/admin/partners/${partnerId}`, { error: error ?? "Invalid offer." }) + "#new-offer");
  let id: string;
  try {
    id = await createOffer(partnerId, data, admin.id, fd.get("publish_now") === "on");
  } catch (e) {
    console.error("createOffer failed", e);
    redirect(to(`/admin/partners/${partnerId}`, { error: "Couldn't save the offer. Check the fields and try again." }));
  }
  await audit(admin.id, "offer_create", "offer", id, data.title);
  refresh();
  redirect(to(`/admin/partners/${partnerId}`, { notice: "offer-created" }) + `#offer-${id}`);
}

export async function updateOfferAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  const partnerId = parseUuid(fd.get("partner_id"));
  if (!id || !partnerId) redirect(to("/admin/partners", { error: "Invalid offer." }));
  const { data, error } = parseOffer(fd);
  if (!data) redirect(to(`/admin/partners/${partnerId}`, { error: error ?? "Invalid offer.", edit: id }) + `#offer-${id}`);
  let ok = false;
  try { ok = await updateOffer(id, data); } catch (e) { console.error("updateOffer failed", e); }
  if (ok) await audit(admin.id, "offer_update", "offer", id);
  refresh();
  redirect(to(`/admin/partners/${partnerId}`, ok ? { notice: "offer-saved" } : { error: "Couldn't save the offer." }) + `#offer-${id}`);
}

async function act(fd: FormData, action: string) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  if (!id) redirect(to("/admin/partners", { error: "Invalid offer." }));
  const before = await getOffer(id);
  const back = String(fd.get("back") ?? "") === "queue" || !before ? "/admin/partners" : `/admin/partners/${before.partner_id}`;
  const r = await offerAction(id, action, admin.id, note(fd));
  if (r) await audit(admin.id, `offer_${action}`, "offer", id, note(fd) ?? undefined);
  refresh();
  redirect(to(back, r ? { notice: `offer-${action}` } : { error: action === "publish" ? "Can't publish: check its status and end date." : "That change isn't possible from the offer's current status." }));
}
// One action per button (formAction): React doesn't send the clicked button's name/value with a server-action form.
export async function publishOfferAction(fd: FormData) { await act(fd, "publish"); }
export async function sendBackOfferAction(fd: FormData) { await act(fd, "send_back"); }
export async function pauseOfferAction(fd: FormData) { await act(fd, "pause"); }
export async function archiveOfferAction(fd: FormData) { await act(fd, "archive"); }
export async function submitOfferAction(fd: FormData) { await act(fd, "submit"); }

// ---------- Badges ----------

export async function revokeBadgeAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  const reason = note(fd, "reason", 300);
  if (!id || !reason) redirect(to("/admin/partners/badges", { error: "Add a reason to revoke a badge." }));
  const ok = await revokeBadge(id, reason, admin.id);
  if (ok) await audit(admin.id, "badge_revoke", "badge", id, reason);
  redirect(to("/admin/partners/badges", ok ? { notice: "revoked" } : { error: "Badge not found or already revoked." }));
}

export async function reinstateBadgeAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  if (!id) redirect(to("/admin/partners/badges", { error: "Invalid badge." }));
  const ok = await reinstateBadge(id);
  if (ok) await audit(admin.id, "badge_reinstate", "badge", id);
  redirect(to("/admin/partners/badges", ok ? { notice: "reinstated" } : { error: "Couldn't reinstate (badges may not be switched on)." }));
}
