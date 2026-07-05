import OpenAI from "openai";
import {
    createMessage,
    getAllMessagesByConversationId,
} from "../modules/chat/chat.respository.js";
import { executeTool } from "../tools/registry.js";
import { ApiError } from "../utils/ApiError.js";
import { getPersonaYoutubeConfig, resolvePersona } from "../utils/persona.registry.js";

const openai = new OpenAI({
    apiKey: process.env.SARVAM_API_KEY,
    baseURL: process.env.SARVAM_BASE_URL || "https://api.sarvam.ai/v1",
});

const MODEL = process.env.SARVAM_MODEL || "sarvam-105b";

const GREETING_PATTERN =
    /^(h+i+\b|hello|hey|namaste|kaise ho|kaise hai|kaise hain|good morning|good evening)/i;

const ABSURD_PREMISE_PATTERN =
    /kar\s*s[ck]at[ae]|html.*(dsa|algorithm|backend|database|api|logic)|css.*(logic|database|backend|dsa|algorithm)/i;

const TECH_LEARNING_PATTERN =
    /sikh(na|ne|unga|ungi)|seekh(na|ne|unga|ungi)|learn\b|tutorial|roadmap|playlist|course|learning path|video banayi|banayi hai|detailed explanation|batao.*(?:sikh|seekh|learn)/i;

