import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_ID_KEY = 'saegim:reminderNotificationId';
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

export async function enableDailyReminder(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '오늘의 글감이 도착했어요',
      body: '오늘 떠오른 생각을 3줄로 남겨보세요.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: DEFAULT_HOUR,
      minute: DEFAULT_MINUTE,
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
