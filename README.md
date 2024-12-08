# Lapis Todo - Task Management Application

## Project Overview

A modern, TypeScript-based task management web application built with React. Lapis Todo provides an intuitive interface for managing tasks with real-time synchronization across devices and a sleek dark/light mode interface.

Live Demo: [https://lapis-todo.vercel.app/](https://lapis-todo.vercel.app/)

## Features

### Core Functionality
- **Task Management**
  - Create, update, and delete tasks
  - Mark tasks as complete/incomplete
  - Track task progress (To Do → In Progress → Completed)
  - Add optional descriptions and due dates

### User Experience
- **Cross-Device Sync**: Tasks automatically sync across all devices
- **Theme Support**: Toggle between dark and light modes
- **Responsive Design**: Optimized for both desktop and mobile
- **Offline Support**: Works offline with local storage backup
- **Real-time Updates**: Instant task status updates

## Technology Stack

- **Frontend**: React + TypeScript
- **State Management**: React Hooks
- **Data Persistence**: 
  - Primary: Supabase (PostgreSQL)
  - Backup: Local Storage
- **Styling**: Custom CSS with CSS Variables
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
│   │   ├── TaskForm.tsx
│   │   ├── TaskItem.tsx
│   │   ├── TaskList.tsx
│   │   └── ThemeToggle.tsx
│   ├── services/
│   │   ├── taskService.ts
│   │   ├── supabaseClient.ts
│   │   └── supabaseTaskService.ts
│   ├── types/
│   │   └── Task.ts
│   └── App.tsx
│   └── index.tsx
│   └── styles.css
├── public/
└── package.json
```

## Key Features Implementation

### Data Persistence
- Primary storage in Supabase PostgreSQL database
- Local storage backup for offline functionality
- Automatic sync between devices

### Theme Support
- System-based theme detection
- Manual theme toggle
- Persistent theme preference
- Smooth transition animations

## Deployment

The application is deployed on Vercel with automatic deployments from the main branch.

### Production URL
[https://lapis-todo.vercel.app/](https://lapis-todo.vercel.app/)

## Contact

Anish Kapse - kapseanish@gmail.com

Project Link: [https://github.com/theonlyanish/Lapis-Todo](https://github.com/theonlyanish/Lapis-Todo)
