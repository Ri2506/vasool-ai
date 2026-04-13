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

  // Set notification channels for Android
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync('overdue', {
      name: 'Overdue reminders',
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
    await N.setNotificationChannelAsync('fraud', {
      name: 'Fraud alerts',
      description: 'Handover disputes, loan requests, agent variance',
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 200, 300],
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
 * Owner alert: agent submitted EOD handover. Fires immediately and routes
 * to the HandoverInbox screen on tap.
 */
export async function notifyHandoverSubmitted(
  agentName: string,
  cashHandedOver: number,
): Promise<void> {
  const N = await getNotifications();
  if (!N) return;
  await N.scheduleNotificationAsync({
    content: {
      title: `${agentName} submitted EOD cash`,
      body: `Claims ₹${cashHandedOver.toLocaleString('en-IN')}. Tap to confirm count.`,
      data: { type: 'handover_submitted' },
      ...(Platform.OS === 'android' ? { channelId: 'fraud' } : {}),
    },
    trigger: null,
  });
}

/**
 * Owner alert: agent filed a new-loan request. Fires immediately and
 * routes to the LoanRequests screen on tap.
 */
export async function notifyLoanRequestCreated(
  agentName: string,
  borrowerName: string,
  amount: number,
): Promise<void> {
  const N = await getNotifications();
  if (!N) return;
  await N.scheduleNotificationAsync({
    content: {
      title: `${agentName} requested a loan`,
      body: `${borrowerName} · ₹${amount.toLocaleString('en-IN')}. Tap to approve or reject.`,
      data: { type: 'loan_request' },
      ...(Platform.OS === 'android' ? { channelId: 'fraud' } : {}),
    },
    trigger: null,
  });
}

/**
 * Owner alert: handover marked as disputed (owner counted < agent claimed).
 * Surfaces immediately so the discrepancy isn't forgotten.
 */
export async function notifyHandoverDisputed(
  agentName: string,
  variance: number,
): Promise<void> {
  const N = await getNotifications();
  if (!N) return;
  await N.scheduleNotificationAsync({
    content: {
      title: `Disputed handover — ${agentName}`,
      body: `Variance ${variance < 0 ? '-' : ''}₹${Math.abs(variance).toLocaleString('en-IN')}. Tap to investigate.`,
      data: { type: 'handover_disputed' },
      ...(Platform.OS === 'android' ? { channelId: 'fraud' } : {}),
    },
    trigger: null,
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
