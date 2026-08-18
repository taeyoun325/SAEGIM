import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_ID_KEY = 'saegim:reminderNotificationId';
const REMINDER_TIME_KEY = 'saegim:reminderTime';
const DEFAULT_HOUR = 20; // 오후 8시
const DEFAULT_MINUTE = 0;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function isReminderEnabled(): Promise<boolean> {
  const id = await AsyncStorage.getItem(REMINDER_ID_KEY);
  return !!id;
}

export interface ReminderTime {
  hour: number;
  minute: number;
}

// 사람마다 하루를 정리하는 시간이 다르다(퇴근 직후, 자기 전 등) — 습관 형성 앱들이
// 공통으로 알림 시간을 고를 수 있게 하는 이유이기도 하다. 저장된 값이 없으면
// 기존에 고정돼 있던 오후 8시를 그대로 기본값으로 쓴다(기존 사용자는 아무것도 안 바뀐다).
export async function getReminderTime(): Promise<ReminderTime> {
  const raw = await AsyncStorage.getItem(REMINDER_TIME_KEY);
  if (!raw) return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE };
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.hour === 'number' && typeof parsed.minute === 'number') return parsed;
  } catch {
    // 저장된 값이 손상됐으면 기본값으로 되돌린다.
  }
  return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE };
}

export async function setReminderTime(time: ReminderTime): Promise<void> {
  await AsyncStorage.setItem(REMINDER_TIME_KEY, JSON.stringify(time));
}

export async function enableDailyReminder(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  const { hour, minute } = await getReminderTime();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '오늘의 글감이 도착했어요',
      body: '오늘 떠오른 생각을 3줄로 남겨보세요.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  await AsyncStorage.setItem(REMINDER_ID_KEY, id);
  return true;
}

export async function disableDailyReminder(): Promise<void> {
  const id = await AsyncStorage.getItem(REMINDER_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(REMINDER_ID_KEY);
  }
}

// 알림이 이미 켜져 있는 상태에서 시간만 바꿀 때 쓴다. 꺼져 있으면 시간만 저장해두고
// 다음에 켤 때 그 시간이 적용된다(끄지도 않았는데 알림이 갑자기 울리게 만들지 않는다).
export async function changeReminderTime(time: ReminderTime): Promise<void> {
  const wasEnabled = await isReminderEnabled();
  await setReminderTime(time);
  if (wasEnabled) {
    await disableDailyReminder();
    await enableDailyReminder();
  }
}
