import { HiteshSirPersona } from "./HiteshSirPersona.js";
import { PiyushSirPersona } from "./PiyushSirPersona.js";

export const PERSONAS = {
    hitesh: {
        id: "HITESH",
        slug: "hitesh",
        label: "Hitesh Choudhary",
        initial: "H",
        prompt: HiteshSirPersona,
        youtube: {
            channelIdEnv: "CHAI_AUR_CODE_CHANNEL_ID",
            defaultChannelId: "UCNQ6FEtztATuaVhZKCY28Yw",
            channelNameMatch: "chai aur code",
            channelLabel: "Chai aur Code",
        },
    },
    piyush: {
        id: "PIYUSH",
        slug: "piyush",
        label: "Piyush Garg",
        initial: "P",
        prompt: PiyushSirPersona,
        youtube: {
            channelIdEnv: "PIYUSH_GARG_CHANNEL_ID",
            defaultChannelId: "UCf9T51_FmMlfhiGpoes0yFA",
            channelNameMatch: "piyush garg",
            channelLabel: "Piyush Garg",
        },
    },
};

export const DEFAULT_PERSONA_SLUG = "piyush";

export function resolvePersona(slug) {
    const key = slug?.toLowerCase()?.trim() || DEFAULT_PERSONA_SLUG;
    const persona = PERSONAS[key];
    if (!persona) {
        return PERSONAS[DEFAULT_PERSONA_SLUG];
    }
    return persona;
}

export function personaSlugFromDbId(dbId) {
    const entry = Object.values(PERSONAS).find((p) => p.id === dbId);
    return entry?.slug ?? DEFAULT_PERSONA_SLUG;
}

export function personaDbIdFromSlug(slug) {
    return resolvePersona(slug).id;
}

export function isValidPersonaSlug(slug) {
    return Boolean(PERSONAS[slug?.toLowerCase()?.trim()]);
}

export function getPersonaYoutubeConfig(persona) {
    const { youtube } = persona;
    const channelId =
        process.env[youtube.channelIdEnv]?.trim() || youtube.defaultChannelId;

    return {
        channelId,
        channelNameMatch: youtube.channelNameMatch,
        channelLabel: youtube.channelLabel,
    };
}
