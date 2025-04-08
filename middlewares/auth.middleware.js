// middlewares/authMiddleware.js
import jwt from "jsonwebtoken";
import Role from "../models/role.js";
import { checkPermission } from "../utils/permissions.js";

const authenticateUser = async (req, res, next) => {
  try {
    let token = req.header("Authorization");

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    if (token.startsWith("Bearer ")) {
      token = token.slice(7);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token decodificado:", decoded);

    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = {
      id: decoded.id,
      roleId: decoded.role  // Cambiado de 'role' a 'roleId' para consistencia
    };

    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({ message: "Token error" });
  }
};

const authorizePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Obtener el rol completo usando roleId
      const role = await Role.findById(req.user.roleId);
      console.log("Role lookup:", { roleId: req.user.roleId, found: !!role });
      
      if (!role) {
        return res.status(403).json({ message: "Role not found" });
      }
      
      // Verificar si el usuario tiene el permiso necesario
      const hasPermission = role.isDefault 
        ? checkPermission(role.name, permission) 
        : role.permissions.some(p => typeof p === 'string' ? p === permission : p.name === permission);
      
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