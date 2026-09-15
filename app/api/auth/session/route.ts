import { getCurrentUser, publicUser } from "../../../lib/server-auth";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  return Response.json({ user: publicUser(user) }, { status: user ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}

