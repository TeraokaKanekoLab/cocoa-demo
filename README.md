# cocoa-demo

Graph Analysis Demo Application

![Image](https://github.com/user-attachments/assets/0e9f8074-3913-4c70-9bcc-a3bb86e7553d)

Overview
---
`cocoa-demo` is a sample application that pairs a C++ graph analysis engine with a Next.js frontend. Users can build a query (for example, movie nodes), run a server-side analysis to retrieve top nodes, and then interactively post-process the results using a slider control.

Key Features
---
- Intuitive query builder implemented in Next.js
- C++ graph analysis engine (built with CMake)
- Suggest API to assist name input
- Interactive post-process adjustment via a slider with server-side re-evaluation
- Multi-port frontend server so that up to four independent browser sessions can run in parallel

Repository Structure (excerpt)
---
- `src/app` - Next.js application (React / TypeScript)
- `cpp` - C++ source code for the graph analysis algorithms
- `build` - Build artifacts produced by CMake
- `data` - Data files (node names, indexed edges, etc.)
- `Dockerfile` - Container image definition

Requirements
---
- Node.js 18+ and `npm` or `yarn`
- CMake and a C++ compiler (if you want to build the C++ server locally)
- Docker (optional, for containerized runs)

Local development (frontend only)
---
1. Install dependencies:

```bash
npm install
# or
yarn install
```

2. Run the development server:

```bash
npm run dev
# or
yarn dev
```

The custom dev server listens on four ports by default (`http://localhost:3000` through `http://localhost:3003`).
You can override the list by exporting `FRONTEND_PORTS`, for example:

```bash
FRONTEND_PORTS="4000,4001" npm run dev
```

If you want to build and run the C++ server locally, use the `CMakeLists.txt` in the `cpp` directory to build the binary. The application expects the server binary or service to be available (some builds may place artifacts under `build/graph_solver`). Check `cpp/CMakeLists.txt` for build details.

Run with Docker (recommended: Docker Compose)
---
This repository includes a `Dockerfile` and a `docker-compose.yml` to build and run the application. The compose setup makes it easy to supply runtime environment variables (such as `OPENAI_API_KEY`) via an `.env` file or your shell environment.

Quick start (development / local):

1. Copy the example env file and add your OpenAI/Groq API key (do NOT commit `.env`):

```bash
cp .env.example .env
# edit .env and set OPENAI_API_KEY to your secret key
```

2. Build the image and run with Docker Compose:

```bash
# Build and run in attached mode (logs in terminal)
docker compose up --build

# Or run detached
docker compose up --build -d
```

3. Open any of http://localhost:3000, http://localhost:3001, http://localhost:3002, or http://localhost:3003 in your browser.

To change which ports are exposed (for example, when running multiple copies on the same host), set `FRONTEND_PORTS` before starting Docker Compose. The multi-port Node server reads the comma-separated list and binds each port.

If you prefer to pass the API key from your shell instead of `.env`, you can do:

```bash
OPENAI_API_KEY="sk-..." docker compose up --build
```

Notes about memory: the container and C++ analysis service can use several GB of RAM depending on the dataset. If you encounter out-of-memory errors, increase Docker's memory allocation (on macOS: Docker → Preferences → Resources → Memory) and ensure your host has sufficient free RAM.

If you still want to run the container manually without Compose, you can build and run it directly (less convenient for secrets):

```bash
docker build -t cocoa-demo .
docker run -p 3000:3000 -e OPENAI_API_KEY="$OPENAI_API_KEY" cocoa-demo
```

API Endpoints (main)
---
- `GET /api/status` — Check whether the server is ready
- `GET /api/suggest?q=...` — Name suggestions for the input field
- `POST /api/analyze` — Run analysis. Request body examples:
	- `{ "items": [{ "name": "...", "weight": 1.0 }, ...] }` — initial analysis
	- `{ "c": 0.5 }` — parameter adjustment requests

Multi-user session handling
---
- Each browser session reaches the app through a dedicated port/host (e.g., `localhost:3001`).
- The API layer forwards the host header to the C++ backend as a `userKey`, so `ppr_map` and the submitted query weights stay isolated per user.
- Adjust requests (`{ "c": ... }`) reuse the stored map for the same host; submitting from a different port keeps its own independent results.
- When changing port bindings via `FRONTEND_PORTS`, ensure each parallel user targets a distinct port to receive an independent session.

Contributing
---
Contributions are welcome. Please open issues or pull requests for bug fixes and features. UX refinements on the Next.js side are especially appreciated.

Contact
---
For questions or reports, please open an issue in this repository.
