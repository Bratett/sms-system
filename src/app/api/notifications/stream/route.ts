import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id!;

  let cancelled = false;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          cancelled = true;
        }
      };

      const poll = async () => {
        while (!cancelled) {
          try {
            const [notifications, unreadCount] = await Promise.all([
              db.notification.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                take: 20,
                select: {
                  id: true,
                  title: true,
                  message: true,
                  type: true,
                  isRead: true,
                  link: true,
                  createdAt: true,
                },
              }),
              db.notification.count({
                where: { userId, isRead: false },
              }),
            ]);

            send(JSON.stringify({ notifications, unreadCount }));
          } catch {
            // Database error — skip this tick
          }

          // Wait 5 seconds before next poll
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 5000);
          });
        }
      };

      poll().catch(() => {
        cancelled = true;
      });
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
