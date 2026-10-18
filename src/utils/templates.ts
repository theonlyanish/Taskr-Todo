// Task templates: a task with its subtasks, added again in one click. A few
// come built in; people save their own from any task. Saved ones are kept on
// this device, and for signed-in users in their account too (see
// services/templateService).

export interface TemplateSubtask {
  title: string;
  description?: string;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description?: string;
  subtasks: TemplateSubtask[];
  createdAt: string; // ISO date
  builtIn?: boolean;
}

const builtIn = (id: string, title: string, description: string, subtasks: string[]): TaskTemplate => ({
  id: `builtin-${id}`,
  title,
  description,
  subtasks: subtasks.map(subtaskTitle => ({ title: subtaskTitle })),
  createdAt: '2026-10-18T00:00:00.000Z',
  builtIn: true
});

export const BUILT_IN_TEMPLATES: TaskTemplate[] = [
  builtIn('weekly-review', 'Weekly review', 'Half an hour to close off the week and plan the next one.', [
    'Clear inbox',
    'Look back at last week’s calendar',
    'Check what’s coming up next week',
    'Update the task list',
    'Pick the top 3 priorities'
  ]),
  builtIn('packing-list', 'Packing list', 'Everything to sort before a trip.', [
    'Passport and tickets',
    'Phone charger and adapters',
    'Clothes',
    'Toiletries',
    'Medication',
    'Headphones',
    'Snacks for the trip',
    'Check in online'
  ]),
  builtIn('grocery-run', 'Grocery run', '', [
    'Fruit and veg',
    'Bread',
    'Milk and eggs',
    'Meat or other protein',
    'Pantry staples',
    'Cleaning supplies'
  ]),
  builtIn('moving-house', 'Moving house', 'The big jobs, roughly in order.', [
    'Book removalists',
    'Get boxes and tape',
    'Pack room by room',
    'Redirect mail',
    'Set up internet at the new place',
    'Update address with bank and work',
    'Final clean'
  ])
];

// A template made from a task: its title, description and subtasks, but not
// its status or dates
export const templateFromTask = (task: {
  title: string;
  description?: string;
  subtasks?: { title: string; description?: string }[];
}): TaskTemplate => ({
  id: crypto.randomUUID(),
  title: task.title,
  description: task.description || undefined,
  subtasks: (task.subtasks ?? []).map(subtask => ({
    title: subtask.title,
    description: subtask.description || undefined
  })),
  createdAt: new Date().toISOString()
});

// Saved templates on this device: a guest's only copy, or a signed-in
// user's offline copy of their account's templates
const storageKey = (userId?: string) => (userId ? `taskTemplates:${userId}` : 'taskTemplates');

export const loadSavedTemplates = (userId?: string): TaskTemplate[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]');
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.title === 'string') : [];
  } catch {
    return [];
  }
};

export const storeSavedTemplates = (templates: TaskTemplate[], userId?: string) => {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(templates));
  } catch {
    // Not kept after a reload on this device
  }
};

// Two templates with the same title and subtasks count as the same one
export const sameTemplate = (a: TaskTemplate, b: TaskTemplate) =>
  a.title === b.title &&
  a.subtasks.length === b.subtasks.length &&
  a.subtasks.every((subtask, index) => subtask.title === b.subtasks[index].title);
