import { describe, expect, it, vi } from "vitest";

import {
  syncPendingHumanNotification,
  type PendingHumanNotification,
  type PendingHumanNotifyHost,
} from "./pending-human-notify";

function host() {
  const shown: string[] = [];
  const closed: string[] = [];
  const focused: string[] = [];
  const clicks: Array<() => void> = [];
  const fake: PendingHumanNotifyHost = {
    show(title, onClick) {
      shown.push(title);
      clicks.push(onClick);
      return {
        close() {
          closed.push(title);
        },
      };
    },
    focus() {
      focused.push("focus");
    },
  };
  return { fake, shown, closed, focused, clicks };
}

describe("syncPendingHumanNotification", () => {
  it("shows once when a wait is open, the tab is hidden, and permission is granted", () => {
    const session = { current: null as PendingHumanNotification | null };
    const notify = host();
    syncPendingHumanNotification(
      session,
      { pending: true, hidden: true, permitted: true, title: "Shop" },
      notify.fake,
    );
    syncPendingHumanNotification(
      session,
      { pending: true, hidden: true, permitted: true, title: "Shop" },
      notify.fake,
    );
    expect(notify.shown).toEqual(["Shop"]);
    expect(notify.closed).toEqual([]);
  });

  it("does not show while the tab is visible", () => {
    const session = { current: null as PendingHumanNotification | null };
    const notify = host();
    syncPendingHumanNotification(
      session,
      { pending: true, hidden: false, permitted: true, title: "Shop" },
      notify.fake,
    );
    expect(notify.shown).toEqual([]);
  });

  it("shows when a wait opens while the tab is already hidden", () => {
    const session = { current: null as PendingHumanNotification | null };
    const notify = host();
    syncPendingHumanNotification(
      session,
      { pending: false, hidden: true, permitted: true, title: "Shop" },
      notify.fake,
    );
    syncPendingHumanNotification(
      session,
      { pending: true, hidden: true, permitted: true, title: "Shop" },
      notify.fake,
    );
    expect(notify.shown).toEqual(["Shop"]);
  });

  it("closes when the wait ends", () => {
    const session = { current: null as PendingHumanNotification | null };
    const notify = host();
    syncPendingHumanNotification(
      session,
      { pending: true, hidden: true, permitted: true, title: "Shop" },
      notify.fake,
    );
    syncPendingHumanNotification(
      session,
      { pending: false, hidden: true, permitted: true, title: "Shop" },
      notify.fake,
    );
    expect(notify.closed).toEqual(["Shop"]);
    expect(session.current).toBeNull();
  });

  it("closes when the tab becomes visible again", () => {
    const session = { current: null as PendingHumanNotification | null };
    const notify = host();
    syncPendingHumanNotification(
      session,
      { pending: true, hidden: true, permitted: true, title: "Shop" },
      notify.fake,
    );
    syncPendingHumanNotification(
      session,
      { pending: true, hidden: false, permitted: true, title: "Shop" },
      notify.fake,
    );
    expect(notify.closed).toEqual(["Shop"]);
    expect(session.current).toBeNull();
  });

  it("closes when permission is withdrawn", () => {
    const session = { current: null as PendingHumanNotification | null };
    const notify = host();
    syncPendingHumanNotification(
      session,
      { pending: true, hidden: true, permitted: true, title: "Shop" },
      notify.fake,
    );
    syncPendingHumanNotification(
      session,
      { pending: true, hidden: true, permitted: false, title: "Shop" },
      notify.fake,
    );
    expect(notify.closed).toEqual(["Shop"]);
    expect(session.current).toBeNull();
  });

  it("focuses the tab when the notification is clicked", () => {
    const session = { current: null as PendingHumanNotification | null };
    const notify = host();
    syncPendingHumanNotification(
      session,
      { pending: true, hidden: true, permitted: true, title: "Shop" },
      notify.fake,
    );
    notify.clicks[0]?.();
    expect(notify.focused).toEqual(["focus"]);
  });

  it("stays silent when permission is denied", () => {
    const session = { current: null as PendingHumanNotification | null };
    const notify = host();
    expect(() => {
      syncPendingHumanNotification(
        session,
        { pending: true, hidden: true, permitted: false, title: "Shop" },
        notify.fake,
      );
    }).not.toThrow();
    expect(notify.shown).toEqual([]);
  });

  it("stays silent when show throws", () => {
    const session = { current: null as PendingHumanNotification | null };
    const notify: PendingHumanNotifyHost = {
      show() {
        throw new Error("blocked");
      },
      focus: vi.fn(),
    };
    expect(() => {
      syncPendingHumanNotification(
        session,
        { pending: true, hidden: true, permitted: true, title: "Shop" },
        notify,
      );
    }).not.toThrow();
    expect(session.current).toBeNull();
  });
});
