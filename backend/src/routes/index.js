import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import chatRoutes from "../modules/chat/chat.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/chat", chatRoutes);

export default router;
