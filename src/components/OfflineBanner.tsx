import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Text from './Text';
import { colors, spacing } from '../constants/theme';

// 네트워크가 끊기면 화면 상단에 안내 배너를 띄운다.
// 작성 중인 내용은 로컬에 임시 저장되므로(draftService) 사라지지 않는다.
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

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>인터넷 연결을 확인해주세요</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.danger, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  text: { color: '#fff', textAlign: 'center', fontSize: 13 },
});
