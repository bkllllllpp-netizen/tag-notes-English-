import { supabaseAdmin } from "../lib/supabase.js";

const TABLE = "notes";

export const listNotes = async userId => {
  if (!userId) throw new Error("User id is required");
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getNoteById = async (userId, id) => {
  if (!userId) throw new Error("User id is required");
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
};

export const getNotesByTag = async (userId, tag) => {
  if (!userId) throw new Error("User id is required");
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .contains("tags", [tag])
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createNote = async (userId, payload) => {
  if (!userId) throw new Error("User id is required");
  const now = new Date().toISOString();
  const body = { ...payload, created_at: now, updated_at: now, user_id: userId };
  const { data, error } = await supabaseAdmin.from(TABLE).insert(body).select().single();
  if (error) throw error;
  return data;
};

export const updateNote = async (userId, id, payload) => {
  if (!userId) throw new Error("User id is required");
  const body = { ...payload, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update(body)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const deleteNote = async (userId, id) => {
  if (!userId) throw new Error("User id is required");
  const { error } = await supabaseAdmin.from(TABLE).delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
  return true;
};
