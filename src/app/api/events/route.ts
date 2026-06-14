import Database from "better-sqlite3";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const db = new Database(path.resolve(process.cwd(), "data/messages.db"), { readonly: true });
      let lastTs = Math.floor(Date.now() / 1000);

      const send = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try { db.close(); } catch { /* ignore */ }
        try { controller.close(); } catch { /* ignore */ }
      };

      send("connected", "ok");

      const interval = setInterval(() => {
        if (closed) { clearInterval(interval); return; }
        try {
          const row = db.prepare("SELECT MAX(COALESCE(last_message_at, created_at)) as ts FROM conversations").get() as { ts: number | null };
          const ts = row?.ts ?? 0;
          if (ts > lastTs) { lastTs = ts; send("update", String(ts)); }
          send("ping", String(Date.now()));
        } catch { cleanup(); }
      }, 1000);

      return cleanup;
    },
    cancel() { closed = true; },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
