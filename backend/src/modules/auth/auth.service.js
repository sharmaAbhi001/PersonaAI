import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import prisma from "../../config/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import axios from "axios";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const formatUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatar: user.avatar,
});

const verifyGoogleCredential = async (credential) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new ApiError(500, "GOOGLE_CLIENT_ID is not configured");
  }

  let payload;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(401, "Invalid or expired Google credential");
  }

  if (!payload?.sub || !payload?.email) {
    throw new ApiError(401, "Invalid Google token");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || null,
    avatar: payload.picture || null,
  };
};

const signToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, "JWT_SECRET is not configured");
  }

  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const findOrLinkGoogleUser = async (profile) => {
  const byGoogleId = await prisma.user.findUnique({
    where: { googleId: profile.googleId },
  });

  if (byGoogleId) {
    return prisma.user.update({
      where: { id: byGoogleId.id },
      data: {
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
      },
    });
  }

  const byEmail = await prisma.user.findUnique({
    where: { email: profile.email },
  });

  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleId: profile.googleId,
        name: profile.name,
        avatar: profile.avatar,
      },
    });
  }

  return prisma.user.create({
    data: profile,
  });
};

export const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: COOKIE_MAX_AGE,
});

export const googleAuth = async (credential) => {
  const profile = await verifyGoogleCredential(credential);
  const user = await findOrLinkGoogleUser(profile);

  return {
    user: formatUser(user),
    token: signToken(user.id),
  };
};

export const getUserById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return formatUser(user);
};

const getJwksClient = () => {
  return jwksClient({
    jwksUri:
      process.env.GOOGLE_JWKS_URI ||
      "https://www.googleapis.com/oauth2/v3/certs",
    rateLimit: true,
    cache: true,
  });
};

const getSigningKey = async (kid) => {
  const client = getJwksClient();

  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) {
        reject(err);
        return;
      }
      const signingKey = key.getPublicKey();
      resolve(signingKey);
    });
  });
};

const verifyGoogleIdToken = async (token) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new ApiError(500, "GOOGLE_CLIENT_ID is not configured");
  }

  const decoded = jwt.decode(token, { complete: true });

  if (!decoded?.header?.kid) {
    throw new ApiError(401, "Invalid Google ID token");
  }

  const kid = decoded.header.kid;

  try {
    const signingKey = await getSigningKey(kid);
    const issuer =
      process.env.GOOGLE_ISSUER || "https://accounts.google.com";

    return jwt.verify(token, signingKey, {
      algorithms: ["RS256"],
      audience: process.env.GOOGLE_CLIENT_ID,
      issuer: [issuer, "accounts.google.com"],
    });
  } catch {
    throw new ApiError(401, "Invalid or expired Google ID token");
  }
};

export const googleSignup = async (code, codeVerifier) => {
  if (!process.env.GOOGLE_REDIRECT_URI) {
    throw new ApiError(500, "GOOGLE_REDIRECT_URI is not configured");
  }

  const params = new URLSearchParams({
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
  });

  const tokenUrl =
    process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";

  let tokenResponse;

  try {
    tokenResponse = await axios.post(tokenUrl, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  } catch {
    throw new ApiError(401, "Failed to exchange authorization code with Google");
  }

  const { id_token } = tokenResponse.data;

  if (!id_token) {
    throw new ApiError(401, "No ID token found in the response");
  }

  const decodedToken = await verifyGoogleIdToken(id_token);

  if (!decodedToken?.sub || !decodedToken?.email) {
    throw new ApiError(401, "Invalid Google token");
  }

  const user = await findOrLinkGoogleUser({
    googleId: decodedToken.sub,
    email: decodedToken.email,
    name: decodedToken.name || null,
    avatar: decodedToken.picture || null,
  });

  return {
    user: formatUser(user),
    token: signToken(user.id),
  };
};
