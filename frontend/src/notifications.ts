/**
 * GLASSWORK — Push notifications client.
 *
 * Manages:
 * - Permission requests
 * - Expo push token retrieval
 * - Server registration (POST /api/push-token)
 * - Foreground/background notification handling
 * - Deep-link navigation when the user taps a notification
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { api } from './api';

let lastRegisteredToken: string | null = null;

export function configureNotificationHandlers() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'GLASSWORK',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#B8924C',
    }).catch(() => {});
  }
}

export async function requestPushPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!Device.isDevice) {
    // Simulators/emulators cannot get push tokens
    return false;
  }
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

function getProjectId(): string | undefined {
  return (
    (Constants?.expoConfig as any)?.extra?.eas?.projectId ||
    (Constants as any)?.easConfig?.projectId
  );
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    const granted = await requestPushPermissions();
    if (!granted) return null;
    const projectId = getProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenData?.data || null;
  } catch (e) {
    console.warn('[notifications] getExpoPushToken failed', e);
    return null;
  }
}

/** Call after a successful login. Best-effort: never throws. */
export async function registerPushTokenWithBackend(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;
    const token = await getExpoPushToken();
    if (!token) return null;
    await api.post('/push-token', {
      token,
      platform: Platform.OS,
    });
    lastRegisteredToken = token;
    return token;
  } catch (e) {
    console.warn('[notifications] register failed', e);
    return null;
  }
}

/** Best-effort: unregister this device's token (e.g. on logout). */
export async function unregisterPushTokenWithBackend(): Promise<void> {
  try {
    if (!lastRegisteredToken) {
      try {
        const t = await getExpoPushToken();
        if (t) lastRegisteredToken = t;
      } catch {}
    }
    if (lastRegisteredToken) {
      await api.delete('/push-token', { data: { token: lastRegisteredToken } });
      lastRegisteredToken = null;
    }
  } catch (e) {
    console.warn('[notifications] unregister failed', e);
  }
}

function handleNotificationDeepLink(data: Record<string, any> | null | undefined) {
  if (!data) return;
  const type = data.type;
  const projectId = data.project_id;
  try {
    if (type === 'new_alert' || type === 'incident_reported') {
      router.push('/alerts');
    } else if (type === 'new_project' && projectId) {
      router.push(`/project/${projectId}` as any);
    } else if ((type === 'log_approved' || type === 'log_rejected') && projectId) {
      router.push(`/project/${projectId}` as any);
    }
  } catch (e) {
    console.warn('[notifications] deep link failed', e);
  }
}

/** Mount notification listeners. Returns a cleanup function. */
export function mountNotificationListeners(): () => void {
  // Tapped a notification (foreground/background/quit)
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response?.notification?.request?.content?.data || {}) as any;
    handleNotificationDeepLink(data);
  });

  // Received while app is in foreground — handler already shows the alert,
  // we just keep this hook in case we want to update UI counters later.
  const receivedSub = Notifications.addNotificationReceivedListener(() => {});

  // Handle the case where the app was launched by tapping a notification
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) {
        const data = (response.notification?.request?.content?.data || {}) as any;
        handleNotificationDeepLink(data);
      }
    })
    .catch(() => {});

  return () => {
    try { responseSub.remove(); } catch {}
    try { receivedSub.remove(); } catch {}
  };
}
