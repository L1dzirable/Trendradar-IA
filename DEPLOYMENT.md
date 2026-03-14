# Deployment Guide

This application is ready to deploy to standard Node.js hosting platforms.

## Prerequisites

Build the application first:
```bash
npm run build
```

This creates `dist/index.cjs` which is the production entrypoint.

## Environment Variables Required

```
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://...
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
```

## Deployment Options

### Railway

1. Connect your repository to Railway
2. Railway will auto-detect the Node.js project
3. Set environment variables in Railway dashboard
4. Deploy using the included `railway.json` config

### Render

1. Create a new Web Service
2. Build command: `npm run build`
3. Start command: `npm start`
4. Set environment variables in Render dashboard

### Docker

Build and run with Docker:
```bash
docker build -t trend-radar .
docker run -p 5000:5000 --env-file .env trend-radar
```

### Fly.io

Create `fly.toml` or use:
```bash
fly launch
fly deploy
```

### AWS/GCP/Azure

Deploy the Docker container to any container service:
- AWS Elastic Beanstalk / ECS / App Runner
- Google Cloud Run
- Azure Container Apps

## Notes

- The app listens on `process.env.PORT` (defaults to 5000)
- Binds to `0.0.0.0` for container compatibility
- Includes Puppeteer/Chromium for web scraping features
- Requires PostgreSQL database connection
- Runs scheduled cron jobs for data collection
