import { act, renderHook } from '@testing-library/react';
import { Task } from '../types/Task';
import { useDueReminders } from './reminders';

// The browser's Notification, faked: records what was shown and answers the
// permission prompt with whatever mockAnswer says
let mockPermission: NotificationPermission = 'default';
let mockAnswer: NotificationPermission = 'granted';
const mockShown: { title: string; body?: string; notification: FakeNotification }[] = [];

class FakeNotification {
  static get permission() {
    return mockPermission;
  }
  static requestPermission() {
    mockPermission = mockAnswer;
    return Promise.resolve(mockAnswer);
  }
  onclick: (() => void) | null = null;
  constructor(title: string, options?: NotificationOptions) {
    mockShown.push({ title, body: options?.body, notification: this });
  }
  close() {}
}

const task = (title: string, extra: Partial<Task> = {}): Task => ({
  id: title,
  title,
  status: 'To Do',
  // Saturday 24 October 2026, stored as midnight UTC
  dueDate: new Date('2026-10-24T00:00:00.000Z'),
  createdAt: new Date(2026, 9, 23),
  updatedAt: new Date(2026, 9, 23),
  ...extra
});

const at = (hour: number, minute = 0) => new Date(2026, 9, 24, hour, minute);

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  mockPermission = 'default';
  mockAnswer = 'granted';
  mockShown.length = 0;
  (window as unknown as { Notification: unknown }).Notification = FakeNotification;
});

afterEach(() => {
  jest.useRealTimers();
});

const turnOn = async (result: { current: ReturnType<typeof useDueReminders> }) => {
  await act(async () => {
    await result.current.enable();
  });
};

describe('due-date reminders', () => {
  it('starts off, and is worth offering until answered', () => {
    const { result } = renderHook(() => useDueReminders([], () => {}));
    expect(result.current.status).toBe('off');
    expect(result.current.canOffer).toBe(true);
    act(() => result.current.dismissOffer());
    expect(result.current.canOffer).toBe(false);
  });

  it('announces what’s due today as soon as it’s turned on after 9am', async () => {
    jest.setSystemTime(at(10));
    const { result } = renderHook(() => useDueReminders([task('Pay rent'), task('Tomorrow', { dueDate: new Date('2026-10-25T00:00:00.000Z') })], () => {}));
    await turnOn(result);
    expect(result.current.status).toBe('on');
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(mockShown.map(({ title, body }) => ({ title, body }))).toEqual([{ title: 'Due today', body: 'Pay rent' }]);
  });

  it('waits for 9am, then announces each task only once', async () => {
    jest.setSystemTime(at(8, 58));
    const { result } = renderHook(() => useDueReminders([task('Pay rent')], () => {}));
    await turnOn(result);
    act(() => {
      jest.advanceTimersByTime(60_000); // 8:59
    });
    expect(mockShown).toHaveLength(0);
    act(() => {
      jest.advanceTimersByTime(60_000); // 9:00
    });
    expect(mockShown).toHaveLength(1);
    act(() => {
      jest.advanceTimersByTime(10 * 60_000);
    });
    expect(mockShown).toHaveLength(1);
  });

  it('stays quiet after a reload once today’s reminder has been shown', async () => {
    jest.setSystemTime(at(10));
    const first = renderHook(() => useDueReminders([task('Pay rent')], () => {}));
    await turnOn(first.result);
    act(() => {
      jest.advanceTimersByTime(0);
    });
    first.unmount();

    renderHook(() => useDueReminders([task('Pay rent')], () => {}));
    act(() => {
      jest.advanceTimersByTime(5 * 60_000);
    });
    expect(mockShown).toHaveLength(1);
  });

  it('opens the task when its reminder is clicked', async () => {
    jest.setSystemTime(at(10));
    const onOpen = jest.fn();
    // jsdom has no window.focus
    jest.spyOn(window, 'focus').mockImplementation(() => {});
    const { result } = renderHook(() => useDueReminders([task('Pay rent')], onOpen));
    await turnOn(result);
    act(() => {
      jest.advanceTimersByTime(0);
    });
    mockShown[0].notification.onclick?.();
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pay rent' }));
  });

  it('turns off, and says when the browser blocks notifications', async () => {
    const { result } = renderHook(() => useDueReminders([], () => {}));
    await turnOn(result);
    act(() => result.current.disable());
    expect(result.current.status).toBe('off');

    localStorage.clear();
    mockPermission = 'default';
    mockAnswer = 'denied';
    const blocked = renderHook(() => useDueReminders([], () => {}));
    let answer: string | undefined;
    await act(async () => {
      answer = await blocked.result.current.enable();
    });
    expect(answer).toBe('blocked');
    expect(blocked.result.current.status).toBe('blocked');
  });
});