const TECH_DEFINITION_PATTERN =
    /(?:what is|define|explain)\s+[\w\s.#+\-]+|[\w.#+\-]+\s+kya\s+hai/i;

const NON_TECH_QUESTION_PATTERN =
    /(?:mera|mara|mujhe|tumhara|meri|teri|uska|uski|aapka|apka|tum|tu|aap)\s+(?:name|naam|age|umar|plan|kaam|password|number|phone|address)|(?:name|naam|age|umar|plan|kaam)\s+kya\s+hai|(?:kya\s+hai|what\s+is)\s+(?:mera|mara|tumhara|meri|naam|name|age|plan)/i;

const NON_TECH_TOPICS = new Set([
    "name",
    "naam",
    "age",
    "umar",
    "mera",
    "mara",
    "tumhara",
    "meri",
    "teri",
    "plan",
    "kaam",
    "salary",
    "password",
    "login",
    "account",
    "phone",
    "number",
    "address",
    "city",
    "country",
    "favorite",
    "pasand",
    "time",
    "samay",
    "dost",
    "friend",
]);

function isLikelyTechTerm(term) {
    if (!term || term.length < 2) return false;
    const primary = term.toLowerCase().trim().split(/\s+/)[0];
    return !NON_TECH_TOPICS.has(primary);
}

function extractVideoTopic(userContent) {
    const trimmed = userContent.trim();

    let match = trimmed.match(
        /(?:mujhe|muje|main|i want to|want to)\s+([\w.#+\-]+)\s+(?:sikh|seekh)/i
    );
    if (match && isLikelyTechTerm(match[1])) return match[1];

    match = trimmed.match(/([\w.#+\-]+)\s+(?:sikhna|seekhna)\s+hai/i);
    if (match && isLikelyTechTerm(match[1])) return match[1];

    match = trimmed.match(/(?:learn|teach me)\s+([\w.#+\-]+)/i);
    if (match && isLikelyTechTerm(match[1])) return match[1];

    match = trimmed.match(/([\w.#+\-]+)\s+(?:tutorial|roadmap|playlist|course)/i);
    if (match && isLikelyTechTerm(match[1])) return match[1];

    match = trimmed.match(/(?:what is|define|explain)\s+([\w\s.#+\-]+)/i);
    if (match) {
        const topic = match[1].trim().split(/\s+/).slice(0, 3).join(" ");
        if (isLikelyTechTerm(topic)) return topic;
    }

    match = trimmed.match(/([\w.#+\-]+)\s+kya\s+hai/i);
    if (match && isLikelyTechTerm(match[1])) return match[1];

    return null;
}

function isLearningRequest(userContent) {
    const trimmed = userContent.trim();

    if (NON_TECH_QUESTION_PATTERN.test(trimmed)) return false;

    if (TECH_LEARNING_PATTERN.test(trimmed)) {
        return Boolean(extractVideoTopic(trimmed) || /sikh|seekh|learn|tutorial|roadmap|playlist|course/i.test(trimmed));
    }

    if (TECH_DEFINITION_PATTERN.test(trimmed)) {
        return Boolean(extractVideoTopic(trimmed));
    }

    return false;
}

function resolveVideoSearch(userContent, parsed) {
    const learningRequest = isLearningRequest(userContent);

    let videoTopic = parsed.videoTopic?.trim() || null;
    if (videoTopic && !isLikelyTechTerm(videoTopic)) {
        videoTopic = null;
    }

    if (!videoTopic && learningRequest) {
        videoTopic = extractVideoTopic(userContent);
    }

    if (!videoTopic || !isLikelyTechTerm(videoTopic)) {
        return { shouldSearch: false, videoTopic: null };
    }

    const shouldSearch =
        learningRequest || (parsed.suggestVideo === true && isLikelyTechTerm(videoTopic));

    return { shouldSearch, videoTopic };
}

function buildSystemPrompt(persona, userContent) {
    const trimmed = userContent.trim();
    const isGreeting = GREETING_PATTERN.test(trimmed);
    const isAbsurdPremise = ABSURD_PREMISE_PATTERN.test(trimmed);
    const learningRequest = isLearningRequest(userContent);
    const extractedTopic = extractVideoTopic(userContent);
    const isHitesh = persona.slug === "hitesh";
    const channelLabel = persona.youtube.channelLabel;

    let prompt = persona.prompt;

    if (isGreeting) {
        if (isHitesh) {
            prompt += `

[ACTIVE REMINDER: User is greeting you. Reply MUST begin with "Ha ji, kaise hain aap sabhi? Swagat hai sabhi ka Chai aur Code mein." Never use "Hey", "Hello", or generic chatbot English.]`;
        } else {
            prompt += `

[ACTIVE REMINDER: User is greeting you. Respond warmly in Hinglish. Do NOT use generic chatbot English like "Hey!" or "How can I help you today?"]`;
        }
    } else {
        prompt += `

[ACTIVE REMINDER: User did NOT greet — they asked a direct question or topic. Do NOT use a welcome greeting. Jump straight into the answer.]`;
    }

    if (isAbsurdPremise && isHitesh) {
        prompt += `

[ACTIVE REMINDER: User question has a wrong or absurd premise. Open with sarcastic play-along like "Azaad desh hai, kar sakte ho... lekin production me mat kar dena." then "but seriously" and teach with analogy. Do NOT jump straight to a dry lecture. Do NOT add a greeting.]`;
    }

    if (learningRequest) {
        prompt += `

[ACTIVE REMINDER: User wants to learn a tech topic. You MUST set suggestVideo: true and videoTopic to a 2-4 word English search query${extractedTopic ? ` (e.g. "${extractedTopic}")` : ""}. Backend will append a real ${channelLabel} YouTube link — do NOT invent URLs in your reply.]`;
    }

    return prompt;
}

const toOpenAiMessage = ({ role, content }) => ({
    role: role.toLowerCase(),
    content,
});

const buildOpenAiMessages = (dbMessages) =>
    dbMessages
        .filter(({ role }) => role !== "SYSTEM")
        .map(toOpenAiMessage);

function extractJson(rawResponse) {
    const trimmed = rawResponse.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const candidate = fenced ? fenced[1].trim() : trimmed;
    return JSON.parse(candidate);
}

async function callLlm(apiMessages) {
    const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: apiMessages,
    });

    const rawResponse = completion.choices?.[0]?.message?.content?.trim();
    if (!rawResponse) {
        throw new ApiError(502, "Empty response from LLM");
    }

    return rawResponse;
}

async function getPersonaResponse(apiMessages) {
    let rawResponse = await callLlm(apiMessages);

    try {
        return extractJson(rawResponse);
    } catch {
        apiMessages.push({ role: "assistant", content: rawResponse });
        apiMessages.push({
            role: "user",
            content:
                'Invalid JSON. Return ONLY valid JSON: {"reply":"...","suggestVideo":false,"videoTopic":""}',
        });

        rawResponse = await callLlm(apiMessages);

        try {
            return extractJson(rawResponse);
        } catch {
            throw new ApiError(502, "LLM returned invalid JSON");
        }
    }
}

async function appendNoVideoSarcasm(apiMessages, reply, channelLabel) {
    const followUpMessages = [
        ...apiMessages,
        {
            role: "user",
            content: `TOOL_RESULT: ${JSON.stringify({ found: false, channel: channelLabel })}

Your prior reply was:
${reply}

${channelLabel} channel pe is topic pe koi video nahi mili. Add 1-2 short sentences at the end of your reply in your mentor voice. Do NOT suggest videos from other channels. Do NOT invent video URLs.

Return ONLY valid JSON: {"reply":"<full updated reply including prior content plus ending>","suggestVideo":false,"videoTopic":""}`,
        },
    ];

    const parsed = await getPersonaResponse(followUpMessages);
    return parsed.reply?.trim() || reply;
}

export async function llmService(conversationId, userContent, personaSlug) {
    if (!process.env.SARVAM_API_KEY) {
        throw new ApiError(500, "SARVAM_API_KEY is not configured");
    }

    if (!userContent?.trim()) {
        throw new ApiError(400, "Message content is required");
    }

    const persona = resolvePersona(personaSlug);
    const youtubeConfig = getPersonaYoutubeConfig(persona);
    const existingMessages = await getAllMessagesByConversationId(conversationId);
    const systemPrompt = buildSystemPrompt(persona, userContent);
    const apiMessages = [
        { role: "system", content: systemPrompt },
        ...buildOpenAiMessages(existingMessages),
    ];

    if (existingMessages.length === 0) {
        await createMessage(conversationId, "SYSTEM", persona.prompt);
    }

    const userMessage = await createMessage(
        conversationId,
        "USER",
        userContent.trim()
    );
    apiMessages.push(toOpenAiMessage(userMessage));

    const parsed = await getPersonaResponse(apiMessages);
    let finalReply = parsed.reply?.trim();

    if (!finalReply) {
        throw new ApiError(502, "LLM did not produce a reply");
    }

    const { shouldSearch, videoTopic } = resolveVideoSearch(
        userContent,
        parsed
    );

    if (shouldSearch && videoTopic) {
        try {
            const videoResult = await executeTool({
                tool: "YOUTUBE_SEARCH_TOOL",
                input: {
                    query: videoTopic,
                    channelId: youtubeConfig.channelId,
                    channelNameMatch: youtubeConfig.channelNameMatch,
                    channelLabel: youtubeConfig.channelLabel,
                },
            });

            if (videoResult.found) {
                finalReply += `\n\n${youtubeConfig.channelLabel} pe is topic pe ek acchi video hai — ${videoResult.title}: ${videoResult.url}`;
            } else {
                finalReply = await appendNoVideoSarcasm(
                    apiMessages,
                    finalReply,
                    youtubeConfig.channelLabel
                );
            }
        } catch (err) {
            console.error("YouTube search failed:", err.message);
            finalReply = await appendNoVideoSarcasm(
                apiMessages,
                finalReply,
                youtubeConfig.channelLabel
            );
        }
    }

    const assistantMessage = await createMessage(
        conversationId,
        "ASSISTANT",
        finalReply
    );

    return {
        userMessage,
        assistantMessage,
    };
}
