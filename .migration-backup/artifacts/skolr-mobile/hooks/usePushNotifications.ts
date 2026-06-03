import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useEffect, useRef } from "react";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function isGranted(result: { granted?: boolean; status?: string }): boolean {
  return result.granted === true || result.status === "granted";
}

export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  if (Platform.OS === "web") return null;

  const existing = await Notifications.getPermissionsAsync();
  let permGranted = isGranted(existing as never);

  if (!permGranted) {
    const requested = await Notifications.requestPermissionsAsync();
    permGranted = isGranted(requested as never);
  }

  if (!permGranted) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  try {
    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    return null;
  }
}

export function usePushNotificationListeners() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null,
  );
  const responseListener = useRef<Notifications.EventSubscription | null>(
    null,
  );

  useEffect(() => {
    notificationListener.current =
      Notifications.addNotificationReceivedListener((_notification) => {
        // Notification received while app is open — no extra action needed
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((_response) => {
        // User tapped the notification — deep-link handling can go here
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}
