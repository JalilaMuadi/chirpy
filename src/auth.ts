import argon2 from "argon2";
import { Request } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import crypto from "crypto";
import { db } from "./db/index.js"; 
import { refresh_tokens } from "./db/schema.js"; 
import { eq } from "drizzle-orm";
import { UnauthorizedError } from "./errors.js";

// ==================== Types ====================
export type RefreshTokenRow = {
  token: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
};

// ==================== Refresh Tokens ====================
export function makeRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function saveRefreshTokenToDB(token: string, userId: string, expiresAt: Date) {
  await db.insert(refresh_tokens).values({
    token,
    user_id: userId,
    created_at: new Date(),
    updated_at: new Date(),
    expires_at: expiresAt,
    revoked_at: null,
  }).execute();
}

export async function getRefreshToken(token: string): Promise<RefreshTokenRow | undefined> {
  const [row] = await db.select().from(refresh_tokens).where(eq(refresh_tokens.token, token));
  return row;
}

export async function revokeRefreshToken(token: string) {
  await db.update(refresh_tokens)
    .set({ revoked_at: new Date(), updated_at: new Date() })
    .where(eq(refresh_tokens.token, token))
    .execute();
}

// ==================== JWT ====================
export function getBearerToken(req: Request): string {
  const authHeader = req.get("Authorization");
  if (!authHeader) throw new UnauthorizedError("Authorization header missing");

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) throw new UnauthorizedError("Invalid Authorization header format");

  return token.trim();
}

export function makeJWT(userID: string, expiresIn: number, secret: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const payload: Pick<JwtPayload, "iss" | "sub" | "iat" | "exp"> = {
    iss: "chirpy",
    sub: userID,
    iat,
    exp: iat + expiresIn,
  };
  return jwt.sign(payload, secret);
}

export function validateJWT(tokenString: string, secret: string): string {
  try {
    const decoded = jwt.verify(tokenString, secret) as JwtPayload;
    return decoded.sub as string;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

export function getAPIKey(req: Request): string | null {
  const header = req.headers["authorization"];
  if (!header) return null;

  // Expected header: "ApiKey THE_KEY_HERE"
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "ApiKey") return null;

  return parts[1]; // return key only
}

// ==================== Passwords ====================
export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password);
}

export async function checkPasswordHash(password: string, hash: string): Promise<boolean> {
  return await argon2.verify(hash, password);
}