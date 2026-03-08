
# Chirpy 🚀

A lightweight **social media backend** where users post short messages (“chirps”) and manage **Chirpy Red** memberships.  
Built with **TypeScript**, **Express**, and **PostgreSQL (Drizzle ORM)**.

---

## 🌟 Key Features

- User registration & login with **hashed passwords**  
- Create, read, and delete chirps  
- **Chirpy Red** membership upgrades via secure webhooks  
- **JWT authentication** & refresh tokens  
- Metrics & admin endpoints for monitoring  

---

## 🛠️ Tech Stack

**TypeScript | Express | Drizzle ORM | PostgreSQL | JWT | Argon2**

---

## ⚡ Quick Start

```bash
git clone https://github.com/YourUsername/chirpy.git
cd chirpy
npm install
npm run dev
````

Server runs at: `http://localhost:8080`

Create a `.env` file with:

```env
DB_URL=your_database_url
JWT_SECRET=your_jwt_secret
POLKA_KEY=your_polka_api_key
PLATFORM=dev
```

---

## 🔗 API Endpoints

| Method | Endpoint             | Description                                   |        |
| ------ | -------------------- | --------------------------------------------- | ------ |
| POST   | /api/users           | Register a new user                           |        |
| POST   | /api/login           | Login + JWT & refresh token                   |        |
| POST   | /api/refresh         | Refresh JWT                                   |        |
| POST   | /api/revoke          | Revoke refresh token                          |        |
| POST   | /api/chirps          | Create a chirp (auth required)                |        |
| GET    | /api/chirps          | List chirps (filter `authorId`, sort `asc     | desc`) |
| GET    | /api/chirps/:chirpId | Get single chirp by ID                        |        |
| DELETE | /api/chirps/:chirpId | Delete your own chirp                         |        |
| POST   | /api/polka/webhooks  | Secure webhook to upgrade users to Chirpy Red |        |
| GET    | /admin/metrics       | View visit metrics (admin only)               |        |
| POST   | /admin/reset         | Reset users & hits (dev only)                 |        |


