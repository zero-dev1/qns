// Cloudflare Worker for Dynamic OG Image Generation
// Deploy to: /api/og/[name].png

import satori from 'satori';
import { Resvg } from '@resvg/resvg-wasm';

// QNS resolver function - you'll need to implement this based on your QNS setup
async function fetchProfile(name) {
  try {
    // This should match your existing QNS resolution logic
    const response = await fetch(`https://dotqf.xyz/api/profile/${name}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// Bot detection for SPA compatibility
function isBot(userAgent) {
  const bots = [
    'twitterbot', 'facebookexternalhit', 'linkedinbot', 'whatsapp',
    'telegrambot', 'googlebot', 'bingbot', 'slurp', 'duckduckbot',
    'baiduspider', 'yandexbot', 'msnbot', 'pinterestbot'
  ];
  return bots.some(bot => userAgent.toLowerCase().includes(bot));
}

// Fallback HTML for bots (since SPAs don't execute JS)
function generateBotHTML(profile, name) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}.qf — QNS Profile</title>
  <meta property="og:title" content="${name}.qf">
  <meta property="og:description" content="${profile?.bio || 'A QNS identity on QF Network'}">
  <meta property="og:image" content="https://dotqf.xyz/api/og/${name}.png">
  <meta property="og:url" content="https://dotqf.xyz/name/${name}">
  <meta property="og:type" content="profile">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${name}.qf — QNS">
  <meta name="twitter:description" content="${profile?.bio || 'A QNS identity on QF Network'}">
  <meta name="twitter:image" content="https://dotqf.xyz/api/og/${name}.png">
  <meta name="twitter:site" content="@dotqfns">
</head>
<body>
  <h1>${name}.qf</h1>
  <p>${profile?.bio || 'A QNS identity on QF Network'}</p>
  <script>window.location.href = "https://dotqf.xyz/name/${name}"</script>
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const name = pathParts[pathParts.length - 1]?.replace('.png', '');
    
    if (!name) {
      return new Response('Name parameter required', { status: 400 });
    }

    // Handle bot requests with HTML fallback
    const userAgent = request.headers.get('user-agent') || '';
    if (isBot(userAgent) && request.method === 'GET') {
      const profile = await fetchProfile(name);
      const html = generateBotHTML(profile, name);
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Generate OG image
    try {
      const profile = await fetchProfile(name);
      
      // Fallback profile if not found
      const fallbackProfile = {
        name,
        avatar: null,
        bio: null,
        isPermanent: false,
        isTeam: false,
        isDappLab: false
      };

      const finalProfile = profile || fallbackProfile;

      // SVG template using satori
      const svg = await satori(
        {
          type: 'div',
          props: {
            style: {
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Inter, system-ui, sans-serif',
              position: 'relative',
              padding: '60px',
              boxSizing: 'border-box',
            },
            children: [
              // Background pattern
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `radial-gradient(circle at 20% 80%, rgba(0, 209, 121, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(0, 239, 231, 0.08) 0%, transparent 50%)`,
                    pointerEvents: 'none',
                  },
                },
              },
              // Avatar or initials
              finalProfile.avatar ? {
                type: 'img',
                props: {
                  src: finalProfile.avatar,
                  width: 120,
                  height: 120,
                  style: {
                    borderRadius: '50%',
                    border: '4px solid rgba(0, 209, 121, 0.2)',
                    boxShadow: '0 0 40px rgba(0, 209, 121, 0.3)',
                  },
                },
              } : {
                type: 'div',
                props: {
                  style: {
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #00D179, #00A060)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 48,
                    fontWeight: 700,
                    border: '4px solid rgba(0, 209, 121, 0.2)',
                    boxShadow: '0 0 40px rgba(0, 209, 121, 0.3)',
                  },
                  children: name.slice(0, 2).toUpperCase(),
                },
              },
              // Name
              {
                type: 'div',
                props: {
                  style: {
                    marginTop: 32,
                    fontSize: 56,
                    fontWeight: 800,
                    color: 'white',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    textShadow: '0 2px 20px rgba(0, 0, 0, 0.5)',
                  },
                  children: [
                    {
                      type: 'span',
                      props: { children: name },
                    },
                    {
                      type: 'span',
                      props: {
                        style: { color: '#00D179' },
                        children: '.qf',
                      },
                    },
                  ],
                },
              },
              // Bio
              finalProfile.bio ? {
                type: 'div',
                props: {
                  style: {
                    marginTop: 20,
                    fontSize: 24,
                    color: '#888',
                    maxWidth: 800,
                    textAlign: 'center',
                    lineHeight: 1.4,
                    opacity: 0.9,
                  },
                  children: finalProfile.bio.length > 100 ? finalProfile.bio.slice(0, 97) + '...' : finalProfile.bio,
                },
              } : null,
              // Badges
              {
                type: 'div',
                props: {
                  style: {
                    marginTop: 24,
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                  },
                  children: [
                    finalProfile.isPermanent ? {
                      type: 'div',
                      props: {
                        style: {
                          padding: '8px 16px',
                          borderRadius: '20px',
                          background: 'rgba(0, 209, 121, 0.1)',
                          border: '1px solid rgba(0, 209, 121, 0.3)',
                          color: '#00D179',
                          fontSize: 14,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        },
                        children: 'Permanent',
                      },
                    } : null,
                    finalProfile.isTeam ? {
                      type: 'div',
                      props: {
                        style: {
                          padding: '8px 16px',
                          borderRadius: '20px',
                          background: 'rgba(0, 239, 231, 0.1)',
                          border: '1px solid rgba(0, 239, 231, 0.3)',
                          color: '#00EFE7',
                          fontSize: 14,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        },
                        children: 'Team',
                      },
                    } : null,
                    finalProfile.isDappLab ? {
                      type: 'div',
                      props: {
                        style: {
                          padding: '8px 16px',
                          borderRadius: '20px',
                          background: 'rgba(0, 239, 231, 0.1)',
                          border: '1px solid rgba(0, 239, 231, 0.3)',
                          color: '#00EFE7',
                          fontSize: 14,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        },
                        children: 'dApp Lab',
                      },
                    } : null,
                  ].filter(Boolean),
                },
              },
              // Branding
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    bottom: 40,
                    fontSize: 16,
                    color: '#333',
                    fontWeight: 500,
                    letterSpacing: '0.5px',
                  },
                  children: 'QNS · Powered by QF Network',
                },
              },
            ].filter(Boolean),
          },
        },
        {
          width: 1200,
          height: 630,
          fonts: [
            // You'll need to load Inter font bytes in your worker
            // For now, it will use system fonts
          ],
        }
      );

      const resvg = new Resvg(svg, {
        fitTo: {
          mode: 'width',
          value: 1200,
        },
      });

      const png = resvg.render().asPng();

      return new Response(png, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.error('OG image generation failed:', error);
      
      // Return a simple fallback image
      const fallbackSvg = await satori(
        {
          type: 'div',
          props: {
            style: {
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Inter, system-ui, sans-serif',
              color: 'white',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 48,
                    fontWeight: 700,
                    marginBottom: 16,
                  },
                  children: name + '.qf',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 20,
                    color: '#888',
                  },
                  children: 'QNS Identity on QF Network',
                },
              },
            ],
          },
        },
        { width: 1200, height: 630 }
      );

      const fallbackResvg = new Resvg(fallbackSvg);
      const fallbackPng = fallbackResvg.render().asPng();

      return new Response(fallbackPng, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }
  },
};
