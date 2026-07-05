import asyncHandler from "../../middlewares/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import {
    DEFAULT_PERSONA_SLUG,
    isValidPersonaSlug,
} from "../../utils/persona.registry.js";
import {
    continueConversation,
    getConversation,
    listConversations,
    newConversation,
} from "./chat.service.js";

export const newConversationController = asyncHandler(async (req, res) => {
    const { content, title, personaId } = req.body;
    const userId = req.user.userId;

    const personaSlug = personaId?.toLowerCase()?.trim() || DEFAULT_PERSONA_SLUG;
    if (!isValidPersonaSlug(personaSlug)) {
        throw new ApiError(400, 'Invalid personaId. Use "hitesh" or "piyush".');
    }

    const result = await newConversation(
        userId,
        title ?? undefined,
        content,
        personaSlug
    );

    res.status(201).json(
        new ApiResponse(
            201,
            {
                conversationId: result.conversation.id,
                conversation: result.conversation,
                userMessage: result.userMessage,
                reply: result.assistantMessage.content,
                personaId: result.conversation.personaId,
            },
            "Conversation created"
        )
    );
});

export const listConversationsController = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const conversations = await listConversations(userId);

    res.status(200).json(
        new ApiResponse(200, { conversations }, "Conversations fetched")
    );
});

export const getConversationController = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { conversationId } = req.params;

    const conversation = await getConversation(userId, conversationId);

    res.status(200).json(
        new ApiResponse(200, { conversation }, "Conversation fetched")
    );
});

export const continueConversationController = asyncHandler(async (req, res) => {
    const { content } = req.body;
    const userId = req.user.userId;
    const { conversationId } = req.params;

    const result = await continueConversation(userId, conversationId, content);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                conversationId: result.conversation.id,
                userMessage: result.userMessage,
                reply: result.assistantMessage.content,
                personaId: result.conversation.personaId,
            },
            "Message sent"
        )
    );
});
