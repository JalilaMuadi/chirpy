import "dotenv/config";
import { users, chirps } from "./db/schema.js";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";  

import express, { Request, Response, NextFunction } from "express";
import { config } from './config.js';
import { 
  CustomError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError
} from "./errors.js";
import { createUser, deleteAllUsers, getUserByEmail, upgradeUserToChirpyRed  } from "./db/queries/users.js";
import { createChirp, getAllChirps, getChirpById } from "./db/queries/chirps.js";
import { hashPassword, 
    checkPasswordHash, 
    getBearerToken, 
    makeJWT, validateJWT, 
    getRefreshToken, makeRefreshToken, 
    saveRefreshTokenToDB, revokeRefreshToken, getAPIKey } from "./auth.js";

const app = express();
const PORT = 8080;
app.use(express.json());

// =============================
// Middleware: log non-OK responses
function middlewareLogResponses(req: Request, res: Response, next: NextFunction): void {
  res.on("finish", () => {
    if (res.statusCode !== 200) {
      console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${res.statusCode}`);
    }
  });
  next();
}
app.use(middlewareLogResponses);

// =============================
// Readiness endpoint
function handlerReadiness(req: Request, res: Response): void {
  res.set("Content-Type", "text/plain; charset=utf-8").send("OK");
}
app.get("/api/healthz", handlerReadiness);

// =============================
// Middleware: count fileserver hits
function middlewareMetricsInc(req: Request, res: Response, next: NextFunction): void {
  console.log(config.api.fileserverHits);
  config.api.fileserverHits++;  
  next();
}
app.use("/app", middlewareMetricsInc, express.static("./src/app"));

// =============================
// Admin metrics endpoint
app.get("/admin/metrics", (req: Request, res: Response) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <html>
      <body>
        <h1>Welcome, Chirpy Admin</h1>
        <p>Chirpy has been visited ${config.api.fileserverHits} times!</p>
      </body>
    </html>
  `);
});

// =============================
// Reset endpoint
app.post("/admin/reset", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (config.api.platform !== "dev") {
      return res.status(403).json({ error: "Forbidden" });
    }
    config.api.fileserverHits = 0;
    await deleteAllUsers();
    res.set("Content-Type", "text/plain; charset=utf-8")
       .send(`Hits reset and all users deleted\n`);
  } catch (err) {
    next(err);
  }
});

// =============================
// Create user
app.post("/api/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    if (!password) return res.status(400).json({ error: "Password is required" });

    const hashedPassword = await hashPassword(password);
    const user = await createUser({ email, hashed_password: hashedPassword });

    // convert is_chirpy_red → isChirpyRed
    const { hashed_password, is_chirpy_red, ...rest } = user;
    res.status(201).json({ ...rest, isChirpyRed: user.is_chirpy_red });
  } catch (err) {
    next(err);
  }
});

// =============================
// Login
app.post("/api/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Incorrect email or password" });

    const passwordMatch = await checkPasswordHash(password, user.hashed_password);
    if (!passwordMatch) return res.status(401).json({ error: "Incorrect email or password" });

    const token = makeJWT(user.id, 3600, config.api.jwtSecret);
    const refreshToken = makeRefreshToken();
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); 
    await saveRefreshTokenToDB(refreshToken, user.id, expiresAt);

    const { is_chirpy_red, hashed_password, ...rest } = user;
    res.status(200).json({ ...rest, isChirpyRed: user.is_chirpy_red, token, refreshToken });
  } catch (err) {
    next(err);
  }
});

// =============================
// Refresh token
app.post("/api/refresh", async (req, res, next) => {
  try {
    const refreshToken = getBearerToken(req);
    const dbToken = await getRefreshToken(refreshToken);
    if (!dbToken || dbToken.revoked_at !== null || dbToken.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedError("Invalid refresh token");
    }
    const newToken = makeJWT(dbToken.user_id, 3600, config.api.jwtSecret);
    res.status(200).json({ token: newToken });
  } catch (err) {
    next(err);
  }
});

// =============================
// Revoke refresh token
app.post("/api/revoke", async (req, res, next) => {
  try {
    const refreshToken = getBearerToken(req);
    await revokeRefreshToken(refreshToken); 
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// =============================
// Polka webhook
app.post("/api/polka/webhooks", async (req, res, next) => {
  try {
    const key = getAPIKey(req);
    if (key !== config.api.polkaKey) return res.status(401).json({ error: "Unauthorized" });

    const { event, data } = req.body;
    if (event !== "user.upgraded") return res.status(204).send();

    const user = await upgradeUserToChirpyRed(data.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// =============================
// Create chirp
app.post("/api/chirps", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    const userId = validateJWT(token, config.api.jwtSecret);

    const { body } = req.body;
    if (!body) return res.status(400).json({ error: "Missing body" });
    if (body.length > 140) return res.status(400).json({ error: "Chirp is too long" });

    const chirp = await createChirp({ body, userId });
    res.status(201).json(chirp);
  } catch (err) {
    next(err);
  }
});

// =============================
// Get chirp by ID
app.get("/api/chirps/:chirpId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chirpId } = req.params;
    const chirp = await getChirpById(chirpId as string);
    if (!chirp) return res.status(404).json({ error: "Chirp not found" });

    res.status(200).json({
      id: chirp.id,
      createdAt: chirp.createdAt,
      updatedAt: chirp.updatedAt,
      body: chirp.body,
      userId: chirp.userId,
    });
  } catch (err) {
    next(err);
  }
});

// =============================
// Delete chirp
app.delete("/api/chirps/:chirpId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getBearerToken(req);
    const userId = validateJWT(token, config.api.jwtSecret);

    const chirpId = req.params.chirpId as string;
    const chirp = await getChirpById(chirpId);
    if (!chirp) return res.status(404).json({ error: "Chirp not found" });
    if (chirp.userId !== userId) return res.status(403).json({ error: "Forbidden: You can only delete your own chirps" });

    await db.delete(chirps).where(eq(chirps.id, chirpId)).execute();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// =============================
// Get chirps list
app.get("/api/chirps", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let authorId = typeof req.query.authorId === "string" ? req.query.authorId : "";
    let sortOrder: "asc" | "desc" = req.query.sort === "desc" ? "desc" : "asc";

    let chirpsData = await getAllChirps();
    if (authorId) chirpsData = chirpsData.filter((c) => c.userId === authorId);

    chirpsData.sort((a, b) => {
      if (sortOrder === "asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.status(200).json(chirpsData);
  } catch (err) {
    next(err);
  }
});

// =============================
// Error middleware
function errorHandler(
  err: unknown, 
  req: Request, 
  res: Response, 
  next: NextFunction) {

    console.log(err);
    
    if (err instanceof CustomError) 
      return res
        .status(err.statusCode)
        .json({ error: err.message });
    
    return res.status(500).json({ error: "Internal Server Error" });
}
app.use(errorHandler);

// =============================
// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});