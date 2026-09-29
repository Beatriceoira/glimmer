# Glimmer

**Glimmer** is an interactive fanfiction platform where readers can influence stories through choices and their own words.

It combines traditional branching narratives with AI-powered story narration, allowing readers to explore stories dynamically while giving authors tools to create and manage interactive story graphs.

## Features

* Interactive fanfiction library
* Branching story paths
* Authoring tools for creating story graphs
* Choice-based gameplay
* Custom free-text actions
* AI-powered story narration
* Server-Sent Events (SSE) for streamed AI responses
* JWT-based authentication
* Reader and author roles
* Basic content moderation
* Revenue/turn-based usage system
* Web and React Native mobile clients
* PostgreSQL persistence
* Redis-backed rate limiting and background processing


## Architecture

```text
                         ┌──────────────────┐
                         │   Next.js Web    │
                         │    :3000         │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │   Fastify API    │
                         │    :4000         │
                         └──────┬─────┬──────┘
                                │     │
                    ┌───────────┘     └────────────┐
                    ▼                              ▼
             ┌─────────────┐                ┌─────────────┐
             │ PostgreSQL  │                │    Redis    │
             │    :5432    │                │    :6379    │
             └─────────────┘                └─────────────┘
                    │
                    ▼
             ┌─────────────┐
             │  Anthropic  │
             │     API     │
             └─────────────┘

             React Native / Expo
                     │
                     └──────────────► Fastify API
```

### Components

| Component      | Technology           | Purpose                                    |
| -------------- | -------------------- | ------------------------------------------ |
| Web            | Next.js              | Reader and author interface                |
| Mobile         | Expo / React Native  | Mobile reader                              |
| API            | Fastify + TypeScript | Authentication, stories, gameplay, billing |
| Database       | PostgreSQL           | Users, stories, nodes, choices, sessions   |
| Cache          | Redis                | Rate limiting and background processing    |
| AI             | Anthropic API        | Dynamic story narration                    |
| Authentication | JWT                  | User authentication and authorization      |
| Streaming      | SSE                  | Real-time AI narration                     |


## Project Structure

```text
glimmer/
├── server/
│   ├── src/
│   │   ├── auth.ts
│   │   ├── auth-plugin.ts
│   │   ├── config.ts
│   │   ├── db.ts
│   │   ├── game.ts
│   │   ├── ai.ts
│   │   ├── turns.ts
│   │   ├── index.ts
│   │   └── routes/
│   │       ├── stories.ts
│   │       ├── play.ts
│   │       └── billing.ts
│   ├── migrations/
│   ├── package.json
│   └── .env.example
│
├── web/
│   ├── app/
│   ├── components/
│   ├── package.json
│   └── .env.example
│
├── mobile/
│   ├── app/
│   ├── components/
│   ├── package.json
│   └── .env.example
│
├── docker-compose.yml
└── README.md
```

# Requirements

Install the following before running Glimmer:

* Node.js
* npm
* Docker
* Docker Compose
* Git

For Android development:

* Android SDK
* Android Emulator
* Android Virtual Device (AVD)

---

# Local Development

## 1. Clone the repository

```bash
git clone <repository-url>
cd glimmer
```

## 2. Start PostgreSQL and Redis

```bash
docker compose up -d postgres redis
```

Verify:

```bash
docker compose ps
```

You should see both services running.

# Backend

## 3. Configure the server

```bash
cd server
cp .env.example .env
```

Edit `.env` if necessary:

```env
DATABASE_URL=postgres://glimmer:glimmer@localhost:5432/glimmer
REDIS_URL=redis://localhost:6379

JWT_SECRET=change-me
CORS_ORIGIN=http://localhost:3000

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-haiku-4-5-20251001

MAX_TURNS=10
REFILL_MS=180000

CHOICE_COST=0
AI_COST=1

REVENUECAT_WEBHOOK_SECRET=
```

For anything beyond local development, replace `JWT_SECRET` with a strong randomly generated secret.


## 4. Install dependencies

```bash
npm install
```


## 5. Run database migrations

```bash
npm run migrate
```


## 6. Seed the database

```bash
npm run seed
```

## 7. Start the API

Load the environment variables:

```bash
export $(cat .env | xargs)
```

Then:

```bash
npm run dev
```

The API should be available at:

```text
http://localhost:4000
```

Test the health endpoint:

```bash
curl http://localhost:4000/health
```

Expected:

```json
{"ok":true}
```

# Web Application

Open another terminal.

```bash
cd ~/Projects/glimmer/web
```

Create the environment file:

```bash
cp .env.example .env.local
```

Install dependencies:

```bash
npm install
```

Start Next.js:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

The web application communicates with the Fastify API running on port `4000`.

```text
Browser
   │
   ▼
Next.js :3000
   │
   ▼
Fastify :4000
```

# Mobile Application

Open another terminal:

```bash
cd ~/Projects/glimmer/mobile
```

Configure the environment:

```bash
cp .env.example .env
```

Install dependencies:

```bash
npm install
```

Synchronize Expo dependencies:

```bash
npx expo install --fix
```

Start Expo:

```bash
npx expo start
```

For Android, ensure an emulator is running.

Example:

```bash
~/Android/Sdk/emulator/emulator -avd Pixel_7 -no-snapshot -gpu swiftshader
```

Then verify ADB:

```bash
adb devices
```

The emulator should appear as:

```text
emulator-5554    device
```

# Environment Variables

## Server

