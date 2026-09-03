export type PendingHumanNotification = {
  close: () => void;
};

export type PendingHumanNotifyHost = {
  show: (title: string, onClick: () => void) => PendingHumanNotification;
  focus: () => void;
};

export type PendingHumanNotifyInput = {
  pending: boolean;
  hidden: boolean;
  permitted: boolean;
  title: string;
};

export function pendingHumanNotifyPermitted(preference: boolean): boolean {
  return (
    preference &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  );
}

export async function requestPendingHumanNotifyPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") {
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission === "denied") {
    return false;
  }
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

export function createBrowserPendingHumanNotifyHost(): PendingHumanNotifyHost {
  return {
    show(title, onClick) {
      const notification = new Notification(title);
      notification.onclick = () => {
        onClick();
        notification.close();
      };
      return notification;
    },
    focus() {
      window.focus();
    },
  };
}

export function syncPendingHumanNotification(
  session: { current: PendingHumanNotification | null },
  input: PendingHumanNotifyInput,
  host: PendingHumanNotifyHost,
) {
  const shouldShow = input.pending && input.hidden && input.permitted;
  if (!shouldShow) {
    session.current?.close();
    session.current = null;
    return;
  }
  if (session.current !== null) {
    return;
  }
  try {
    session.current = host.show(input.title, () => {
      host.focus();
    });
  } catch {
    session.current = null;
  }
}
