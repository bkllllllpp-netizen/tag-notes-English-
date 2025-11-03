export const normalizeNote = note => ({
  id: note.id,
  title: note.title || "",
  content: note.content || "",
  strokes: note.strokes || [],
  tags: note.tags || [],
  createdAt: note.created_at,
  updatedAt: note.updated_at,
  userId: note.user_id
});
