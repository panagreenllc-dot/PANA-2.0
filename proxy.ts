import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isDotPath } from "@/lib/paths";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isMemberArea = createRouteMatcher(["/members(.*)", "/me(.*)", "/welcome(.*)", "/incubator/apply(.*)"]);
const isBadgeCheck = createRouteMatcher(["/verify(.*)"]);

const notFound = () => new NextResponse("Not Found", {
  status: 404,
  headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Content-Type": "text/plain; charset=utf-8" },
});



// Defense in depth: signed-out requests to /admin* never reach rendering.
// Signed-in users are checked for the admin role in every admin page,
// layout and server action (requireAdmin), since the role lives in Clerk
// publicMetadata which is not in the default session token.
export default clerkMiddleware(async (auth, req) => {
  if (isDotPath(req.nextUrl.pathname)) return notFound();
  if (isBadgeCheck(req)) {
    // Badge check pages carry a token in the URL: never index, cache or leak it as a referrer.
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "private, no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  }
  if (isAdminRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Not Found", {
        status: 404,
        headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      });
    }
  }
  if (isMemberArea(req)) {
    // Member pages are never indexed (pages also set robots metadata and enforce the gate server-side).
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "private, no-store");
    if (req.nextUrl.pathname.startsWith("/me/badge")) res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  }
});

export const config = {
  // Everything except Next's own assets and real static files (by extension). Any path with a dot-segment
  // (/.git/config, /.env, /.well-known/x.txt) always runs the proxy, so it gets the clean 404 above (or a normal page)
  // instead of rendering without Clerk (which logged "clerkMiddleware() not detected"). See lib/proxy-matcher.test.ts.
  matcher: [
    "/((?!_next/static|_next/image|(?!\\.)(?![^?]*/\\.)[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml|map)).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
