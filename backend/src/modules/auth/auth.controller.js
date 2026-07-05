import jwt from "jsonwebtoken";
import { ApiResponse } from "../../utils/ApiResponse.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import {
  googleAuth,
  getUserById,
  googleSignup,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} from "./auth.service.js";

const getAccessSecret = () =>
  process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;

const sendAuthResponse = (res, result, message) => {
  res.status(200).json(
    new ApiResponse(
      200,
      {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      message
    )
  );
};

export const googleAuthController = asyncHandler(async (req, res) => {
  const result = await googleAuth(req.body.credential);
  sendAuthResponse(res, result, "Google authentication successful");
});

export const meController = asyncHandler(async (req, res) => {
  const user = await getUserById(req.user.userId);
  res.status(200).json(new ApiResponse(200, { user }, "User fetched"));
});

export const refreshController = asyncHandler(async (req, res) => {
  const tokens = await rotateRefreshToken(req.body.refreshToken);
  res
    .status(200)
    .json(new ApiResponse(200, tokens, "Tokens refreshed successfully"));
});

export const logoutController = asyncHandler(async (req, res) => {
  const header = req.headers.authorization;
  const accessToken =
    header?.startsWith("Bearer ") ? header.slice(7).trim() : null;

  const accessSecret = getAccessSecret();

  if (accessToken && accessSecret) {
    try {
      const decoded = jwt.verify(accessToken, accessSecret);
      if (decoded.type === "access" && decoded.userId) {
        await revokeAllUserRefreshTokens(decoded.userId);
      }
    } catch {
      // Access token may already be expired; still revoke refresh if provided.
    }
  }

  if (req.body?.refreshToken) {
    await revokeRefreshToken(req.body.refreshToken);
  }

  res.status(200).json(new ApiResponse(200, null, "Logout successful"));
});

export const googleSignupController = asyncHandler(async (req, res) => {
  const result = await googleSignup(req.body.code, req.body.codeVerifier);
  sendAuthResponse(res, result, "Google signup successful");
});
