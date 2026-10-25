import { Task, TaskStatus } from '../types/Task';

const generatePresetTask = (
  title: string,
  description: string,
  status: TaskStatus,
  dueDate?: Date,
  subtasks: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[] = []
): Omit<Task, 'id' | 'createdAt' | 'updatedAt'> => ({
  title,
  description,
  status,
  dueDate,
  subtasks: subtasks as unknown as Task[],
  isSubtask: false
});

export const getPresetTasks = (): Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[] => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  return [
    generatePresetTask(
      '👋 Welcome to Taskr!',
      'This is a sample task to get you started. Click a task to edit it, or tick its checkbox to mark it complete. Tip: press Ctrl+K (⌘K on a Mac) to search or run a command.',
      'To Do'
    ),
    generatePresetTask(
      '✨ Break tasks into subtasks',
      'Click “+ Add subtask” on any task to split it into smaller steps. For a task you set up often, choose Save as template, then add it again with its subtasks from Templates.',
      'To Do',
      tomorrow,
      [
        {
          title: '📝 This is a subtask',
          description: 'Subtasks help break big tasks into smaller pieces.',
          status: 'To Do',
          isSubtask: true
        }
      ]
    ),
    generatePresetTask(
      '🎯 Try the board and calendar views',
      'Use the List, Board and Calendar switch above to see your tasks in different ways.',
      'In Progress',
      nextWeek
    ),
    generatePresetTask(
      '🔑 Sign up to save your tasks',
      'Create a free account to sync your tasks across devices. The tasks you have now come with you.',
      'In Progress',
      nextWeek
    ),
    generatePresetTask(
      '🌙 Dark mode is available',
      'Click the sun or moon in the top right corner to switch between light and dark themes.',
      'Completed'
    )
  ];
};

// Earlier wording of the welcome tasks, still saved on returning visitors'
// devices. Recognised too, so unedited ones aren't copied into an account.
const LEGACY_PRESET_TASKS: Pick<Task, 'title' | 'description' | 'status'>[] = [
  // Until October 2026
  {
    title: '✨ Break tasks into subtasks',
    description: 'Click “+ Add subtask” on any task to split it into smaller steps.',
    status: 'To Do'
  },
  {
    title: '🎯 Try the board and calendar views',
    description: 'Use the List, Board and Calendar switch above (or press 1, 2 or 3) to see your tasks in different ways.',
    status: 'In Progress'
  },
  // The first wording
  {
    title: '👋 Welcome to Taskr!',
    description: 'This is a demo task to help you get started. You can click on any task to edit it, or click the checkbox to mark it as complete.',
    status: 'To Do'
  },
  {
    title: '✨ Create Subtasks',
    description: 'Click the "+ Add subtask" button on any task to create subtasks. Try organizing your work into smaller, manageable pieces!',
    status: 'To Do'
  },
  {
    title: '🎯 Try Different Views like Kanban or Calendar',
    description: 'Use the view selector above to switch between Normal, Kanban, and Calendar views. Each view offers a different way to organize your tasks!',
    status: 'In Progress'
  },
  {
    title: '🔑 Sign up to save your tasks',
    description: 'Sign up to save your tasks to the cloud and access them from anywhere!',
    status: 'In Progress'
  },
  {
    title: '🌙 Dark Mode Available',
    description: 'Click the theme toggle in the top right corner to switch between light and dark modes.',
    status: 'Completed'
  }
];

// A welcome task the user hasn't edited; these aren't copied into an account on sign-in
export const isUntouchedPresetTask = (task: Pick<Task, 'title' | 'description' | 'status'>): boolean =>
  [...getPresetTasks(), ...LEGACY_PRESET_TASKS].some(preset =>
    preset.title === task.title &&
    preset.description === task.description &&
    preset.status === task.status
  );

export const hasSeenPresetTasks = (): boolean => {
  return localStorage.getItem('hasSeenPresetTasks') === 'true';
};

export const markPresetTasksAsSeen = (): void => {
  localStorage.setItem('hasSeenPresetTasks', 'true');
};

export const resetPresetTasksState = (): void => {
  localStorage.removeItem('hasSeenPresetTasks');
};
