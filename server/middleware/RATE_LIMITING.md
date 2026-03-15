# Rate Limiting & Abuse Protection

This document describes the rate limiting and security measures implemented in the backend.

## Overview

The application implements comprehensive rate limiting to protect against abuse, scraping, and brute-force attacks while maintaining a good user experience for legitimate users.

## Rate Limiters

### 1. Public Endpoint Limiter
- **Limit**: 100 requests per 15 minutes
- **Window**: 15 minutes (900,000ms)
- **Applied to**:
  - `/api/auth/*`
  - `/api/opportunities/*`
  - `/api/graph/*`
  - `/api/history/*`
  - `/api/predictions/*` (public routes)
  - `/api/alerts/*`
  - `/api/signals/*`
  - `/api/trends`

### 2. Strict Endpoint Limiter
- **Limit**: 20 requests per 15 minutes
- **Window**: 15 minutes (900,000ms)
- **Purpose**: Reserved for future sensitive endpoints

### 3. Admin Endpoint Limiter
- **Limit**: 10 requests per 15 minutes
- **Window**: 15 minutes (900,000ms)
- **Key Strategy**: Combines admin key + IP address
- **Applied to**:
  - `/api/predictions/draft`
  - `/api/predictions/draft-eligible`
  - `/api/predictions/promote`
  - `/api/predictions/promote-eligible`
  - `/api/predictions/:id/verify`
  - `/api/predictions/stats`
  - `/api/predictions/:id` (DELETE)
  - `/api/predictions/:id/publish`
  - `/api/predictions/:id/discard`
  - `/api/alerts/weekly-digest`

### 4. Billing Limiter
- **Limit**: 5 requests per hour
- **Window**: 1 hour (3,600,000ms)
- **Key Strategy**: User ID (if authenticated) or IP address
- **Applied to**: `/api/billing/*`

### 5. Export Limiter
- **Limit**: 10 requests per hour
- **Window**: 1 hour (3,600,000ms)
- **Key Strategy**: User ID (if authenticated) or IP address
- **Applied to**: `/api/export/*`

## Excluded Endpoints

The following endpoints are **NOT** rate limited:
- `/api/stripe/webhook` - Stripe webhooks must not be rate limited
- `/api/billing/webhook` - Payment webhooks must not be rate limited
- `/api/auth/webhook` - Auth provider webhooks must not be rate limited

## Security Logging

### Blocked Requests
When a rate limit is exceeded, the following information is logged:
```
[RATE_LIMIT_BLOCKED] timestamp | IP: x.x.x.x | Route: /api/... | User-Agent: ... | Reason: ...
```

### Admin Access Violations
When an admin endpoint is accessed without valid credentials:
```
[SECURITY_EVENT] timestamp | IP: x.x.x.x | Route: /api/admin/... | User-Agent: ... | Key: missing/provided | Reason: ...
```

## Response Headers

All rate-limited responses include the following headers:
- `X-RateLimit-Limit`: Maximum requests allowed in the window
- `X-RateLimit-Remaining`: Number of requests remaining
- `X-RateLimit-Reset`: ISO 8601 timestamp when the limit resets

## Error Responses

When rate limit is exceeded:
```json
{
  "error": "Too many requests, please try again later",
  "retryAfter": 600
}
```

HTTP Status: `429 Too Many Requests`

## Implementation Details

### Storage
- In-memory store with automatic cleanup
- Cleanup runs every 60 seconds
- Expired entries are automatically removed

### Key Generation
Rate limits are tracked per:
- **IP address**: For anonymous/public endpoints
- **User ID**: For authenticated endpoints (billing, export)
- **Admin key + IP**: For admin endpoints

### Configuration

To adjust rate limits, edit `/server/middleware/rateLimiter.ts`:

```typescript
export const publicEndpointLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  maxRequests: 100,           // requests
  message: "Too many requests from this IP, please try again later",
});
```

## Best Practices

1. **Monitor logs** for `[RATE_LIMIT_BLOCKED]` and `[SECURITY_EVENT]` entries
2. **Adjust limits** based on legitimate traffic patterns
3. **Alert on patterns** of repeated admin access violations
4. **Review IP addresses** that consistently hit rate limits
5. **Consider allowlisting** known legitimate automation (monitoring, etc.)

## Testing

To test rate limiting:

```bash
# Test public endpoint (should block after 100 requests in 15min)
for i in {1..105}; do curl http://localhost:5000/api/opportunities; done

# Test admin endpoint (should block after 10 requests in 15min)
for i in {1..15}; do
  curl -H "X-Admin-Key: your-key" http://localhost:5000/api/predictions/stats
done

# Test billing endpoint (should block after 5 requests in 1 hour)
for i in {1..10}; do
  curl -X POST -H "Authorization: Bearer token" http://localhost:5000/api/billing/create-checkout
done
```

## Troubleshooting

### Legitimate users being blocked
- Increase the rate limit for the affected endpoint
- Consider implementing user-based limits instead of IP-based

### Logs show many blocks from same IP
- Possible scraper or bot
- Consider implementing IP blocking at firewall/proxy level

### Admin endpoints showing security events
- Verify all authorized systems have correct admin keys
- Investigate source of invalid attempts
- Consider implementing temporary IP bans for repeated violations
