import { useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

export function useAnimatedNumber(target: number, duration = 1.5) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: duration * 1000, bounce: 0 });
  const rounded = useTransform(spring, (v) => Math.round(v));

  useEffect(() => {
    motionValue.set(target);
  }, [target, motionValue]);

  return rounded;
}
