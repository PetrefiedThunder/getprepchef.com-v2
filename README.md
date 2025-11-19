# PrepChef v2

Vendor Verification as a Service for shared kitchens - helping kitchens verify vendor compliance with food safety regulations.

## Quick Start for Demos

This repository includes **ready-to-use mock API keys** for running demos immediately:

```bash
cd server
cp .env.example .env
docker-compose up -d
npm install
npm run dev
```

The application will start with:
- API server on `http://localhost:3000`
- MongoDB on `localhost:27017`
- Redis on `localhost:6379`

All necessary mock credentials (JWT secrets, webhook keys, external service API keys) are pre-configured in `.env.example`.

## Repository Structure

- `server/` - Backend API (Node.js + Fastify + MongoDB)
- See `server/README.md` for detailed server documentation

## Production Deployment

⚠️ **Important**: Replace all mock credentials before deploying to production. See `server/.env.example` for guidance on generating secure secrets.
