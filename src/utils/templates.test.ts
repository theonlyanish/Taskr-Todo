import {
  BUILT_IN_TEMPLATES,
  forgetSavedTemplates,
  loadSavedTemplates,
  sameTemplate,
  storeSavedTemplates,
  templateFromTask
} from './templates';

beforeEach(() => localStorage.clear());

describe('templates', () => {
  it('comes with four built-in templates, each with subtasks', () => {
    expect(BUILT_IN_TEMPLATES.map(template => template.title)).toEqual([
      'Weekly review',
      'Packing list',
      'Grocery run',
      'Moving house'
    ]);
    expect(BUILT_IN_TEMPLATES.every(template => template.builtIn && template.subtasks.length > 0)).toBe(true);
  });

  it('makes a template from a task: title, description and subtasks, but no status or dates', () => {
    const template = templateFromTask({
      title: 'Client onboarding',
      description: 'For new clients',
      subtasks: [{ title: 'Send welcome email', description: '' }, { title: 'Book kickoff call' }]
    });
    expect(template).toMatchObject({
      title: 'Client onboarding',
      description: 'For new clients',
      subtasks: [{ title: 'Send welcome email', description: undefined }, { title: 'Book kickoff call' }]
    });
    expect(template).not.toHaveProperty('status');
    expect(template.builtIn).toBeUndefined();
  });

  it('treats the same title and subtasks as the same template', () => {
    const a = templateFromTask({ title: 'Trip', subtasks: [{ title: 'Pack' }] });
    expect(sameTemplate(a, templateFromTask({ title: 'Trip', subtasks: [{ title: 'Pack' }] }))).toBe(true);
    expect(sameTemplate(a, templateFromTask({ title: 'Trip', subtasks: [{ title: 'Unpack' }] }))).toBe(false);
    expect(sameTemplate(a, templateFromTask({ title: 'Trip' }))).toBe(false);
  });

  it('keeps guests’ and each account’s saved templates separately on the device', () => {
    const guest = templateFromTask({ title: 'Guest one' });
    const account = templateFromTask({ title: 'Account one' });
    storeSavedTemplates([guest]);
    storeSavedTemplates([account], 'user-1');
    expect(loadSavedTemplates().map(t => t.title)).toEqual(['Guest one']);
    expect(loadSavedTemplates('user-1').map(t => t.title)).toEqual(['Account one']);

    forgetSavedTemplates('user-1');
    expect(loadSavedTemplates('user-1')).toEqual([]);
    expect(loadSavedTemplates()).toHaveLength(1);
  });

  it('ignores unreadable saved data instead of crashing', () => {
    localStorage.setItem('taskTemplates', '{not json');
    expect(loadSavedTemplates()).toEqual([]);
    localStorage.setItem('taskTemplates', JSON.stringify([{ nope: true }, { title: 'Fine', subtasks: [] }]));
    expect(loadSavedTemplates().map(t => t.title)).toEqual(['Fine']);
  });
});
