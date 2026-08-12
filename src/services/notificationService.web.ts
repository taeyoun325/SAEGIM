// 웹 프리뷰용 스텁. expo-notifications는 웹을 지원하지 않는다.
// 실제 알림 기능은 Android/iOS 네이티브에서만 동작한다 (notificationService.ts).

export async function isReminderEnabled(): Promise<boolean> {
  return false;
}

export async function enableDailyReminder(): Promise<boolean> {
  return false;
}

export async function disableDailyReminder(): Promise<void> {
  // 웹에서는 아무 것도 하지 않는다.
}
