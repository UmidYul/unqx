export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/admin/dashboard/:path*", "/admin/cards/:path*", "/admin/stats/:path*"],
};
