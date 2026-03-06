// src/db/queries/users.ts
import { db } from "../index.js";
import { NewUser, users } from "../schema.js";
import { eq } from "drizzle-orm";

// =============================
// Create a new user (ignore if exists)
export async function createUser(user: NewUser) {
  const [result] = await db
    .insert(users)
    .values(user)
    .onConflictDoNothing()
    .returning();
  return result;
}

// =============================
// Delete all users (use with caution)
export async function deleteAllUsers() {
  await db.delete(users).execute();
}

// =============================
// Get a user by email
export async function getUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));
  return user;
}

// =============================
// Upgrade user to Chirpy Red
export async function upgradeUserToChirpyRed(userId: string) {
  const [user] = await db
    .update(users)
    .set({ is_chirpy_red: true })
    .where(eq(users.id, userId))
    .returning();
  return user;
}

// =============================