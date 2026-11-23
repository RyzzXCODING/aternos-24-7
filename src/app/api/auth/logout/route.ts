import { addLog } from "@/lib/store";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (user) await addLog("auth", `Sign-out for ${user.username}`);
    await destroySession();
    return ok({ signedOut: true });
  } catch (error) {
    return serverError(error);
  }
}
