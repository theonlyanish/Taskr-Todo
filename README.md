# Task Manager - Task Management Application

## Project Overview

A modern, TypeScript-based task management web application built with React. Task Manager provides an intuitive interface for managing tasks with real-time synchronization across devices, featuring both Kanban and Calendar views, and a sleek dark/light mode interface.

Live Demo: [https://lapis-todo.vercel.app/](https://lapis-todo.vercel.app/)

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
git clone https://github.com/theonlyanish/Lapis-Todo.git
```

2. Install dependencies
```bash
cd Lapis-Todo
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
Lapis-Todo/
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

## Deployment

The application is deployed on Vercel with automatic deployments from the main branch.

### Production URL
[https://lapis-todo.vercel.app/](https://lapis-todo.vercel.app/)

## Contact

Anish Kapse - kapseanish@gmail.com

Project Link: [https://github.com/theonlyanish/Lapis-Todo](https://github.com/theonlyanish/Lapis-Todo)
