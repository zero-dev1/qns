export interface ShareCardData {
  name: string;
  address: string;
  avatar?: string;
  bio?: string;
  twitter?: string;
  github?: string;
  url?: string;
  discord?: string;
  registeredAt: bigint;
  isPermanent: boolean;
  expires?: bigint;
}

const CANVAS_WIDTH = 2400; // 2x for retina
const CANVAS_HEIGHT = 1360; // 2x for retina
const DISPLAY_WIDTH = 1200;
const DISPLAY_HEIGHT = 680;

// Colors
const COLORS = {
  background: '#0A0A0A',
  border: '#1E1E1E',
  text: {
    white: '#FFFFFF',
    emerald: '#00D179',
    gray: '#8A8A8A',
    muted: '#555555',
  },
  avatar: {
    bg: 'rgba(0, 209, 121, 0.2)',
    border: 'rgba(0, 209, 121, 0.3)',
  },
  badge: {
    bg: 'rgba(0, 209, 121, 0.1)',
    text: '#00D179',
  },
};

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function formatDate(timestamp: bigint): string {
  if (timestamp === 0n) return 'Unknown';
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function truncateAddressForCard(address: string): string {
  if (address.length <= 24) return address;
  return `${address.slice(0, 12)}...${address.slice(-10)}`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export async function generateShareCard(data: ShareCardData): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const scale = CANVAS_WIDTH / DISPLAY_WIDTH;

  // Enable high quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw border (1px scaled to 2x)
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 2 * scale;
  const borderRadius = 16 * scale;
  roundRect(ctx, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, borderRadius);
  ctx.stroke();

  // Calculate layout
  const centerX = CANVAS_WIDTH / 2;
  const paddingX = 80 * scale;
  let currentY = 100 * scale;

  // Draw Name Header
  const nameText = data.name;
  const suffixText = '.qf';

  ctx.font = `bold ${72 * scale}px Arial, "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Measure name parts
  const nameWidth = ctx.measureText(nameText).width;
  const spaceWidth = ctx.measureText(' ').width;

  // Draw name in white
  ctx.fillStyle = COLORS.text.white;
  const nameX = centerX - (ctx.measureText(nameText + suffixText).width / 2) + (nameWidth / 2);
  ctx.fillText(nameText, nameX, currentY);

  // Draw .qf in emerald
  ctx.fillStyle = COLORS.text.emerald;
  const suffixX = nameX + (nameWidth / 2) + spaceWidth + (ctx.measureText(suffixText).width / 2);
  ctx.fillText(suffixText, suffixX, currentY);

  currentY += 80 * scale;

  // Draw Avatar
  const avatarSize = 140 * scale;
  const avatarY = currentY + (avatarSize / 2);

  if (data.avatar) {
    const img = await loadImage(data.avatar);
    if (img) {
      // Draw circular clip for avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, avatarY, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, centerX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
      ctx.restore();

      // Draw border circle
      ctx.strokeStyle = COLORS.avatar.border;
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.arc(centerX, avatarY, avatarSize / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Fallback: draw circle with initial
      drawAvatarFallback(ctx, centerX, avatarY, avatarSize, data.name);
    }
  } else {
    // Draw circle with initial
    drawAvatarFallback(ctx, centerX, avatarY, avatarSize, data.name);
  }

  currentY += avatarSize + 40 * scale;

  // Draw Bio
  if (data.bio) {
    ctx.font = `${28 * scale}px Arial, sans-serif`;
    ctx.fillStyle = COLORS.text.gray;
    ctx.textAlign = 'center';

    const maxBioWidth = CANVAS_WIDTH - (paddingX * 2);
    const lines = wrapText(ctx, data.bio, maxBioWidth);
    const maxLines = 3;
    const displayLines = lines.slice(0, maxLines);

    for (let i = 0; i < displayLines.length; i++) {
      ctx.fillText(displayLines[i], centerX, currentY + (i * 40 * scale));
    }

    currentY += (Math.min(displayLines.length, maxLines) * 40 * scale) + 30 * scale;
  }

  // Draw Social Links
  const socials: { key: string; label: string; value: string }[] = [];
  if (data.twitter) socials.push({ key: 'twitter', label: '@', value: data.twitter.replace(/^@/, '') });
  if (data.github) socials.push({ key: 'github', label: 'github.com/', value: data.github });
  if (data.url) socials.push({ key: 'url', label: '', value: data.url.replace(/^https?:\/\//, '') });
  if (data.discord) socials.push({ key: 'discord', label: '', value: data.discord });

  if (socials.length > 0) {
    const socialY = currentY;
    let socialX = centerX;
    const totalWidth = socials.reduce((acc, social, index) => {
      const text = `${social.label}${social.value}`;
      ctx.font = `${24 * scale}px Arial, sans-serif`;
      return acc + ctx.measureText(text).width + (index > 0 ? 40 * scale : 0);
    }, 0);

    socialX = centerX - (totalWidth / 2);

    for (let i = 0; i < socials.length; i++) {
      const social = socials[i];
      const text = `${social.label}${social.value}`;
      ctx.font = `${24 * scale}px Arial, sans-serif`;
      ctx.fillStyle = COLORS.text.gray;
      ctx.textAlign = 'left';
      ctx.fillText(text, socialX, socialY);
      socialX += ctx.measureText(text).width + 40 * scale;
    }

    currentY += 50 * scale;
  }

  // Draw Wallet Address
  ctx.font = `${24 * scale}px "Courier New", monospace`;
  ctx.fillStyle = COLORS.text.gray;
  ctx.textAlign = 'center';
  const truncatedAddress = truncateAddressForCard(data.address);
  ctx.fillText(truncatedAddress, centerX, currentY);
  currentY += 60 * scale;

  // Draw Member Since
  ctx.font = `${22 * scale}px Arial, sans-serif`;
  ctx.fillStyle = COLORS.text.muted;
  ctx.fillText(`Member since ${formatDate(data.registeredAt)}`, centerX, currentY);
  currentY += 50 * scale;

  // Draw Permanent Badge (if permanent)
  if (data.isPermanent) {
    const badgeText = 'Permanent';
    ctx.font = `bold ${20 * scale}px Arial, sans-serif`;
    const badgeWidth = ctx.measureText(badgeText).width + 40 * scale;
    const badgeHeight = 36 * scale;
    const badgeX = centerX - (badgeWidth / 2);
    const badgeY = currentY - (badgeHeight / 2);

    // Badge background
    ctx.fillStyle = COLORS.badge.bg;
    roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 18 * scale);
    ctx.fill();

    // Badge text
    ctx.fillStyle = COLORS.badge.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, centerX, currentY + (2 * scale));
    currentY += 60 * scale;
  }

  // Draw Footer separator line
  const footerY = CANVAS_HEIGHT - (100 * scale);
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(paddingX, footerY);
  ctx.lineTo(CANVAS_WIDTH - paddingX, footerY);
  ctx.stroke();

  // Draw "Powered by QNS" footer
  const footerTextY = footerY + (45 * scale);

  // QNS logo text
  ctx.font = `bold ${24 * scale}px Arial, sans-serif`;
  ctx.fillStyle = COLORS.text.white;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const logoText = 'QNS';
  const dotText = '.';
  const poweredText = 'Powered by QNS';

  const fullText = `${logoText}${dotText} • ${poweredText}`;
  const fullWidth = ctx.measureText(fullText).width;
  let textX = centerX - (fullWidth / 2);

  // QNS
  ctx.fillStyle = COLORS.text.white;
  ctx.fillText(logoText, textX + ctx.measureText(logoText).width / 2, footerTextY);
  textX += ctx.measureText(logoText).width;

  // Emerald dot
  ctx.fillStyle = COLORS.text.emerald;
  ctx.fillText(dotText, textX + ctx.measureText(dotText).width / 2, footerTextY);
  textX += ctx.measureText(dotText).width;

  // Separator dot
  ctx.fillStyle = COLORS.text.muted;
  const sepDot = ' • ';
  ctx.fillText(sepDot, textX + ctx.measureText(sepDot).width / 2, footerTextY);
  textX += ctx.measureText(sepDot).width;

  // Powered by QNS
  ctx.fillStyle = COLORS.text.muted;
  ctx.fillText(poweredText, textX + ctx.measureText(poweredText).width / 2, footerTextY);

  // Export as data URL (scaled down for display, but high quality)
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = DISPLAY_WIDTH;
  exportCanvas.height = DISPLAY_HEIGHT;
  const exportCtx = exportCanvas.getContext('2d');
  if (!exportCtx) throw new Error('Could not get export canvas context');

  exportCtx.imageSmoothingEnabled = true;
  exportCtx.imageSmoothingQuality = 'high';
  exportCtx.drawImage(canvas, 0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

  return exportCanvas.toDataURL('image/png');
}

function drawAvatarFallback(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  name: string
) {
  const radius = size / 2;

  // Background circle
  ctx.fillStyle = COLORS.avatar.bg;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  // Border
  ctx.strokeStyle = COLORS.avatar.border;
  ctx.lineWidth = 2 * (size / 140);
  ctx.stroke();

  // Initial letter
  const initial = name.charAt(0).toUpperCase();
  ctx.font = `bold ${size * 0.5}px Arial, "Arial Black", sans-serif`;
  ctx.fillStyle = COLORS.text.emerald;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, centerX, centerY + (size * 0.05));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function downloadShareCard(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
