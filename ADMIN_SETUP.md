# Admin setup (PANA 2.0)

Do these steps once, in this order, **before merging** this branch to `main`.

## 1. Add environment variables in Vercel
Vercel → project → Settings → Environment Variables (Production + Preview):

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/projects` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/projects` |
| `ADMIN_EMAILS` *(optional)* | your email, e.g. `owner@panagreen.org` |

`DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` should already exist.
Redeploy after changing env vars. See `.env.example` for the full list.

## 2. Run the database migration in Neon
1. Open the Neon console → your project → **SQL Editor** (same database as `DATABASE_URL`).
2. Paste the contents of `db/migrations/001_moderation.sql` and click **Run**.
3. Check: `SELECT status, count(*) FROM projects GROUP BY status;` — all existing projects should be `pending`.

Until the migration runs, the new code will error on the Projects and Admin pages (the `status` column won't exist).

## 3. Make yourself an admin in Clerk
1. Clerk dashboard → **Users** → open your user.
2. Scroll to **Metadata** → **Public** → Edit, and set:
   ```json
   { "role": "admin" }
   ```
3. Save, then sign out and back in on the site. An **Admin** link appears in the header.

After that you can promote other admins from `/admin/members`.

## 4. Clerk sign-in options (optional)
Clerk dashboard → **User & Authentication** → enable Email and Google (or others).
Under **Paths**, the sign-in/sign-up URLs should be `/sign-in` and `/sign-up` on your domain.

## Using the admin area (`/admin`)
- **Pending** – approve or delete new submissions. Nothing is public until approved.
- **Listed projects** – edit, unpublish (back to pending) or delete approved projects.
- **Members** – make/remove admin, ban/unban, or delete users (optionally with their projects).
