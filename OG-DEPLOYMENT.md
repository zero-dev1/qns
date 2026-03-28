# Dynamic OG Images Deployment Guide

## Overview
This system generates custom preview cards for every .qf profile when shared on social media, dramatically increasing viral potential.

## Architecture
- **Frontend**: Profile.tsx updates meta tags to point to dynamic OG images
- **Edge Function**: Cloudflare Worker generates PNGs on-demand using Satori + Resvg
- **API Endpoint**: Simple profile data API for the worker to consume
- **Bot Fallback**: HTML fallback for crawlers that don't execute JavaScript

## Deployment Options

### Option 1: Cloudflare Workers (Recommended)
```bash
# Install dependencies
npm install satori @resvg/resvg-wasm

# Deploy worker
wrangler deploy worker-og.js --name qns-og-generator
```

**wrangler.toml**:
```toml
name = "qns-og-generator"
main = "worker-og.js"
compatibility_date = "2023-10-30"

[vars]
# Add any environment variables needed
```

### Option 2: Vercel Edge Functions
```bash
# Create /api/og/[name]/route.js
# Copy worker-og.js content and adapt for Vercel
```

### Option 3: Netlify Edge Functions
```bash
# Create netlify/edge-functions/og-image.js
# Adapt worker code for Netlify format
```

## Required Dependencies
```json
{
  "satori": "^0.10.0",
  "@resvg/resvg-wasm": "^2.6.0"
}
```

## Font Loading (Important)
You'll need to load Inter font bytes in your worker:

```javascript
// Add to your worker
async function loadFont() {
  const response = await fetch('https://cdn.jsdelivr.net/npm/@inter-ui/inter@3.19.3/Inter-Regular.woff2');
  return await response.arrayBuffer();
}

// Use in satori options:
fonts: [
  {
    name: 'Inter',
    data: await loadFont(),
    weight: 400,
    style: 'normal',
  },
],
```

## API Endpoint Setup
Deploy the `api-profile.js` to your existing backend as:
- `/api/profile/[name]` (Next.js)
- `/api/profile/:name` (Express)
- Cloudflare Function

## DNS Configuration
Add DNS record for your worker:
```
api.yourdomain.com -> CNAME -> qns-og-generator.your-subdomain.workers.dev
```

## Testing
```bash
# Test the worker
curl "https://api.yourdomain.com/og/alice.png"

# Test bot fallback
curl -H "User-Agent: TwitterBot" "https://api.yourdomain.com/og/alice.png"
```

## Performance Optimization
1. **Caching**: Workers cache for 1 hour, browsers cache for 1 day
2. **CDN**: Cloudflare's global CDN ensures fast delivery
3. **Fallback**: Simple SVG fallback if complex generation fails

## Monitoring
Add error tracking to your worker:
```javascript
// Add to worker catch blocks
console.error('OG generation failed:', { name, error: error.message });
```

## Security Considerations
1. **Rate Limiting**: Add rate limiting to prevent abuse
2. **Input Validation**: Sanitize name parameter
3. **CORS**: Restrict if needed

## Social Media Testing
Test your OG images with:
- https://cards-dev.twitter.com/validator
- https://developers.facebook.com/tools/debug/
- LinkedIn Post Inspector

## Expected Results
- **Before**: Generic QNS logo on all shares
- **After**: Custom cards with avatar, name, bio, badges
- **Impact**: 3-5x higher engagement on social shares

## Troubleshooting
1. **Blank images**: Check font loading and satori configuration
2. **404 errors**: Verify API endpoint is accessible from worker
3. **Bot issues**: Test user-agent detection logic
4. **Performance**: Monitor worker execution time (< 30s limit)

## Analytics
Track OG image usage:
```javascript
// Add to worker
console.log(`OG image generated: ${name} via ${userAgent}`);
```

This system transforms every social share into a personalized advertisement for QNS.
