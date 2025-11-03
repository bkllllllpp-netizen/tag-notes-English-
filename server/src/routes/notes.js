import { Router } from "express";
import { listNotes, getNoteById, getNotesByTag, createNote, updateNote, deleteNote } from "../models/notes.js";
import { refreshTagCounts } from "../services/tags.js";
import { normalizeNote } from "../utils/normalizeNote.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const notes = await listNotes(req.user.id);
    res.json({ notes: notes.map(normalizeNote) });
  } catch (error) {
    next(error);
  }
});

router.get("/tag/:name", async (req, res, next) => {
  try {
    const notes = await getNotesByTag(req.user.id, req.params.name);
    res.json({ notes: notes.map(normalizeNote) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const note = await getNoteById(req.user.id, req.params.id);
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json(normalizeNote(note));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const payload = buildPayload(req.body);
    const note = await createNote(req.user.id, payload);
    await refreshTagCounts(req.user.id);
    res.status(201).json(normalizeNote(note));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const payload = buildPayload(req.body, { partial: true });
    const note = await updateNote(req.user.id, req.params.id, payload);
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    await refreshTagCounts(req.user.id);
    res.json(normalizeNote(note));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await deleteNote(req.user.id, req.params.id);
    await refreshTagCounts(req.user.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

const buildPayload = (body, options = {}) => {
  const { partial = false } = options;
  const result = {};
  if (!partial || body.title !== undefined) {
    result.title = body.title || "";
  }
  if (!partial || body.content !== undefined) {
    result.content = body.content || "";
  }
  if (!partial || body.strokes !== undefined) {
    result.strokes = Array.isArray(body.strokes) ? body.strokes : [];
  }
  if (!partial || body.tags !== undefined) {
    result.tags = Array.isArray(body.tags)
      ? Array.from(new Set(body.tags.filter(Boolean).map(tag => tag.trim())))
      : [];
  }
  return result;
};

export { router as notesRouter };
