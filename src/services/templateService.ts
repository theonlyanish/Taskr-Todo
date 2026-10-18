import { supabase } from './supabaseClient';
import type { TaskTemplate } from '../utils/templates';

// Saved templates in the signed-in user's account (the task_templates table,
// added by the task_templates migration; row level security limits everyone
// to their own). Until that migration has run, templates stay on each device.

interface TemplateRow {
  id: string;
  title: string;
  description: string | null;
  subtasks: { title: string; description?: string }[] | null;
  created_at: string;
}

const toTemplate = (row: TemplateRow): TaskTemplate => ({
  id: row.id,
  title: row.title,
  description: row.description || undefined,
  subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
  createdAt: row.created_at
});

let tableMissing = false;

// PostgREST's "table not in the schema cache", or Postgres's "relation does not exist"
const isMissingTable = (error: { code?: string; message?: string }) =>
  error.code === 'PGRST205' ||
  error.code === '42P01' ||
  (/task_templates/.test(error.message ?? '') && /not find|does not exist/i.test(error.message ?? ''));

const noteMissingTable = () => {
  if (!tableMissing) {
    tableMissing = true;
    console.warn('Templates are saved on this device only until the task_templates migration is run.');
  }
};

export class TemplateService {
  // The account's templates, or null when they can only be kept on this device
  static async list(): Promise<TaskTemplate[] | null> {
    if (tableMissing) return null;
    const { data, error, status } = await supabase
      .from('task_templates')
      .select('id, title, description, subtasks, created_at')
      .order('created_at', { ascending: true });
    if (error) {
      if (isMissingTable(error)) {
        noteMissingTable();
        return null;
      }
      throw Object.assign(error, { status });
    }
    return (data as TemplateRow[]).map(toTemplate);
  }

  static async add(template: TaskTemplate, userId: string): Promise<void> {
    if (tableMissing) return;
    const { error, status } = await supabase.from('task_templates').insert([{
      id: template.id,
      user_id: userId,
      title: template.title,
      description: template.description ?? null,
      subtasks: template.subtasks,
      created_at: template.createdAt
    }]);
    if (error) {
      if (isMissingTable(error)) return noteMissingTable();
      throw Object.assign(error, { status });
    }
  }

  static async remove(templateId: string, userId: string): Promise<void> {
    if (tableMissing) return;
    const { error, status } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', userId);
    if (error) {
      if (isMissingTable(error)) return noteMissingTable();
      throw Object.assign(error, { status });
    }
  }
}
