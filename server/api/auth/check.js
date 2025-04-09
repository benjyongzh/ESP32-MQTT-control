import { verifyToken } from "../../middleware/authMiddleware";

export default function handler(req, res) {
  if (!verifyToken(req)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return res.status(200).json({ valid: true });
}
