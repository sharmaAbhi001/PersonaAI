import { ApiError } from "../utils/ApiError.js";
import { logError } from "../utils/logger.js";
import { mapPrismaError } from "../utils/mapPrismaError.js";

export const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

const errorHandler = (error, req, res, next) => {
  const prismaError = mapPrismaError(error);
  const normalized = prismaError || error;
  const isOperational = normalized instanceof ApiError || Boolean(prismaError);

  const statusCode = normalized.statusCode || 500;
  const message = isOperational
    ? normalized.message
    : process.env.NODE_ENV === "development"
      ? normalized.message || "Internal Server Error"
      : "Internal Server Error";

  // Only log 5xx — client errors (4xx) are expected and flood memory if logged
  if (statusCode >= 500) {
    logError("request", normalized, {
      method: req.method,
      path: req.originalUrl,
      statusCode,
      operational: isOperational,
      userId: req.user?.userId,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
};

export default errorHandler;
