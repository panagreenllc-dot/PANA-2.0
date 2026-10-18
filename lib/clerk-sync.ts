export type ClerkUserLike = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  banned?: boolean;
  primaryEmailAddressId?: string | null;
  emailAddresses: { id: string; emailAddress: string; verification?: { status?: string | null } | null }[];
};

export function memberFieldsFromClerk(u: ClerkUserLike) {
  const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0];
  return {
    user_id: u.id,
    email: primary?.emailAddress?.toLowerCase() ?? null,
    email_verified: primary?.verification?.status === "verified",
    display_name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || null,
    image_url: u.imageUrl ?? null,
    status: u.banned ? "banned" : "active",
  };
}


// Shape of the `data` object Clerk sends for user.* webhook events (snake_case JSON).
export type ClerkUserJSON = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  image_url?: string | null;
  banned?: boolean;
  primary_email_address_id?: string | null;
  email_addresses?: { id: string; email_address: string; verification?: { status?: string | null } | null }[];
};

export function clerkJsonToUser(d: ClerkUserJSON): ClerkUserLike {
  return {
    id: d.id,
    firstName: d.first_name ?? null,
    lastName: d.last_name ?? null,
    username: d.username ?? null,
    imageUrl: d.image_url ?? null,
    banned: !!d.banned,
    primaryEmailAddressId: d.primary_email_address_id ?? null,
    emailAddresses: (d.email_addresses ?? []).map((e) => ({ id: e.id, emailAddress: e.email_address, verification: e.verification ?? null })),
  };
}

export function isClerkUserId(id: unknown): id is string {
  return typeof id === "string" && /^user_[A-Za-z0-9]+$/.test(id);
}
