interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export default function Logo({ size = 'md' }: LogoProps) {
  const textSize = size === 'sm' ? '18px' : size === 'lg' ? '30px' : '22px';
  const dotSize = size === 'sm' ? 6 : size === 'lg' ? 10 : 8;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span
        style={{
          fontFamily: "'Clash Display', sans-serif",
          fontWeight: 600,
          fontSize: textSize,
          color: '#FFFFFF',
          letterSpacing: '-0.01em',
        }}
      >
        QNS
      </span>
      <span
        aria-hidden="true"
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: '#00D179',
          display: 'inline-block',
          marginLeft: 2,
          marginBottom: 2,
          flexShrink: 0,
        }}
      />
    </span>
  );
}
