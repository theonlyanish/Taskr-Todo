# Taskr - Task Management Application

## Project Overview

Taskr is a free todo app with Kanban, Calendar and list views that works offline and needs no sign-up. Open it and start adding tasks straight away: your list is saved in your browser, so it is still there when you come back, with or without an internet connection. Break big tasks into subtasks, drag cards between columns, and switch to dark mode when you like. If you want your tasks on more than one device, you can create a free account and sync them, but you never have to.

A modern, TypeScript-based task management web application built with React. Taskr provides an intuitive interface for managing tasks with real-time synchronization across devices, featuring both Kanban and Calendar views, and a sleek dark/light mode interface.

Live Demo: [https://taskr-todo.vercel.app/](https://taskr-todo.vercel.app/)

## Features

- Kanban board with drag and drop between To Do, In Progress and Done
- Calendar view to see tasks by due date
- List view for a plain, fast checklist
- Subtasks to break work into smaller steps
- Works offline, with changes kept locally until you are back online
- Dark mode and light mode, following your system or your choice
- No account needed to start; optional free sign-up for cross-device sync
- Import from Todoist (CSV export) or any CSV with a title column (free account needed)
- Export to Markdown as a GitHub-style checklist grouped by status (free account needed)
- Ctrl+K command palette to switch views, add tasks, import, export or jump to a task
- Calendar week view with an Unscheduled tray you can drag tasks from onto a day
- Natural language due dates when typing a task, such as "pay rent fri" or "dentist 3 Nov"
- Undo after delete, with five seconds to bring a task back
- Keyboard shortcuts 1, 2 and 3 to switch between List, Board and Calendar

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

## FAQ

### Is Taskr free?

Yes. Taskr is completely free to use, with no paid tier, trial period or ads.

### Do I need an account?

No. You can use every view and feature without signing up. Creating an account is optional and only needed if you want to sync your tasks across devices, import tasks or export them.

### Does it work offline?

Yes, when you use it without an account: your tasks are kept in your browser and everything works without a connection. If you are signed in, changes are saved to the cloud, so you need a connection for them to be saved, and the sync indicator shows when you are offline.

### Can I sync across devices?

Yes, if you want to. Create a free account and your tasks are stored in the cloud and kept in sync on every device where you sign in.

### Can I import my tasks from Todoist?

Yes. In Todoist, open a project and choose Export as CSV (template). Then sign in to Taskr with a free account, open the account menu and choose Import tasks. Tasks, subtasks, descriptions, comments and due dates come across; sections and recurring dates are kept as notes in the task description. Any other CSV with a title column works too. See the step-by-step import guide at https://taskr-todo.vercel.app/import-from-todoist.html.

### Can I export my tasks?

Yes. Sign in with a free account, open the account menu and choose Export tasks. Taskr downloads a Markdown file with every task as a GitHub-style checklist, grouped into To Do, In Progress and Completed, with due dates, descriptions and subtasks included. The file opens in any text editor and pastes into GitHub issues, Obsidian or any Markdown editor.

### Where is my data stored?

Without an account, your tasks live only in your browser (IndexedDB) on your own device. With an account, they are also stored in Taskr's Supabase database so they can be synced. Taskr is open source on GitHub.

## Technology Stack

- **Frontend**:
  - React 18.3.1
  - TypeScript
  - Mantine UI v7.17.0 (Component Library)
  - FullCalendar for calendar functionality
  - dnd-kit for touch-friendly drag and drop
  - chrono-node for natural language due dates
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

## Search engines and IndexNow

Everything in `public/` is copied into the build as-is, so the crawler-facing files are plain static files served by Vercel: `robots.txt`, `sitemap.xml`, `llms.txt`, the hidden landing block and JSON-LD in `index.html`, and three standalone guide pages (`import-from-todoist.html`, `offline-todo-app.html`, `changelog.html`). The React app never links to the guide pages; they are reached from the sitemap, `llms.txt` and the landing block only.

### Verify the site in Bing Webmaster Tools

1. Sign in at https://www.bing.com/webmasters and choose **Add a site**. If the site is already verified in Google Search Console, pick **Import from Google Search Console** and skip the rest of this list.
2. Enter `https://taskr-todo.vercel.app/` and choose the **XML file** method. Download the `BingSiteAuth.xml` file it gives you and commit it to `public/` so it is served at `https://taskr-todo.vercel.app/BingSiteAuth.xml`. (The **meta tag** method also works: add the tag to the `<head>` of `public/index.html`.)
3. Deploy, then click **Verify**.

### Submit the sitemap

In Bing Webmaster Tools open **Sitemaps → Submit sitemap** and enter `https://taskr-todo.vercel.app/sitemap.xml`. Google picks the same URL up from the `Sitemap:` line in `robots.txt`, or submit it under **Sitemaps** in Search Console. Update the `<lastmod>` dates in `public/sitemap.xml` whenever one of the listed pages changes.

### Ping IndexNow after a deploy

IndexNow tells Bing, Yandex, Naver, Seznam and Yep about changed URLs straight away, and Bing shares the pings with the others. The site's key is the file name of `public/0ca74054a6f2d846344421ed70a17452.txt`, which contains only the key and is served at the site root. To generate a new key, run `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`, save it as `public/<key>.txt` with the key as its only content, and use it below.

After a deploy that changes any of the listed pages, send one request with all changed URLs:

```bash
curl -X POST "https://api.indexnow.org/IndexNow" -H "Content-Type: application/json; charset=utf-8" -d '{"host":"taskr-todo.vercel.app","key":"0ca74054a6f2d846344421ed70a17452","keyLocation":"https://taskr-todo.vercel.app/0ca74054a6f2d846344421ed70a17452.txt","urlList":["https://taskr-todo.vercel.app/","https://taskr-todo.vercel.app/import-from-todoist.html","https://taskr-todo.vercel.app/offline-todo-app.html","https://taskr-todo.vercel.app/changelog.html"]}'
```

A `200` or `202` response means the URLs were accepted. `403` means the key file could not be fetched (check it deployed), `422` means a URL does not belong to the host, and `429` means too many requests. Pinging unchanged URLs repeatedly is counted as spam, so only send URLs whose content actually changed.

## Deployment

The application is deployed on Vercel with automatic deployments from the main branch.

### Production URL
[https://taskr-todo.vercel.app/](https://taskr-todo.vercel.app/)

## Contact

Anish Kapse - kapseanish@gmail.com

Project Link: [https://github.com/theonlyanish/Taskr-Todo](https://github.com/theonlyanish/Taskr-Todo)
