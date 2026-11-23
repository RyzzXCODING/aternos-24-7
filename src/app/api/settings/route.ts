import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, readJson, serverError, unauthorized } from "@/lib/http";
import { getSettings, saveSettings, type DashboardSettings } from "@/lib/store";

export const runtime = "nodejs";

const settingsSchema = z.object({
  compact: z.boolean(),
  refreshMs: z.number().int().refine((value) => [2000, 5000, 10000, 30000].includes(value)),
  notifyOnError: z.boolean(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    return ok({ settings: await getSettings(user.id) });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const parsed = settingsSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid dashboard settings", 422, parsed.error.issues);
    const settings: DashboardSettings = { theme: "industrial", ...parsed.data };
    await saveSettings(user.id, settings);
    return ok({ settings });
  } catch (error) {
    return serverError(error);
  }
}
