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

export const authorizePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Obtener el rol completo
      const role = await Role.findById(req.user.roleId);
      
      if (!role) {
        return res.status(403).json({ message: "Role not found" });
      }
      
      // Verificar si el usuario tiene el permiso necesario
      const hasPermission = role.isDefault 
        ? checkPermission(role.name, permission) 
        : role.permissions.some(p => p.name === permission);
      
      if (!hasPermission) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      next();
    } catch (error) {
      console.error("Authorization error:", error);
      return res.status(403).json({ message: "Authorization failed" });
    }
  };
};

export { authenticateUser, authorizePermission };