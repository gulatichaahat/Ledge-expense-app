import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required. Add it to server/.env before starting the backend.");
}

export function createToken(userId) {
  return jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function getUserIdFromToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.sub;
  } catch {
    return null;
  }
}

export function revokeToken() {
  // JWT is stateless. Client-side logout removes the stored token.
}
