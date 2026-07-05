import { createHash, randomBytes } from "crypto";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import prisma from "../../config/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import axios from "axios";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ACCESS_TOKEN_TYPE = "access";
const DEFAULT_ACCESS_EXPIRES_IN = "15m";
const DEFAULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

const formatUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatar: user.avatar,
});

const parseDurationMs = (value, fallbackMs) => {
  if (!value) return fallbackMs;

  const match = String(value).trim().match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return amount * multipliers[unit];
};

export const getAccessSecret = () => {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new ApiError(500, "JWT_ACCESS_SECRET is not configured");
  }

  return secret;
};

const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");

const generateOpaqueToken = () => randomBytes(32).toString("base64url");

const generateFamilyId = () => randomBytes(16).toString("hex");

export const signAccessToken = (userId) => {
  return jwt.sign(
    { userId, type: ACCESS_TOKEN_TYPE },
    getAccessSecret(),
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || DEFAULT_ACCESS_EXPIRES_IN,
    }
  );
};

const createRefreshToken = async (userId, familyId = generateFamilyId()) => {
  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() +
      parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN, DEFAULT_REFRESH_MS)
  );

  const row = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      familyId,
      expiresAt,
    },
  });

  return { token, id: row.id, familyId };
};

export const issueTokenPair = async (userId) => {
  const accessToken = signAccessToken(userId);
  const { token: refreshToken } = await createRefreshToken(userId);

  return { accessToken, refreshToken };
};

const revokeFamily = async (familyId) => {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const rotateRefreshToken = async (rawRefreshToken) => {
  if (!rawRefreshToken || typeof rawRefreshToken !== "string") {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const tokenHash = hashToken(rawRefreshToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!existing) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  if (existing.revokedAt) {
    await revokeFamily(existing.familyId);
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  if (existing.expiresAt <= new Date()) {
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const { token: refreshToken, id: newTokenId } = await createRefreshToken(
    existing.userId,
    existing.familyId
  );

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: {
      revokedAt: new Date(),
      replacedById: newTokenId,
    },
  });

  return {
    accessToken: signAccessToken(existing.userId),
    refreshToken,
  };
};

export const revokeRefreshToken = async (rawRefreshToken) => {
  if (!rawRefreshToken || typeof rawRefreshToken !== "string") {
    return;
  }

  const tokenHash = hashToken(rawRefreshToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!existing || existing.revokedAt) {
    return;
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });
};

export const revokeAllUserRefreshTokens = async (userId) => {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

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

export const googleAuth = async (credential) => {
  const profile = await verifyGoogleCredential(credential);
  const user = await findOrLinkGoogleUser(profile);
  const tokens = await issueTokenPair(user.id);

  return {
    user: formatUser(user),
    ...tokens,
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

  const tokens = await issueTokenPair(user.id);

  return {
    user: formatUser(user),
    ...tokens,
  };
};
