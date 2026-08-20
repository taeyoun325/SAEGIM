import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// 전정 기능 이상 등으로 움직임에 민감한 사용자를 위한 OS/브라우저 설정
// ("동작 줄이기" · prefers-reduced-motion)을 따른다. 웹에서는 react-native-web이
// 이 값을 media query로 그대로 연결해준다.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
