import { getPresetTasks, isUntouchedPresetTask } from './presetTasks';

describe('the welcome tasks', () => {
  it('are recognised as untouched, so they stay behind on sign-up', () => {
    for (const task of getPresetTasks()) expect(isUntouchedPresetTask(task)).toBe(true);
  });

  it('are recognised in their earlier wording too, still saved on returning visitors’ devices', () => {
    expect(
      isUntouchedPresetTask({
        title: '🎯 Try the board and calendar views',
        description: 'Use the List, Board and Calendar switch above (or press 1, 2 or 3) to see your tasks in different ways.',
        status: 'In Progress'
      })
    ).toBe(true);
  });

  it('count as the user’s own once edited', () => {
    const [welcome] = getPresetTasks();
    expect(isUntouchedPresetTask({ ...welcome, description: 'My notes' })).toBe(false);
    expect(isUntouchedPresetTask({ ...welcome, status: 'Completed' })).toBe(false);
  });

  it('don’t show keyboard shortcuts, which are kept off the app’s screens', () => {
    for (const task of getPresetTasks()) expect(task.description).not.toMatch(/press 1, 2 or 3/);
  });
});
