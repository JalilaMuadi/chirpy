// src/db/queries/chirps.ts
import { db } from "../index.js";
import { chirps, NewChirp } from "../schema.js";
import { asc, eq } from "drizzle-orm";

// =============================
// Create a new chirp
export async function createChirp(chirp: NewChirp) {
  const [result] = await db
    .insert(chirps)
    .values(chirp)
    .returning();
  return result;
}

// =============================
// Get all chirps ordered by creation date
export async function getAllChirps() {
  return await db
    .select()
    .from(chirps)
    .orderBy(asc(chirps.createdAt));
}

// =============================
// Get a chirp by its ID
export async function getChirpById(id: string) {
  const [chirp] = await db
    .select()
    .from(chirps)
    .where(eq(chirps.id, id));
  return chirp;
}

// =============================