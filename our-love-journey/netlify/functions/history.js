import { getStore } from "@netlify/blobs";

// Change history for Our Love Journey. Stored under its own "history" key,
// completely separate from "events" and "auth" — nothing here ever reads or
// writes the calendar data.
//
// POST { op: "append", entry }  → adds one entry (server-side, so two devices
//                                  logging at once never overwrite each other)
// POST { op: "clear",  entry }  → replaces the history with a single
//                                  "cleared by …" entry
const KEY = "history";
const MAX_ENTRIES = 2000; // safety net so the record can't grow forever
const USERS = ["basil", "leren"];
const ACTIONS = ["added", "edited", "deleted", "cleared"];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

function validEntry(e) {
  return (
    e &&
    typeof e === "object" &&
    typeof e.id === "string" &&
    typeof e.at === "string" &&
    USERS.includes(e.user) &&
    ACTIONS.includes(e.action)
  );
}

export default async (req) => {
  const store = getStore("our-love-journey");

  if (req.method === "GET") {
    const list = (await store.get(KEY, { type: "json" })) || [];
    return json(list);
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    if (!body || !validEntry(body.entry)) {
      return json({ error: "Invalid history payload" }, 400);
    }

    if (body.op === "append") {
      if (body.entry.action === "cleared") return json({ error: "Use op: clear" }, 400);
      const list = (await store.get(KEY, { type: "json" })) || [];
      if (!list.some((h) => h.id === body.entry.id)) list.push(body.entry);
      const trimmed = list.slice(-MAX_ENTRIES);
      await store.setJSON(KEY, trimmed);
      return json(trimmed);
    }

    if (body.op === "clear") {
      const marker = { id: body.entry.id, at: body.entry.at, user: body.entry.user, action: "cleared" };
      await store.setJSON(KEY, [marker]);
      return json([marker]);
    }

    return json({ error: "Unknown op" }, 400);
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config = { path: "/api/history" };
