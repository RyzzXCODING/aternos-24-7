import { getCurrentUser } from "@/lib/auth";
import { ok, serverError, unauthorized } from "@/lib/http";
import { getSettings } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    return ok({
      user: { id: user.id, username: user.username, role: user.role },
      settings: await getSettings(user.id),
    });
  } catch (error) {
    return serverError(error);
  }
}
