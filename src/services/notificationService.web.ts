// 웹 프리뷰용 스텁. expo-notifications는 웹을 지원하지 않는다.
// 실제 알림 기능은 Android/iOS 네이티브에서만 동작한다 (notificationService.ts).
// SettingsScreen은 두 플랫폼에서 같은 함수 이름을 가져다 쓰므로, 웹에서도
// 같은 이름의 export가 존재해야 한다(값만 무의미할 뿐 형태는 맞춰야 한다).

export interface ReminderTime {
  hour: number;
  minute: number;
}

const DEFAULT_TIME: ReminderTime = { hour: 20, minute: 0 };

export async function isReminderEnabled(): Promise<boolean> {
  return false;
}

export async function getReminderTime(): Promise<ReminderTime> {
  return DEFAULT_TIME;
}

export async function setReminderTime(_time: ReminderTime): Promise<void> {
  // 웹에서는 아무 것도 하지 않는다.
}

export async function enableDailyReminder(): Promise<boolean> {
  return false;
}

export async function disableDailyReminder(): Promise<void> {
  // 웹에서는 아무 것도 하지 않는다.
}

export async function changeReminderTime(_time: ReminderTime): Promise<void> {
  // 웹에서는 아무 것도 하지 않는다.
}
