import User from "../models/User.js";
import { getUserIdFromToken } from "../utils/tokens.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const userId = getUserIdFromToken(token);

    if (!userId) {
      throw Object.assign(new Error("Please sign in to continue."), { status: 401 });
    }

    const user = await User.findById(userId).select("-passwordHash -passwordSalt");
    if (!user) {
      throw Object.assign(new Error("Please sign in to continue."), { status: 401 });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
