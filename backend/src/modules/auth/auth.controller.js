import { ApiResponse } from "../../utils/ApiResponse.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import {
  googleAuth,
  getUserById,
  getCookieOptions,
  googleSignup,
} from "./auth.service.js";




const sendAuthResponse = (res, result, message) => {
  res
    .cookie("token", result.token, getCookieOptions())
    .status(200)
    .json(new ApiResponse(200, { user: result.user }, message));
};

export const googleAuthController = asyncHandler(async (req, res) => {
  const result = await googleAuth(req.body.credential);
  sendAuthResponse(res, result, "Google authentication successful");
});

export const meController = asyncHandler(async (req, res) => {
  const user = await getUserById(req.user.userId);
  res.status(200).json(new ApiResponse(200, { user }, "User fetched"));
});

export const logoutController = asyncHandler(async (req, res) => {
  res
    .clearCookie("token", getCookieOptions())
    .status(200)
    .json(new ApiResponse(200, null, "Logout successful"));
});


export const googleSignupController = asyncHandler(async (req, res) => {
  const result = await googleSignup(req.body.code, req.body.codeVerifier);
  sendAuthResponse(res, result, "Google signup successful");
});
