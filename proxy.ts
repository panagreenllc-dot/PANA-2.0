import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Defense in depth: signed-out requests to /admin* never reach rendering.
// Signed-in users are checked for the admin role in every admin page,
// layout and server action (requireAdmin), since the role lives in Clerk
// publicMetadata which is not in the default session token.
export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Not Found", {
        status: 404,
        headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      });
    }
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
