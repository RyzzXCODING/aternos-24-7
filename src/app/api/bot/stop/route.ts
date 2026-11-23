import { handleBotCommand } from "@/lib/control";

export const runtime = "nodejs";

export async function POST() {
  return handleBotCommand("stop");
}
