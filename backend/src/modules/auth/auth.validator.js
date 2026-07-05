import { ApiError } from "../../utils/ApiError.js";

export const validateGoogleCredential = (req, res, next) => {
  const { credential } = req.body;

  if (!credential || typeof credential !== "string") {
    return next(new ApiError(400, "Google credential is required"));
  }

  next();
};

export const validateRefreshToken = (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken || typeof refreshToken !== "string") {
    return next(new ApiError(400, "Refresh token is required"));
  }

  next();
};