| Variable                    | Description                            |
| --------------------------- | -------------------------------------- |
| `DATABASE_URL`              | PostgreSQL connection string           |
| `REDIS_URL`                 | Redis connection string                |
| `JWT_SECRET`                | JWT signing secret                     |
| `CORS_ORIGIN`               | Allowed frontend origins               |
| `ANTHROPIC_API_KEY`         | Anthropic API key                      |
| `ANTHROPIC_MODEL`           | Anthropic model used for narration     |
| `MAX_TURNS`                 | Maximum available turns                |
| `REFILL_MS`                 | Turn regeneration interval             |
| `CHOICE_COST`               | Cost of selecting a predefined choice  |
| `AI_COST`                   | Cost of submitting a custom AI action  |
| `REVENUECAT_WEBHOOK_SECRET` | RevenueCat webhook verification secret |

# AI Narration

Glimmer can use the Anthropic API to generate dynamic story narration.

Set:

```env
ANTHROPIC_API_KEY=your_api_key
```

The selected model is configured through:

```env
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

If `ANTHROPIC_API_KEY` is empty, free-text actions use the application's fallback behavior instead of making an Anthropic API request.

# Authentication

Glimmer uses JWT authentication.

Authentication flow:

```text
Register / Login
       │
       ▼
   JWT Token
       │
       ▼
Authenticated API requests
       │
       ├── Reader permissions
       │
       └── Author permissions
```

Supported roles include:

* `reader`
* `author`

Protected endpoints validate the JWT before processing the request.


# Story System

Stories are represented as a graph of interconnected nodes.

```text
             ┌─────────────┐
             │ Start Scene │
             └──────┬──────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
   ┌─────────────┐     ┌─────────────┐
   │   Choice A  │     │   Choice B  │
   └──────┬──────┘     └──────┬──────┘
          │                   │
          ▼                   ▼
      Scene A             Scene B
          │                   │
          └─────────┬─────────┘
                    ▼
                Ending
```

Each story can contain:

* Story metadata
* Story nodes
* Choices
* State requirements
* State variables
* Ending nodes
* Custom-action support

# Gameplay

Readers can interact with a story in two ways.

### Predefined choices

A reader selects one of the choices presented by the author.

```text
┌────────────────────────────────┐
│ What do you do?                │
│                                │
│ [ Open the mysterious door ]   │
│ [ Walk away ]                  │
└────────────────────────────────┘
```

### Custom actions

Stories can optionally allow free-text actions:

```text
> I knock three times before opening the door.
```

The server processes the action and can use the AI narration system to generate the resulting story beat.

# Server-Sent Events

AI narration can be streamed to the client using Server-Sent Events.

```text
Client
  │
  │ POST custom action
  ▼
Fastify
  │
  │ Anthropic request
  ▼
Anthropic API
  │
  │ streamed tokens
  ▼
Fastify
  │
  │ SSE
  ▼
Client
```

This allows generated narration to appear progressively rather than waiting for the entire response.


# Database

PostgreSQL stores persistent application state, including:

* Users
* Authentication data
* Stories
* Story nodes
* Node choices
* Player sessions
* Story state
* Usage/turn information

Database migrations are located in:

```text
server/migrations/
```

Run migrations with:

```bash
npm run migrate
```

Seed development data with:

```bash
npm run seed
```

# Redis

Redis is used for application infrastructure such as:

* Rate limiting
* Temporary state
* Background processing

Start Redis with:

```bash
docker compose up -d redis
```

# API Health Check

Once the backend is running:

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{
  "ok": true
}
```

If the web application displays:

```text
Failed to fetch
```

verify that the Fastify server is running and that the web application's API URL points to:

```text
http://localhost:4000
```

# Troubleshooting

## Docker permission denied

If Docker reports:

```text
permission denied while trying to connect to the Docker daemon socket
```

add your user to the Docker group:

```bash
sudo usermod -aG docker $USER
```

Log out and back in, then verify:

```bash
docker ps
```

## API reports `app.auth` is undefined

Authentication decorators must be registered on the root Fastify instance before protected routes are registered.

The expected order is:

```text
Fastify
  ↓
JWT
  ↓
auth / authorOnly decorators
  ↓
auth routes
  ↓
story routes
  ↓
play routes
```


## Web displays `Failed to fetch`

Check the API:

```bash
curl http://localhost:4000/health
```

If this fails, start the backend:

```bash
cd server
npm run dev
```

Then restart or refresh the web application.

## Android emulator shows `offline`

Check:

```bash
adb devices
```

If necessary:

```bash
adb kill-server
adb start-server
adb devices
```

Wait for the emulator to finish booting before starting Expo.

# Development Commands

## Server

```bash
npm run dev
```

## Web

```bash
npm run dev
```

## Database migration

```bash
npm run migrate
```

## Database seed

```bash
npm run seed
```

## Expo

```bash
npx expo start
```

# Security Notes

This repository is configured primarily for local development.

Before production deployment:

* Replace `JWT_SECRET`
* Use HTTPS
* Restrict CORS origins
* Store secrets outside source control
* Configure production PostgreSQL credentials
* Configure production Redis credentials
* Configure Anthropic API credentials securely
* Verify RevenueCat webhook signatures
* Strengthen moderation and abuse prevention
* Configure production rate limits
* Review authentication/session expiration
* Do not commit `.env`, `.env.local`, or other secret files

# Current Development Scope

The project intentionally uses relatively simple implementations for several areas:

* Plain CSS rather than a UI framework
* A textarea-based authoring interface rather than TipTap
* Simple mobile navigation/state management
* PostgreSQL joins instead of Neo4j
* Basic denylist-based moderation

These choices keep the prototype straightforward while leaving room for future expansion.

---

# License

This project is currently intended for development and educational purposes. Add an appropriate open-source or proprietary license before public distribution.
