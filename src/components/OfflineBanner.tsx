import { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Text from './Text';
import { colors, spacing } from '../constants/theme';

// 네트워크가 끊기면 화면 상단에 안내 배너를 띄운다.
// 작성 중인 내용은 로컬에 임시 저장되므로(draftService) 사라지지 않는다.
//
// 웹은 Firestore 오프라인 영속 캐시(config/firebase.ts)가 켜져 있어 오프라인이어도
// 이미 읽은 내용은 그대로 보이고, 새로 쓴 글도 로컬 큐에 쌓였다가 연결되면 자동 전송된다
// — 그래서 "확인해주세요" 같은 경고보다는 지금 상태를 차분히 알려주는 문구가 맞다.
// 네이티브는 이 캐시가 아직 없어(iteration 27 참고) 오프라인 중 작성한 글이 실제로
// 전송되지 않으므로, 기존의 더 단호한 경고 문구를 그대로 쓴다.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable이 null이면 아직 판단 전이므로 연결된 것으로 취급한다.
      const reachable = state.isInternetReachable !== false;
      setOffline(!state.isConnected || !reachable);
    });
    return unsubscribe;
  }, []);

  if (!offline) return null;

  const isWeb = Platform.OS === 'web';

  return (
    <View style={[styles.banner, isWeb && styles.bannerWeb]}>
      <Text style={[styles.text, isWeb && styles.textWeb]}>
        {isWeb
          ? '오프라인이에요. 저장된 내용은 계속 볼 수 있고, 새로 쓴 글은 연결되면 자동으로 저장돼요.'
          : '인터넷 연결을 확인해주세요'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.danger, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  bannerWeb: { backgroundColor: colors.accentSoft },
  text: { color: '#fff', textAlign: 'center', fontSize: 13 },
  textWeb: { color: colors.primary },
});
