import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export type NativePushPermission = "unsupported" | "default" | "denied" | "granted";

export const getNativePushPermission = async (): Promise<NativePushPermission> => {
  if (!Capacitor.isNativePlatform()) return "unsupported";
  const permission = await PushNotifications.checkPermissions();
  if (permission.receive === "granted") return "granted";
  if (permission.receive === "denied") return "denied";
  return "default";
};

export const registerNativePush = async (): Promise<string> => {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("네이티브 앱에서만 사용할 수 있습니다.");
  }

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") {
    throw new Error("알림 권한이 허용되지 않았습니다.");
  }

  return new Promise<string>(async (resolve, reject) => {
    const registration = await PushNotifications.addListener(
      "registration",
      async ({ value }) => {
        await registration.remove();
        await registrationError.remove();
        resolve(value);
      },
    );
    const registrationError = await PushNotifications.addListener(
      "registrationError",
      async (error) => {
        await registration.remove();
        await registrationError.remove();
        reject(new Error(error.error));
      },
    );
    await PushNotifications.register();
  });
};

export const installNativeNotificationNavigation = async () => {
  if (!Capacitor.isNativePlatform()) return;
  await PushNotifications.addListener(
    "pushNotificationActionPerformed",
    ({ notification }) => {
      const url = notification.data?.url;
      if (typeof url === "string" && url.startsWith("/")) {
        window.location.assign(url);
      }
    },
  );
};
