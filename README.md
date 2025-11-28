# cocoa-demo

English README — Graph Analysis Demo Application

Overview
---
`cocoa-demo` is a sample application that pairs a C++ graph analysis engine with a Next.js frontend. Users can build a query (for example, movie nodes), run a server-side analysis to retrieve top nodes, and then interactively post-process the results using a slider control.

Key Features
---
- Intuitive query builder implemented in Next.js
- C++ graph analysis engine (built with CMake)
- Suggest API to assist name input
- Interactive post-process adjustment via a slider with server-side re-evaluation

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

If you want to build and run the C++ server locally, use the `CMakeLists.txt` in the `cpp` directory to build the binary. The application expects the server binary or service to be available (some builds may place artifacts under `build/graph_solver`). Check `cpp/CMakeLists.txt` for build details.

Run with Docker
---
This repository includes a `Dockerfile` for building a container image. Typical commands:

```bash
# Build the image
docker build -t cocoa-demo .

# Run the container and publish port 3000
docker run -p 3000:3000 cocoa-demo
```

Note about memory: running the container and the C++ graph analysis service can use around 8GB of RAM depending on the dataset and workload. If you encounter out-of-memory errors or the container is killed, increase Docker's available memory before running the container. On macOS with Docker Desktop, open Docker → Preferences → Resources → Memory and allocate at least 8 GB (12 GB recommended for large datasets). Also ensure your host has sufficient free RAM available.

API Endpoints (main)
---
- `GET /api/status` — Check whether the server is ready
- `GET /api/suggest?q=...` — Name suggestions for the input field
- `POST /api/analyze` — Run analysis. Request body examples:
	- `{ "items": [{ "name": "...", "weight": 1.0 }, ...] }` — initial analysis
	- `{ "c": 0.5 }` — parameter adjustment requests

Contributing
---
Contributions are welcome. Please open issues or pull requests for bug fixes and features. UX refinements on the Next.js side are especially appreciated.

Contact
---
For questions or reports, please open an issue in this repository.
