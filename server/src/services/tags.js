import { supabaseAdmin } from "../lib/supabase.js";

const NOTE_TABLE = "notes";

export const summarizeTags = async userId => {
  if (!userId) throw new Error("User id is required");
  const { data, error } = await supabaseAdmin
    .from(NOTE_TABLE)
    .select("tags, updated_at")
    .eq("user_id", userId);
  if (error) throw error;
  const map = new Map();
  (data || []).forEach(note => {
    (note.tags || []).forEach(tag => {
      if (!map.has(tag)) {
        map.set(tag, { name: tag, count: 0, latest: note.updated_at });
      }
      const entry = map.get(tag);
      entry.count += 1;
      entry.latest = entry.latest
        ? new Date(entry.latest) > new Date(note.updated_at)
          ? entry.latest
          : note.updated_at
        : note.updated_at;
    });
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
};

export const refreshTagCounts = async userId => {
  // For now this method just ensures summarizeTags doesn't throw when no notes exist.
  // You can extend it to persist counts into a dedicated tags table.
  return summarizeTags(userId);
};
