import { describe, it, expect, beforeAll } from "vitest";
import { makeJWT, validateJWT, getBearerToken } from "./auth";
import { Request } from "express";


describe("getBearerToken", () => {
  it("extracts token correctly", () => {
    const req: any = { get: () => "Bearer mytoken123" };
    expect(getBearerToken(req)).toBe("mytoken123");
  });

  it("throws error if header missing", () => {
    const req: any = { get: () => null };
    expect(() => getBearerToken(req)).toThrow();
  });
});

describe("JWT Tests", () => {
  const secret = "supersecret";
  let token: string;
  const userID = "123";

  beforeAll(() => {
    token = makeJWT(userID, 60, secret);
  });

  it("should validate correct token", () => {
    const id = validateJWT(token, secret);
    expect(id).toBe(userID);
  });

  it("should reject invalid token", () => {
    expect(() => validateJWT(token + "wrong", secret)).toThrow();
  });

  it("should reject expired token", () => {
    const expiredToken = makeJWT(userID, -10, secret);  
    expect(() => validateJWT(expiredToken, secret)).toThrow();
  });
});