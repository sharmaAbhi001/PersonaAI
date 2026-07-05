import prisma from "../../config/prisma.js";



// create a conversation 

export async function createConversation(userId, title, personaId = "PIYUSH") {
    return prisma.conversation.create({
        data: {
            userId,
            title,
            personaId,
        },
    });
}

export async function createMessage(conversationId, role, content) {
    return prisma.message.create({
        data: {
            conversationId,
            role,
            content,
        },
    });
}

export async function allConversation(userId) {
    return prisma.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: {
            id: true,
            title: true,
            personaId: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}

export async function touchConversation(conversationId) {
    return prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
    });
}

// get a conversation by id
export async function getConversationById(id,userId) {
    const conversation = await prisma.conversation.findFirst({
        where: {
            id,
            userId,
        },
        include: {
            messages: {
                orderBy: { createdAt: "asc" },
                where: {
                    role: { in: ["USER", "ASSISTANT"] },
                },
            },
        },
    });
    return conversation;

}

// get all messages by conversation id
export async function getAllMessagesByConversationId(conversationId) {
    return prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
    });
}

// get a message by id
export async function getMessageById(id) {
    const message = await prisma.message.findUnique({
        where: {    
            id,
        },
    });
    return message;
}
