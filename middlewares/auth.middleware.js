// middlewares/authMiddleware.js
import jwt from "jsonwebtoken";
import { checkPermission } from "../utils/permissions.js";

const authenticateUser = (req, res, next) => {
  try {
    let token = req.header("Authorization");

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    if (token.startsWith("Bearer ")) {
      token = token.slice(7);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = {
      id: decoded.id,
      role: decoded.role
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: "Token error" });
  }
};

const authorizePermission = (action) => (req, res, next) => {
  const hasPermission = req.user && checkPermission(req.user.role, action);
  if (!req.user || !hasPermission) {
    return res.status(403).json({ message: "Permission denied" });
  }
  next();
};

export { authenticateUser, authorizePermission };