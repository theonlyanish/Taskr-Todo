import { Task, TaskStatus } from './types/Task';
import { TaskService } from './services/taskService';

class TaskManager {
  private taskList: HTMLElement;
  private taskForm: HTMLFormElement;

  constructor() {
    this.taskList = document.getElementById('taskList')!;
    this.taskForm = document.getElementById('taskForm') as HTMLFormElement;
    this.initialize();
  }

  private initialize(): void {
    this.renderTasks();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleTaskSubmit(e);
    });
  }

  private handleTaskSubmit(e: Event): void {
    const formData = new FormData(e.target as HTMLFormElement);
    const task = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      status: formData.get('status') as TaskStatus,
      dueDate: formData.get('dueDate') ? new Date(formData.get('dueDate') as string) : undefined
    };

    TaskService.saveTask(task);
    this.renderTasks();
    this.taskForm.reset();
  }

  private renderTasks(): void {
    const tasks = TaskService.getTasks();
    this.taskList.innerHTML = '';

    tasks.forEach(task => {
      const taskElement = this.createTaskElement(task);
      this.taskList.appendChild(taskElement);
    });
  }

  private createTaskElement(task: Task): HTMLElement {
    const div = document.createElement('div');
    div.className = 'task-item';
    div.innerHTML = `
      <h3>${task.title}</h3>
      ${task.description ? `<p>${task.description}</p>` : ''}
      <div class="task-meta">
        <span class="status ${task.status.toLowerCase()}">${task.status}</span>
        ${task.dueDate ? `<span class="due-date">Due: ${new Date(task.dueDate).toLocaleDateString()}</span>` : ''}
      </div>
      <div class="task-actions">
        <button class="edit-btn" data-id="${task.id}">Edit</button>
        <button class="delete-btn" data-id="${task.id}">Delete</button>
      </div>
    `;

    div.querySelector('.delete-btn')?.addEventListener('click', () => {
      TaskService.deleteTask(task.id);
      this.renderTasks();
    });

    return div;
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TaskManager();
});
