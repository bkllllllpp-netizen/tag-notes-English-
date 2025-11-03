import { supabaseAdmin } from "../lib/supabase.js";

const parseBearerToken = req => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer") return null;
  return token?.trim() || null;
};

export const requireAuth = async (req, res, next) => {
  try {
    const token = parseBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const {
      data: { user },
      error
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role || null
    };

    next();
  } catch (error) {
    next(error);
  }
};
