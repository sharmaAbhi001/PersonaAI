import { Router } from "express";
import { validateGoogleCredential } from "./auth.validator.js";
import { protect } from "./auth.middleware.js";
import {
  googleAuthController,
  meController,
  logoutController,
  googleSignupController,
} from "./auth.controller.js";

const router = Router();

router.post("/google", validateGoogleCredential, googleAuthController);
router.get("/me", protect, meController);
router.post("/logout", protect, logoutController);
router.post("/google/signup", googleSignupController);

export default router;
