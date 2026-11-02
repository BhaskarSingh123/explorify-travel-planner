# Explorify Travel Planner (Node.js)

An AI-powered travel planning agent built with Google Gemini, featuring real-time flight, train, and hotel search with agentic function calling.

Converted to Node.js from the original Rust implementation: [Explorify-market-place/explorify-travel-planner](https://github.com/Explorify-market-place/explorify-travel-planner).

---

## 🌟 Overview

**Explorify Travel Planner** acts as an autonomous AI travel architect. It ingests user requests, converses to clarify ambiguities, searches live travel providers across flights, trains, and hotels, and synthesizes complete, structured itineraries with direct booking links and pricing in INR.

The system uses Google Gemini's function calling capability to retrieve real-time data dynamically:
- **Flights**: Google Flights (RapidAPI) for one-way flight search, booking options, and direct booking links.
- **Trains**: Indian Railways / IRCTC (RapidAPI) for station-to-station train discovery and live seat availability across classes and quotas.
- **Hotels**: Booking.com (RapidAPI) for coordinate-based hotel search, detailed room highlights, amenities, and live availability.
- **Places & Attractions**: Google Places API (New Text Search) for landmark information, reviews, ratings, and photos.

---

## 🚀 Tech Stack

- **Runtime**: Node.js (v18+ recommended, ES Modules)
- **Web Framework**: Express.js
- **AI Engine**: Google Gemini AI (`@google/generative-ai`) with Function Calling & Structured Output Schema
- **HTTP Client**: Axios
- **Date & Time Utilities**: Day.js with UTC and Timezone (Asia/Kolkata / IST)
- **External APIs**:
  - Google Gemini API
  - Google Places API (New)
  - Google Flights API via RapidAPI
  - Booking.com API via RapidAPI
  - IRCTC Train API via RapidAPI

---

## 🏗️ Architecture & Agentic Loop

The core agent loop mimics the Rust backend architecture with asynchronous dispatch and streaming responses:

```
                  +---------------------------+
                  |  Client POST /api/plan    |
                  +-------------+-------------+
                                |
                                v
               +--------------------------------+
               |  Check API_SECRET & Session    |
               +----------------+---------------+
                                |
                                v
        +-----------------------------------------------+
        |               planTour Loop                   |
        |                                               |
        |  1. Check last message for functionCall       |
        |     - If present: executeCalls(...)           |
        |       * Resolves flight tokens (TOKEN_N)     |
        |       * Runs all API tools concurrently       |
        |       * Adds role: 'function' response        |
        |       * Streams functionResponse chunk        |
        |                                               |
        |  2. Send message / history to Gemini          |
        |     * Retry on UNAVAILABLE errors (max 3)     |
        |     * Stream model response chunks to client  |
        |                                               |
        |  3. Check if Gemini made new function calls:  |
        |     - Yes: Repeat loop with new tool calls    |
        |     - No:  Emit final token_map & complete!   |
        +-----------------------------------------------+
```

### Token Resolution Strategy
To avoid exceeding context limits with very long flight booking tokens, the system substitutes large provider tokens with lightweight placeholders (`TOKEN_0`, `TOKEN_1`, etc.) tracked in a stateful `token_map`. When Gemini requests booking details or links, `executeCalls` resolves the placeholder back to the real token before calling RapidAPI.

---

## 📁 Project Structure

```
explorify-travel-planner/
├── package.json               # Project manifest & dependencies
├── .env.example               # Template for environment variables
├── README.md                  # Project documentation
└── src/
    ├── index.js               # Express application & HTTP endpoints
    ├── planTour.js            # Core Gemini AI loop & streaming logic
    ├── executeFunctions.js    # Concurrent tool dispatch & token resolution
    ├── constants.js           # System prompts, JSON schema, & tool declarations
    ├── utils.js               # Date, IATA code, and timezone helpers
    └── api_requests/          # API integration modules
        ├── index.js           # Barrel exports for all API clients
        ├── flights.js         # Google Flights API integration
        ├── hotel.js           # Booking.com API integration
        ├── siteSeen.js        # Google Places API integration
        └── trains.js          # IRCTC Indian Railways API integration
```

---

## ⚙️ Setup & Installation

### 1. Prerequisites
- Node.js (version 18 or later)
- npm or yarn

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your API credentials:

```bash
cp .env.example .env
```

```env
# Google Gemini API key
GEMINI_API_KEY=your_gemini_api_key_here

# RapidAPI key (for Google Flights, Booking.com, and IRCTC)
RAPIDAPI_KEY=your_rapidapi_key_here

# Google Cloud Maps/Places API key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Secret string used to authenticate API requests to /api/plan
API_SECRET=your_secure_api_secret_here

# Optional configuration
PORT=3000
GEMINI_MODEL=gemini-2.5-flash-preview-05-20
```

### 4. Running the Server

#### Development (Auto-reload):
```bash
npm run dev
```

#### Production:
```bash
npm start
```

---

## 📡 API Endpoints

### 1. Health Check
- **Endpoint**: `GET /`
- **Response**:
```json
{
  "status": "ok",
  "service": "Explorify Travel Planner",
  "version": "0.4.0",
  "timestamp": "2026-10-30T18:00:00.000Z",
  "endpoints": {
    "health": "GET /",
    "plan": "POST /api/plan"
  }
}
```

### 2. Plan Tour (Streaming)
- **Endpoint**: `POST /api/plan`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "secret": "your_secure_api_secret_here",
  "token_map": [],
  "session": [
    {
      "role": "user",
      "parts": [
        {
          "text": "I want to travel to Goa from Ranchi for 7 days starting 2026-04-10 for 2 adults. Mid-range hotel with good Wi-Fi. Prefer flight."
        }
      ]
    }
  ]
}
```

#### Streaming Response Format
The server responds with a stream of **newline-delimited JSON** objects (`application/x-ndjson`), separated by `\n`:

1. **Function Execution Chunk** (emitted when tools run):
```json
{
  "role": "function",
  "parts": [
    {
      "functionResponse": {
        "name": "flights_between",
        "response": { "result": [ ... ] }
      }
    }
  ]
}
```

2. **Model Response Chunks** (emitted as Gemini streams candidate tokens):
```json
{
  "role": "model",
  "parts": [
    { "text": "{\"outbound\":..." }
  ]
}
```

3. **Final Token Map** (emitted once all planning turns finish):
```json
["raw_booking_token_0", "raw_booking_token_1"]
```

---

## 🔗 Original Project

- **Original Rust Repository**: [Explorify-market-place/explorify-travel-planner](https://github.com/Explorify-market-place/explorify-travel-planner)
- Developed by the Explorify Marketplace team.
