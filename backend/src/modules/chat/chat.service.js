import { llmService } from "../../service/llm.service.js";
import { ApiError } from "../../utils/ApiError.js";
import {
    personaDbIdFromSlug,
    personaSlugFromDbId,
    resolvePersona,
} from "../../utils/persona.registry.js";
import {
    allConversation,
    createConversation,
    getConversationById,
    touchConversation,
} from "./chat.respository.js";

function deriveTitle(content) {
    const trimmed = content?.trim();
    if (!trimmed) return "New Chat";
    return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
}

function formatConversation(conversation) {
    if (!conversation) return conversation;
    return {
        ...conversation,
        personaId: personaSlugFromDbId(conversation.personaId),
    };
}

export async function newConversation(userId, title, content, personaSlug) {
    const persona = resolvePersona(personaSlug);
    const conversation = await createConversation(
        userId,
        title ?? deriveTitle(content),
        personaDbIdFromSlug(persona.slug)
    );
    const { userMessage, assistantMessage } = await llmService(
        conversation.id,
        content,
        persona.slug
    );

    return {
        conversation: formatConversation(conversation),
        userMessage,
        assistantMessage,
    };
}

export async function listConversations(userId) {
    const conversations = await allConversation(userId);
    return conversations.map((item) => formatConversation(item));
}

export async function getConversation(userId, conversationId) {
    const conversation = await getConversationById(conversationId, userId);
    if (!conversation) {
        throw new ApiError(404, "Conversation not found");
    }
    return formatConversation(conversation);
}

export async function continueConversation(userId, conversationId, content) {
    const conversation = await getConversationById(conversationId, userId);
    if (!conversation) {
        throw new ApiError(404, "Conversation not found");
    }

    const personaSlug = personaSlugFromDbId(conversation.personaId);

    const { userMessage, assistantMessage } = await llmService(
        conversationId,
        content,
        personaSlug
    );

    await touchConversation(conversationId);

    return {
        conversation: formatConversation({
            ...conversation,
            updatedAt: new Date(),
        }),
        userMessage,
        assistantMessage,
    };
}
