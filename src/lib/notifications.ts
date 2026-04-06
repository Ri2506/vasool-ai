// Push notification setup + overdue reminder scheduling.
// Uses expo-notifications (works in Expo Go + dev client).
// FCM config (google-services.json / GoogleService-Info.plist) needed for
// production builds — this module handles the runtime registration + scheduling.

import { Platform } from 'react-native';

// Lazy import: expo-notifications doesn't work on web
let Notifications: typeof import('expo-notifications') | null = null;

async function getNotifications() {
  if (Platform.OS === 'web') return null;
  if (!Notifications) {
    Notifications = await import('expo-notifications');
  }
  return Notifications;
}

/**
 * Request push permission and get the Expo push token.
 * Returns null on web or if permission denied.
 */
export async function registerForPush(): Promise<string | null> {
  const N = await getNotifications();
  if (!N) return null;

  const { status: existing } = await N.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await N.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  // Set notification channel for Android
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync('overdue', {
      name: 'Overdue reminders',
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const token = await N.getExpoPushTokenAsync();
  return token.data;
}

/**
 * Schedule a local notification for overdue borrowers.
 * Called daily to remind the owner about follow-ups.
 */
export async function scheduleOverdueReminder(
  borrowerName: string,
  daysOverdue: number,
  amountOwed: number
): Promise<void> {
  const N = await getNotifications();
  if (!N) return;

  await N.scheduleNotificationAsync({
    content: {
      title: `${borrowerName} — ${daysOverdue} days overdue`,
      body: `₹${amountOwed.toLocaleString('en-IN')} outstanding. Tap to follow up.`,
      data: { type: 'overdue', borrowerName },
      ...(Platform.OS === 'android' ? { channelId: 'overdue' } : {}),
    },
    trigger: null, // Immediately
  });
}

/**
 * Schedule a daily collection reminder at 8 AM.
 */
export async function scheduleDailyReminder(totalDue: number, borrowerCount: number): Promise<void> {
  const N = await getNotifications();
  if (!N) return;

  // Cancel existing daily reminders
  await N.cancelAllScheduledNotificationsAsync();

  if (totalDue <= 0) return;

  await N.scheduleNotificationAsync({
    content: {
      title: `Today: ${borrowerCount} collections`,
      body: `₹${totalDue.toLocaleString('en-IN')} to collect today. Tap to start.`,
      data: { type: 'daily_reminder' },
      ...(Platform.OS === 'android' ? { channelId: 'overdue' } : {}),
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  });
}
