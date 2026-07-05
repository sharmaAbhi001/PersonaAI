import { Router } from "express";
import { protect } from "../auth/auth.middleware.js";
import {
    continueConversationController,
    getConversationController,
    listConversationsController,
    newConversationController,
} from "./chat.controller.js";

const router = Router();

router.get("/conversations", protect, listConversationsController);
router.get("/conversation/:conversationId", protect, getConversationController);
router.post("/conversation", protect, newConversationController);
router.post(
    "/conversation/:conversationId",
    protect,
    continueConversationController
);

// legacy typo route
router.post("/converstion", protect, newConversationController);

export default router;
