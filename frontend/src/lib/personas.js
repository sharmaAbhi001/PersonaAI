export const PERSONAS = [
  { id: "piyush", label: "Piyush Garg", initial: "P" },
  { id: "hitesh", label: "Hitesh Choudhary", initial: "H" },
];

export const DEFAULT_PERSONA_ID = "piyush";

export const PERSONA_STORAGE_KEY = "genpersona:selectedPersona";

export const PERSONA_SWITCH_WARNING_KEY = "genpersona:personaSwitchWarningSeen";

export function getStoredPersonaId() {
  const stored = localStorage.getItem(PERSONA_STORAGE_KEY);
  if (PERSONAS.some((p) => p.id === stored)) {
    return stored;
  }
  return DEFAULT_PERSONA_ID;
}

export function setStoredPersonaId(personaId) {
  localStorage.setItem(PERSONA_STORAGE_KEY, personaId);
}

export function hasSeenPersonaSwitchWarning() {
  return localStorage.getItem(PERSONA_SWITCH_WARNING_KEY) === "1";
}

export function markPersonaSwitchWarningSeen() {
  localStorage.setItem(PERSONA_SWITCH_WARNING_KEY, "1");
}

export function getPersonaById(id) {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}
