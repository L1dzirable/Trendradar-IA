# TrendRadar AI - Project Documentation

## Project Overview
TrendRadar is an AI SaaS platform that turns real market signals into validated startup opportunities. It helps founders and entrepreneurs identify emerging business trends using AI-powered analysis.

## Current Architecture

### Frontend (React + TypeScript)
- Location: `/client/src`
- Framework: React 18 with TypeScript
- Styling: Tailwind CSS + Shadcn components
- Routing: Wouter (lightweight routing)
- State Management: TanStack React Query v5
- Animation: Framer Motion
- Pages:
  - Home: Main trend scanning interface (input topic, get AI opportunities)

### Backend (Express + TypeScript)
- Location: `/server`
- Framework: Express.js
- Database: PostgreSQL with Drizzle ORM
- Dev Server: Vite (HMR enabled)
- Services:
  - `services/redditSignals.ts`: Market signals from Reddit startups
  - `services/hackerNewsSignals.ts`: Market signals from Hacker News
  - `services/productHuntSignals.ts`: Market signals from Product Hunt

### Database
- PostgreSQL (Replit-managed)
- Schema: `/shared/schema.ts` with Drizzle ORM
- Tables: `trends` (stores AI-generated opportunities)

### Environment Variables (Required)
```
DATABASE_URL=postgresql://...
AI_INTEGRATIONS_OPENAI_BASE_URL=...
AI_INTEGRATIONS_OPENAI_API_KEY=...
SESSION_SECRET=...
```

## Recent Changes (Session)

### Phase 1: Fixed Server Stability
- **Issue**: EADDRINUSE on port 5000 due to stale processes
- **Fix**: Restarted workflow; server binds correctly
- **Status**: ✅ Resolved

### Phase 2: Fixed Frontend Rendering
- **File**: `client/src/pages/Home.tsx`
- **Issue**: JSX parse errors with undefined variables
- **Fix**: Rewrote component with proper structure
  - TrendCard component with animations
  - Form with input + suggestion buttons
  - useQuery + useMutation for API calls
  - Loading skeleton states
  - Error handling
- **Status**: ✅ Resolved

### Phase 4: Signal Ingestion Layer (Partial)
Three market signal services now available:

#### 1. Reddit Signals Service
- **File**: `server/services/redditSignals.ts`
- **Endpoint**: `GET /api/signals/reddit`
- **Sources**: 6 startup subreddits (startups, entrepreneur, SaaS, sideproject, microsaas, indiehackers)
- **Extraction**: title, subreddit, upvotes, comments, keywords, pain point
- **Caching**: 30 minutes
- **Status**: ✅ Implemented

#### 2. Hacker News Signals Service
- **File**: `server/services/hackerNewsSignals.ts`
- **Endpoint**: `GET /api/signals/hackernews`
- **Sources**: Firebase public API (top stories)
- **Extraction**: title, score, comments, keywords, pain point, ranking
- **Scoring**: engagement + recency + ranking position
- **Caching**: 30 minutes
- **Status**: ✅ Tested (15 signals returning real data)

#### 3. Product Hunt Signals Service
- **File**: `server/services/productHuntSignals.ts`
- **Endpoint**: `GET /api/signals/producthunt`
- **Sources**: API with RSS feed fallback
- **Extraction**: product name, tagline, category, votes, keywords, pain point
- **Caching**: 30 minutes
- **Status**: ✅ Implemented (RSS fallback working)

### Signal Data Structure
All services return consistent signal objects:
```typescript
interface Signal {
  id: string;                    // Prefixed: reddit-, hn-, ph-
  title: string;                 // Post/product name
  score: number;                 // Engagement/votes
  comments?: number;             // Comment/discussion count
  url: string;                   // Link to original
  createdAt: number;             // Timestamp (ms)
  keywords: string[];            // 0-8 extracted startup keywords
  inferredPainPoint?: string;    // Inferred problem (e.g., "Time/Efficiency")
  score_ranking: number;         // Composite 0-100 score
}
```

## Testing the Endpoints

```bash
# Get Reddit signals
curl http://localhost:5000/api/signals/reddit

# Get Hacker News signals  
curl http://localhost:5000/api/signals/hackernews

# Get Product Hunt signals
curl http://localhost:5000/api/signals/producthunt

# Force refresh any endpoint
curl "http://localhost:5000/api/signals/reddit?refresh=true"
```

## Running the App

```bash
npm run dev        # Start dev server (Express + Vite)
npm run build      # Build for production
npm start          # Run production build
npm run db:push    # Push schema to PostgreSQL
npm run check      # TypeScript type checking
```

## File Structure
```
/client                 # React frontend
  /src
    /pages             # Page components
    /components        # Shared components
    /lib               # Utilities (queryClient, etc)
    /index.css         # Tailwind styles
    
/server                # Express backend
  /services            # Business logic (signal services)
    redditSignals.ts
    hackerNewsSignals.ts
    productHuntSignals.ts
  index.ts             # Express app setup
  routes.ts            # Route handlers
  db.ts                # Database initialization
  
/shared                # Shared types
  schema.ts            # Drizzle schema + types
  
/script                # Build scripts
```

## Known Issues / Limitations
- Reddit/Product Hunt signals may return empty initially (30-min cache)
- Hacker News returns real data immediately
- No UI integration yet for signals display
- No deduplication of similar opportunities
- Mobile styling not fully optimized
- Single trend generation (not yet using real signal context)

### Phase 5: Signal Aggregation & Deduplication
- **File**: `server/services/signalAggregator.ts`
- **Endpoint**: `GET /api/signals/combined`
- **Features**:
  - Fetches from all 3 sources in parallel (Promise.all)
  - Deduplicates similar signals using string similarity (60%+ threshold)
  - Keyword overlap detection for clustering
  - Composite scoring formula:
    - Engagement (0-40 points): upvotes + comments
    - Source platform score (0-30 points)
    - Recency boost (0-20 points)
    - Cross-platform bonus (0-10 points)
  - Returns top 20 signals
  - 10-minute caching
- **Status**: ✅ Tested and working

### Aggregation Algorithm
1. **Normalization**: Convert all signals to common format
2. **Deduplication**: Group similar signals (title similarity + keyword overlap)
3. **Scoring**: Calculate composite score with 4 factors
4. **Ranking**: Sort by score, return top 20
5. **Caching**: 10-minute TTL with force-refresh option

## Available Endpoints

| Endpoint | Source(s) | Returns | Cache |
|----------|-----------|---------|-------|
| `GET /api/signals/reddit` | Reddit 6 subreddits | 0-15 signals | 30 min |
| `GET /api/signals/hackernews` | HN top stories | 15 signals | 30 min |
| `GET /api/signals/producthunt` | Product Hunt | 0-15 signals | 30 min |
| `GET /api/signals/combined` | All 3 sources | 20 signals (top ranked) | 10 min |

All endpoints support `?refresh=true` to bypass cache.

## Status Summary
✅ Server stability fixed
✅ Frontend rendering fixed  
✅ 3 signal ingestion services implemented
✅ Signal aggregation layer implemented
✅ All API endpoints working
✅ Deduplication and scoring algorithms in place
⏳ Pending: UI integration, improved AI prompts using signals

## Next Steps (Not Yet Implemented)
- Phase 3: Performance improvements, mobile responsiveness
- Phase 5-7: Improve AI generation with real signal context
- Phase 8: Supabase persistence for signal history
- Phase 9: Stripe integration verification
