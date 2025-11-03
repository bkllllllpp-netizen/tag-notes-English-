import { Router } from "express";
import { summarizeTags } from "../services/tags.js";
import { getNotesByTag } from "../models/notes.js";
import { normalizeNote } from "../utils/normalizeNote.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const tags = await summarizeTags(req.user.id);
    res.json({ tags });
  } catch (error) {
    next(error);
  }
});

router.get("/:name/notes", async (req, res, next) => {
  try {
    const notes = await getNotesByTag(req.user.id, req.params.name);
    res.json({ notes: notes.map(normalizeNote) });
  } catch (error) {
    next(error);
  }
});

export { router as tagsRouter };
