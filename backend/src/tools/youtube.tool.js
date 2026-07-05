import axios from "axios";

function matchesChannelTitle(channelTitle, channelNameMatch) {
    return channelTitle?.toLowerCase().includes(channelNameMatch.toLowerCase());
}

export async function youtubeSearchTool(input) {
    const query = input?.query?.trim();
    if (!query) {
        return { found: false, error: "query is required" };
    }

    const channelId = input?.channelId?.trim();
    const channelNameMatch = input?.channelNameMatch?.trim();
    const channelLabel = input?.channelLabel?.trim() || "YouTube";

    if (!channelId || !channelNameMatch) {
        return { found: false, error: "channelId and channelNameMatch are required" };
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        throw new Error("YOUTUBE_API_KEY is not configured");
    }

    const youtubeApiBase =
        process.env.YOUTUBE_API_BASE_URL ||
        "https://www.googleapis.com/youtube/v3";
    const youtubeWatchBase =
        process.env.YOUTUBE_WATCH_BASE_URL || "https://www.youtube.com/watch";

    const response = await axios.get(`${youtubeApiBase}/search`, {
        params: {
            part: "snippet",
            q: query,
            channelId,
            type: "video",
            maxResults: 3,
            order: "relevance",
            key: apiKey,
        },
    });

    const items = response.data?.items ?? [];

    for (const item of items) {
        const snippet = item?.snippet;
        const videoId = item?.id?.videoId;
        const channelTitle = snippet?.channelTitle;

        if (!videoId || !matchesChannelTitle(channelTitle, channelNameMatch)) {
            continue;
        }

        return {
            found: true,
            title: snippet.title,
            url: `${youtubeWatchBase}?v=${videoId}`,
            thumbnail:
                snippet.thumbnails?.medium?.url ??
                snippet.thumbnails?.default?.url ??
                null,
            channelTitle,
            channelLabel,
        };
    }

    return { found: false, query, channelLabel };
}
