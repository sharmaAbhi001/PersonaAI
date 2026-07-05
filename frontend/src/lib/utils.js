import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}



export const generateCodeVerifier = () =>{

  const randomByte = new Uint8Array(32);

  window.crypto.getRandomValues(randomByte);
  return btoa(String.fromCharCode(...randomByte))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

}



export async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);

    const hash = await crypto.subtle.digest(
        "SHA-256",
        data
    );

    return btoa(
        String.fromCharCode(
            ...new Uint8Array(hash)
        )
    )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

const OAUTH_STATE_KEY = "oauth_state";
const CODE_VERIFIER_KEY = "code_verifier";

export function saveOAuthState(state) {
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
}

export function saveCodeVerifier(codeVerifier) {
  sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);
}

export function getOAuthState() {
  return sessionStorage.getItem(OAUTH_STATE_KEY);
}

export function getCodeVerifier() {
  return sessionStorage.getItem(CODE_VERIFIER_KEY);
}


