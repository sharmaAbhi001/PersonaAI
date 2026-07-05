import { youtubeSearchTool } from "./youtube.tool.js";

const TOOL_REGISTRY = {
    YOUTUBE_SEARCH_TOOL: youtubeSearchTool,
};

export async function executeTool(request) {
    const tool = typeof request === "string" ? request : request?.tool;
    const input =
        typeof request === "string" ? {} : (request?.input ?? request ?? {});

    const handler = TOOL_REGISTRY[tool];
    if (!handler) {
        throw new Error(
            `Unknown tool "${tool}". Valid tools: ${Object.keys(TOOL_REGISTRY).join(", ")}`
        );
    }

    return handler(input);
}
