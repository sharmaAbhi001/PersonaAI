import { Router } from "express";
import {
  validateGoogleCredential,
  validateRefreshToken,
} from "./auth.validator.js";
import { protect } from "./auth.middleware.js";
import {
  googleAuthController,
  meController,
  logoutController,
  googleSignupController,
  refreshController,
} from "./auth.controller.js";

const router = Router();

router.post("/google", validateGoogleCredential, googleAuthController);
router.post("/google/signup", googleSignupController);
router.post("/refresh", validateRefreshToken, refreshController);
router.get("/me", protect, meController);
router.post("/logout", logoutController);

export default router;
