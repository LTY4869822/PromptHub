import { assertSameOrigin, jsonError } from "../../../lib/server-platform";
import { destroySession } from "../../../lib/server-auth";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": await destroySession(request) } });
}

