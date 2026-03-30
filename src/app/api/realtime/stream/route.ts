import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { realtimeEmitter } from "@/lib/realtime/event-emitter";

/**
 * Server-Sent Events endpoint for real-time updates.
 * GET /api/realtime/stream
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = session.user as unknown as Record<string, unknown>;
  const schoolId = (user.schoolId as string) || "default";

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", data: { userId: session.user!.id } })}\n\n`),
      );

      const unsubscribe = realtimeEmitter.subscribe(schoolId, (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          unsubscribe();
        }
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 30000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
