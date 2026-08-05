self.addEventListener("push", (event) => {
  let data = { title: "CrewSync", body: "새 알림이 있어요", tag: "crewsync", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Keep the privacy-safe fallback message.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      data: { url: data.url || "/" },
      badge: "/favicon.ico",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => client.url.startsWith(self.location.origin));
      return existing ? existing.focus() : clients.openWindow(target);
    }),
  );
});
