import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

import { useAuth } from "@/contexts/AuthContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationContextType {
  pushToken: string | null;
  permissionsGranted: boolean;
}

const NotificationContext = createContext<NotificationContextType>({
  pushToken: null,
  permissionsGranted: false,
});

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, session } = useAuth();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null,
  );
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const tokenRegistered = useRef(false);

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  const savePushToken = async (token: string) => {
    if (!user || !session || !baseUrl) return;
    try {
      await fetch(`${baseUrl}/api/profiles/me/push-token`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
          "x-user-email": user.email ?? "",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ push_token: token }),
      });
    } catch {
      // Non-fatal
    }
  };

  // Step 1: Request permissions on first launch (as soon as the component mounts),
  // before the user has even logged in. This satisfies "request on first launch".
  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (await Notifications.getPermissionsAsync()) as any;
      let granted: boolean = existing.granted ?? false;

      if (!granted && existing.canAskAgain !== false) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = (await Notifications.requestPermissionsAsync()) as any;
        granted = result.granted ?? false;
      }

      setPermissionsGranted(granted);
    })();
  }, []);

  // Step 2: Once authenticated, get the Expo push token and register it with
  // the server. Skips if token was already registered this session.
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!user || !session || tokenRegistered.current) return;

    (async () => {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;
        setPushToken(token);
        tokenRegistered.current = true;
        await savePushToken(token);
      } catch {
        // Non-fatal — can fail in Expo Go simulator or on web
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token]);

  // Clear token tracking on sign-out so next login re-registers.
  useEffect(() => {
    if (!user) {
      tokenRegistered.current = false;
      setPushToken(null);
    }
  }, [user]);

  // Step 3: Handle cold-start deep-link — if the app was launched by tapping
  // a notification from a terminated state, route to the correct screen once
  // the layout is mounted.
  useEffect(() => {
    if (Platform.OS === "web") return;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<
        string,
        unknown
      >;
      // Delay to allow the navigation stack to be ready
      setTimeout(() => handleNotificationTap(data), 500);
    });
  }, []);

  // Step 4: Foreground/background listeners.
  useEffect(() => {
    if (Platform.OS === "web") return;

    notificationListener.current =
      Notifications.addNotificationReceivedListener((_notification) => {
        // Notification received while app is foregrounded — handler above shows it
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<
          string,
          unknown
        >;
        handleNotificationTap(data);
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ pushToken, permissionsGranted }}>
      {children}
    </NotificationContext.Provider>
  );
}

function handleNotificationTap(data: Record<string, unknown>) {
  const type = data?.type as string | undefined;

  if (type === "message" && data.conversation_with) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/conversation/${data.conversation_with}` as any);
    return;
  }

  if (type === "approval") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push("/(tabs)/approvals" as any);
    return;
  }

  if (type === "announcement") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push("/(tabs)/" as any);
    return;
  }
}

export function useNotifications() {
  return useContext(NotificationContext);
}
