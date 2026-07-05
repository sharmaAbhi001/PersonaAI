import jwt from "jsonwebtoken";
import { ApiError } from "../../utils/ApiError.js";

const getAccessSecret = () =>
  process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;

export const protect = (req, res, next) => {
  const header = req.headers.authorization;
  const token =
    header?.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    return next(new ApiError(401, "Not authenticated"));
  }

  const secret = getAccessSecret();

  if (!secret) {
    return next(new ApiError(500, "JWT_ACCESS_SECRET is not configured"));
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (decoded.type !== "access") {
      return next(new ApiError(401, "Invalid or expired token"));
    }

    req.user = decoded;
    next();
  } catch {
    return next(new ApiError(401, "Invalid or expired token"));
  }
};
