import type { CapacitorConfig } from "@capacitor/cli";

const appUrl =
  process.env.CAPACITOR_SERVER_URL ??
  "https://crewsync-web.jhjdev1115.workers.dev";

const config: CapacitorConfig = {
  appId: "com.jhjdev.crewsync",
  appName: "CrewSync",
  webDir: "dist/client",
  server: {
    url: appUrl,
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#ffffff",
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ["google.com"],
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
