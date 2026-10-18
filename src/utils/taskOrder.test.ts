import { Task } from '../types/Task';
import { orderKey, placeAt, positionBetween, sortByOrder, stepPosition } from './taskOrder';

const BASE = Date.UTC(2026, 9, 18);

const task = (id: string, createdMs: number, position?: number): Task => ({
  id,
  title: id,
  status: 'To Do',
  createdAt: new Date(createdMs),
  updatedAt: new Date(createdMs),
  position
});

const ids = (tasks: Task[]) => sortByOrder(tasks).map(item => item.id).join('');

// Applies a move the way the app does: the moved task plus any respaced neighbours
const apply = (tasks: Task[], movedId: string, result: { position: number; others: { id: string; position: number }[] }) => {
  const changes = new Map([[movedId, result.position], ...result.others.map(o => [o.id, o.position] as [string, number])]);
  return tasks.map(item => (changes.has(item.id) ? { ...item, position: changes.get(item.id) } : item));
};

describe('order of tasks in a section', () => {
  it('uses the dragged position, or creation time for tasks never moved', () => {
    expect(orderKey(task('a', BASE))).toBe(BASE);
    expect(orderKey(task('a', BASE, 42))).toBe(42);
  });

  it('sorts oldest first by default, without changing the original list', () => {
    const list = [task('c', BASE + 2), task('a', BASE), task('b', BASE + 1)];
    expect(ids(list)).toBe('abc');
    expect(list.map(item => item.id).join('')).toBe('cab');
  });

  it('places a moved task between two that were never moved', () => {
    const list = [task('a', BASE), task('b', BASE + 60_000), task('c', BASE + 120_000)];
    const moved = apply(list, 'c', placeAt(list.filter(t => t.id !== 'c'), 1, list[2]));
    expect(ids(moved)).toBe('acb');
  });

  it('can move a task to the very top or bottom', () => {
    const list = [task('a', BASE), task('b', BASE + 1000), task('c', BASE + 2000)];
    const top = apply(list, 'c', placeAt(list.filter(t => t.id !== 'c'), 0, list[2]));
    expect(ids(top)).toBe('cab');
    const bottom = apply(list, 'a', placeAt(list.filter(t => t.id !== 'a'), 2, list[0]));
    expect(ids(bottom)).toBe('bca');
  });

  it('says when two neighbours are too close for anything to fit between', () => {
    const a = task('a', BASE, 1);
    const b = task('b', BASE, 1 + Number.EPSILON);
    expect(positionBetween(a, b)).toBeNull();
    expect(positionBetween(undefined, undefined)).toBeNull();
    expect(positionBetween(task('x', BASE), task('y', BASE + 2))).toBe(BASE + 1);
  });

  it('keeps the order right when tasks keep landing in the same tiny gap', () => {
    // Welcome tasks are created a millisecond apart: the tightest real gap
    let list = [task('a', BASE), task('b', BASE + 1), task('c', BASE + 2)];
    const expected = ['a', 'b'];
    let respaced = 0;
    for (let i = 0; i < 60; i++) {
      const fresh = task(`n${i}`, BASE + 100_000 + i);
      const ordered = sortByOrder(list);
      const result = placeAt(ordered, ordered.findIndex(t => t.id === 'b') + 1, fresh);
      if (result.others.length > 0) respaced++;
      list = apply([...list, fresh], fresh.id, result);
      expected.splice(2, 0, fresh.id);
    }
    expect(sortByOrder(list).map(t => t.id)).toEqual([...expected, 'c']);
    // It only spaces things out again occasionally, not on every move
    expect(respaced).toBeGreaterThan(0);
    expect(respaced).toBeLessThan(10);
  });

  it('moves one place up or down with the keyboard, and not past the ends', () => {
    const list = sortByOrder([task('a', BASE), task('b', BASE + 1000), task('c', BASE + 2000)]);
    const down = stepPosition(list, 'a', 1)!;
    expect(down.index).toBe(1);
    expect(ids(apply(list, 'a', down))).toBe('bac');
    expect(stepPosition(list, 'a', -1)).toBeNull();
    expect(stepPosition(list, 'c', 1)).toBeNull();
  });
});
