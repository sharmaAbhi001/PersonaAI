import { useEffect, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  getCodeVerifier,
  getOAuthState,
  saveCodeVerifier,
  saveOAuthState,
} from "@/lib/utils";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const REDIRECT_URI =
  import.meta.env.VITE_GOOGLE_REDIRECT_URI ||
  `${import.meta.env.VITE_APP_URL || window.location.origin}/login`;
const GOOGLE_AUTH_URL =
  import.meta.env.VITE_GOOGLE_AUTH_URL ||
  "https://accounts.google.com/o/oauth2/v2/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState("");
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);
  const handledRef = useRef(false);

  const handleGoogleCodeLogin = async () => {
    setError("");
    const codeVerifier = generateCodeVerifier();
    const state = crypto.randomUUID();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    saveOAuthState(state);
    saveCodeVerifier(codeVerifier);

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      access_type: "offline",
    });

    window.location.href = `${GOOGLE_AUTH_URL}?${params}`;
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError("");

    try {
      const response = await api.post("/auth/google", {
        credential: credentialResponse.credential,
      });
      const data = response.data?.data;
      login(data?.user, {
        accessToken: data?.accessToken,
        refreshToken: data?.refreshToken,
      });
      navigate("/chat", { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.message || "Google login failed. Please try again.";
      setError(message);
      console.error("Google login failed:", message);
    }
  };

  useEffect(() => {
    if (handledRef.current) return;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");

    if (!code && !oauthError) return;

    handledRef.current = true;
    setIsProcessingCallback(true);

    if (oauthError) {
      setError(`Google sign-in failed: ${oauthError}`);
      setIsProcessingCallback(false);
      setSearchParams({}, { replace: true });
      return;
    }

    const storedState = getOAuthState();
    const codeVerifier = getCodeVerifier();

    if (!state || state !== storedState) {
      setError("Invalid OAuth state. Please try again.");
      setIsProcessingCallback(false);
      setSearchParams({}, { replace: true });
      return;
    }

    if (!codeVerifier) {
      setError("Missing PKCE code verifier. Please try again.");
      setIsProcessingCallback(false);
      setSearchParams({}, { replace: true });
      return;
    }

    async function exchangeCode() {
      try {
        const response = await api.post("/auth/google/signup", {
          code,
          codeVerifier,
        });
        const data = response.data?.data;
        login(data?.user, {
          accessToken: data?.accessToken,
          refreshToken: data?.refreshToken,
        });
        setSearchParams({}, { replace: true });
        navigate("/chat", { replace: true });
      } catch (err) {
        const message =
          err.response?.data?.message ||
          "Failed to exchange authorization code for access token.";
        setError(message);
        setIsProcessingCallback(false);
        setSearchParams({}, { replace: true });
      }
    }

    exchangeCode();
  }, [searchParams, navigate, setSearchParams, login]);

  return (
    <div className="relative flex min-h-dvh items-center justify-center p-4">
      <ThemeToggle className="absolute top-4 right-4" />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">GenPersona</CardTitle>
          <CardDescription>
            {isProcessingCallback
              ? "Signing you in..."
              : "Sign in with Google to start chatting"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {error ? (
            <p className="w-full rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {isProcessingCallback ? (
            <p className="text-sm text-muted-foreground">Processing...</p>
          ) : (
            <>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() =>
                  setError("Google sign-in was cancelled or failed.")
                }
                useOneTap
                theme="outline"
                size="large"
                text="continue_with"
                shape="rectangular"
              />
              <Button variant="outline" onClick={handleGoogleCodeLogin}>
                Login with Google (code flow)
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
