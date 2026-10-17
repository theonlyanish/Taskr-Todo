# Taskr - Task Management Application

## Project Overview

Taskr is a free todo app with Kanban, Calendar and list views that works offline and needs no sign-up. Open it and start adding tasks straight away: your list is saved in your browser, so it is still there when you come back, with or without an internet connection. Break big tasks into subtasks, drag cards between columns, and switch to dark mode when you like. If you want your tasks on more than one device, you can create a free account and sync them, but you never have to.

A modern, TypeScript-based task management web application built with React. Taskr provides an intuitive interface for managing tasks with real-time synchronization across devices, featuring both Kanban and Calendar views, and a sleek dark/light mode interface.

Live Demo: [https://taskr-todo.vercel.app/](https://taskr-todo.vercel.app/)

## Features

### Core Functionality
- **Task Management**
  - Create, update, and delete tasks
  - Mark tasks as complete/incomplete
  - Track task progress using Kanban boards
  - Add descriptions and due dates
  - Drag and drop tasks between status columns

### Advanced Features
- **Multiple Views**
  - Kanban Board View for task workflow management
  - Calendar View for temporal task organization
  - List View for simple task management
- **Task Organization**
  - Drag and drop interface for task reordering
  - Visual progress tracking

### User Experience
- **Authentication**: Secure user authentication with Supabase
- **Cross-Device Sync**: Tasks automatically sync across all devices
- **Theme Support**: Toggle between dark and light modes
- **Responsive Design**: Optimized for both desktop and mobile
- **Offline Support**: Works offline with local storage backup
- **Real-time Updates**: Instant task status updates
- **Sync Status Indicator**: Visual feedback for sync state

## Technology Stack

- **Frontend**:
  - React 18.3.1
  - TypeScript
  - Mantine UI v7.17.0 (Component Library)
  - FullCalendar for calendar functionality
  - React Beautiful DnD for drag and drop
- **Backend**:
  - Supabase (PostgreSQL database)
  - Real-time subscriptions
  - Authentication
- **State Management**: React Hooks
- **Styling**: Mantine UI + Custom CSS
- **Deployment**: Vercel

## Local Development

1. Clone the repository
```bash
git clone https://github.com/theonlyanish/Taskr-Todo.git
```

2. Install dependencies
```bash
cd Taskr-Todo
npm install
```

3. Set up environment variables
Create a `.env` file in the root directory:
```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server
```bash
npm start
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
Taskr-Todo/
├── src/
│   ├── components/
│   │   ├── Auth.tsx
│   │   ├── CalendarView.tsx
│   │   ├── KanbanView.tsx
│   │   ├── TaskCard.tsx
│   │   ├── TaskForm.tsx
│   │   ├── TaskItem.tsx
│   │   ├── TaskList.tsx
│   │   ├── SyncIndicator.tsx
│   │   └── ThemeToggle.tsx
│   ├── services/
│   │   ├── taskService.ts
│   │   └── supabaseClient.ts
│   ├── utils/
│   ├── types/
│   │   └── types.ts
│   ├── App.tsx
│   ├── index.tsx
│   └── styles.css
├── public/
├── supabase/
└── package.json
```

## Key Features Implementation

### Multiple View Options
- **Kanban Board**: Drag-and-drop interface for task management
- **Calendar View**: Timeline-based task visualization
- **List View**: Traditional task list interface

### Data Persistence
- Primary storage in Supabase PostgreSQL database
- Real-time synchronization
- Local storage backup for offline functionality
- Sync status indication

### Authentication & Security
- Secure user authentication via Supabase
- Protected routes and data
- User-specific task management

### User Interface
- Responsive Mantine UI components
- System-based theme detection
- Manual theme toggle
- Smooth transitions and animations

## Keeping Supabase awake

Supabase pauses free-tier projects after roughly a week without API activity. While the project is paused, sign-in and cloud sync fail for every visitor until the owner restores it from the Supabase dashboard (guest mode keeps working because tasks stay on the device, and the app shows a "Cloud sync is asleep" notice instead of a raw error).

The GitHub Actions workflow in `.github/workflows/supabase-keepalive.yml` runs every three days (and on demand via **Actions → Supabase keep-alive → Run workflow**). It makes one tiny read against the `tasks` table so the project never goes idle, and the job fails on any non-2xx response, so a paused project shows up as a red run.

The workflow needs two repository secrets. Add them under **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
| --- | --- |
| `SUPABASE_URL` | The project URL, e.g. `https://xxxx.supabase.co` (the same value as `REACT_APP_SUPABASE_URL`) |
| `SUPABASE_ANON_KEY` | The project's anon (public) key (the same value as `REACT_APP_SUPABASE_ANON_KEY`) |

Only the anon key is used. With row-level security on the `tasks` table the request returns an empty list, which still counts as activity. Never commit either value to the repository. Note that GitHub disables scheduled workflows in repositories with no commits for 60 days, so re-enable it from the Actions tab if that happens.

## Deployment

The application is deployed on Vercel with automatic deployments from the main branch.

### Production URL
[https://taskr-todo.vercel.app/](https://taskr-todo.vercel.app/)

## Contact

Anish Kapse - kapseanish@gmail.com

Project Link: [https://github.com/theonlyanish/Taskr-Todo](https://github.com/theonlyanish/Taskr-Todo)
