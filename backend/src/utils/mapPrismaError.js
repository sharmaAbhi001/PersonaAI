import { Prisma } from "@prisma/client";
import { ApiError } from "./ApiError.js";

export const mapPrismaError = (error) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return new ApiError(409, "An account with this email already exists");
      case "P2025":
        return new ApiError(404, "Record not found");
      default:
        return new ApiError(500, "Database operation failed");
    }
  }

  if (
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    if (process.env.NODE_ENV === "development") {
      console.error("[prisma error]", error.message);
    }
    return new ApiError(500, "Database operation failed");
  }

  return null;
};
