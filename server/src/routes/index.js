import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { notesRouter } from "./notes.js";
import { tagsRouter } from "./tags.js";

export const router = Router();

router.use(requireAuth);
router.get("/me", (req, res) => {
  res.json({ user: req.user });
});
router.use("/notes", notesRouter);
router.use("/tags", tagsRouter);
