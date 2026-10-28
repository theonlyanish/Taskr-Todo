# Taskr - Task Management Application

## Project Overview

Taskr is a free todo app with Kanban, Calendar and list views that works offline and needs no sign-up. Open it and start adding tasks straight away: your list is saved in your browser, so it is still there when you come back, with or without an internet connection. Break big tasks into subtasks, drag cards between columns, and switch to dark mode when you like. If you want your tasks on more than one device, you can create a free account and sync them, but you never have to.

Under the hood it is a React 18 and TypeScript single-page app that is local-first: tasks live in the browser's IndexedDB, and Supabase is added on top only for people who sign in, with an offline outbox so signed-in changes made without a connection are sent later. The engineering notes are at https://taskr-todo.vercel.app/how-its-built.html.

Live Demo: [https://taskr-todo.vercel.app/](https://taskr-todo.vercel.app/)

## Features

- Kanban board with drag and drop between To Do, In Progress and Done
- Calendar view to see tasks by due date
- List view for a plain, fast checklist
- Lists to keep separate sets of tasks, such as Work, Home or a trip, each with its own List, Board and Calendar views, switched from a menu beside the logo or Ctrl+K; works without an account
- Subtasks to break work into smaller steps
- Subtask progress on every card, a "1 of 3 subtasks" chip with a ring that fills as they are done and expands to show them
- Works offline with changes kept locally until you are back online
- Offline saving for signed-in accounts so changes you make without a connection are kept on your device and sent to your account when you reconnect
- Dark mode and light mode, with a toggle in the header where the sun turns into a moon
- Follows your system theme until you pick one yourself, switching live when your device changes between light and dark; "Theme: match my device" in Ctrl+K or the account menu goes back to following it
- No account needed to start; optional free sign-up with email or Google for cross-device sync
- Live sync so a change in one tab or on one device shows up on your others straight away, with no refresh
- Sync status in the header showing whether everything is saved, syncing, offline with a count of changes waiting, or failed and ready to retry
- Import from Todoist (CSV export) or any CSV with a title column (free account needed)
- Export to Markdown as a GitHub-style checklist grouped by list and status (free account needed)
- Ctrl+K command palette to switch views, add tasks, import, export or jump to a task
- Search box in the header that finds any task or subtask by title as you type
- Calendar week view with an Unscheduled tray you can drag tasks from onto a day
- Calendar on your phone fits the month to a small screen; tap a day and its tasks are listed underneath, where you can tick them off or open them
- Natural language due dates when typing a task, such as "pay rent fri" or "dentist 3 Nov"
- Repeating tasks from typing "gym every friday", "pay rent every month" or "standup every weekday", or picking a Repeat option; completing one adds the next, with undo
- Due-date reminders you can turn on, shown as a browser notification at 9am on the day a task is due while Taskr is open in a tab
- Relative due dates on cards, such as Tomorrow, Friday or 3 days ago, with overdue tasks marked
- Add task box that adds a task from one line, with Add details for the description, status, due date, list and repeat
- Coming up beside the list, showing overdue tasks, today's and the rest of the week
- Section counts on every list section and board column, a Completed section you can fold away, and a short hint when a section is empty
- Task reorder by dragging tasks into the order you want within a list or column; the order is kept on every device
- Focus timer to work on one task for 15, 25 or 50 minutes, with pause, extend and a chime when time is up; it keeps going after a reload and shows the time left in the tab title
- Stats showing tasks done this week and per week for the last eight weeks, your current and best streak, the typical time from In Progress to done, and what has been in progress longest
- Task templates to add a task with its subtasks in one click, from a built-in template or one you saved from any task
- Bulk actions to select several tasks with Ctrl-click, Shift-click or Select tasks in Ctrl+K, then move, complete or delete them together, or move them to another list
- Undo after delete with five seconds to bring a task back
- Recently deleted keeps deleted tasks for 30 days on all your devices so you can restore them (free account needed)
- Signed-in device management to see where you are signed in and sign out other devices, or everywhere, from the account menu
- Account preferences so your theme, view, calendar layout and the list you had open follow you to every device where you sign in
- Account deletion from the account menu, removing your account and all its tasks after a typed confirmation
- Keyboard shortcuts 1, 2 and 3 switch between List, Board and Calendar; j and k move between tasks, x completes, e edits, n adds, / searches and ? shows the full list

Every feature is free and most work without an account; the ones marked "free account needed" need somewhere durable to keep or fetch tasks. This list mirrors `content/features.json`, which generates the crawler-facing copy.

## FAQ

### Is Taskr free?

Yes. Taskr is completely free to use, with no paid tier, trial period or ads.

### Do I need an account?

No. You can use every view and feature without signing up. Creating an account is optional and only needed if you want to sync your tasks across devices, import tasks or export them. You can sign up with an email address and password, or with your Google account.

### Does it work offline?

Yes. Without an account, your tasks are kept in your browser and everything works without a connection. If you are signed in, changes made offline are saved on your device and sent to your account automatically when you reconnect.

### Can I sync across devices?

Yes, if you want to. Create a free account and your tasks are stored in the cloud and kept in sync on every device where you sign in.

### Can I keep separate lists, such as work and home?

Yes. Taskr starts with one list, Personal, and you can add your own, such as Work, Home or a trip. Each list has its own List, Board and Calendar views, and you switch between them from the menu beside the logo or with Ctrl+K. Lists work without an account; with one, they sync to every device where you sign in.

### Can tasks repeat?

Yes. Type a task such as "gym every friday", "pay rent every month" or "standup every weekday", or pick a Repeat option under Add details. A repeating task always has a due date; when you complete it, the next one is added with the next due date, and you can undo that if you did not mean to.

### Does Taskr send reminders?

Only while it is open. You can turn on due-date reminders, and Taskr then shows a browser notification at 9am on the day a task is due, but only while Taskr is open in a browser tab on that device. It does not send push notifications to a closed app, and it does not send emails. The setting is kept per device.

### Can I import my tasks from Todoist?

Yes. In Todoist, open a project and choose Export as CSV (template). Then sign in to Taskr with a free account, open the account menu and choose Import tasks. Tasks, subtasks, descriptions, comments and due dates come across, and recurring dates such as every Monday become repeating tasks; sections, and dates Taskr can't read, are kept as notes in the task description. Any other CSV with a title column works too. See the step-by-step import guide at https://taskr-todo.vercel.app/import-from-todoist.html.

### Can I export my tasks?

Yes. Sign in with a free account, open the account menu and choose Export tasks. Taskr downloads a Markdown file with every task as a GitHub-style checklist, grouped into To Do, In Progress and Completed, with due dates, descriptions and subtasks included. The file opens in any text editor and pastes into GitHub issues, Obsidian or any Markdown editor.

### Where is my data stored?

Without an account, your tasks live only in your browser (IndexedDB) on your own device. With an account, they are also stored in Taskr's Supabase database so they can be synced. The privacy policy at https://taskr-todo.vercel.app/privacy.html lists everything Taskr keeps, and Taskr is open source at https://github.com/theonlyanish/Taskr-Todo.

## Technology Stack

- **Frontend**: React 18 and TypeScript, built with Create React App (react-scripts 5)
  - FullCalendar for the month and week calendar
  - dnd-kit for touch-friendly drag and drop on the board
  - chrono-node for natural language due dates and repeats, loaded on first use
  - IBM Plex Sans (bundled via @fontsource-variable)
  - Plain CSS in `src/styles.css`; no component library
- **On the device**: IndexedDB for tasks and the offline outbox, localStorage for settings, a service worker so the app opens offline
- **Backend, only for signed-in users**: Supabase
  - Postgres tables `tasks`, `task_lists` and `task_templates`, with row-level security, under `supabase/migrations`
  - Supabase Auth for email and password sign-in and Sign in with Google
  - Realtime broadcast for live sync between devices
  - User metadata for account preferences
- **Tests**: Jest and Testing Library, run with a type check on every push by GitHub Actions
- **Deployment**: Vercel, with Vercel Web Analytics for anonymous page views

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
│   ├── App.tsx              the app shell: views, dialogs, task handlers, command palette items
│   ├── components/          views (TaskList, KanbanView, CalendarView), dialogs, cards, menus
│   ├── services/            Supabase access: auth, tasks, lists, templates, the offline outbox (syncQueue)
│   ├── utils/               pure logic with tests: due dates, repeats, stats, reminders, lists, import/export, shortcuts
│   ├── types/               the Task type
│   └── styles.css
├── public/                  static files served as-is: index.html, guide pages, robots, sitemap, llms.txt
├── content/features.json   single source for the crawler-facing copy
├── scripts/                 generate-seo.mjs (runs before every build), make-og-image.mjs
├── supabase/migrations/     the database schema, one file per change
├── .github/workflows/       tests on every push; a cron that keeps the Supabase project awake
└── vercel.json              real 404s for unknown paths
```

## How it works

The short version: every change is written to IndexedDB on the device first, so guests never touch a server and signed-in users see their list instantly and offline. For accounts, each change is also sent to Supabase; when there is no connection it waits in an outbox and is sent in order on reconnect. Lists are a `task_lists` table plus a `tasks.list_id` column with no foreign key (an unknown or empty list means Personal). Repeats are a short string on the task such as `week:1` or `month:1@31`, and the next occurrence is created on the device when one is completed. Stats come from `started_at` and `completed_at` timestamps. Reminders are browser notifications checked once a minute while a tab is open, not push. Account preferences sync through Supabase user metadata. Every column added by a later migration has a fallback until that migration runs.

The full write-up, including the bugs worth learning from, is at https://taskr-todo.vercel.app/how-its-built.html.

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

Everything in `public/` is copied into the build as-is, so the crawler-facing files are plain static files served by Vercel: `robots.txt`, `sitemap.xml`, `llms.txt`, the hidden landing block and JSON-LD in `index.html`, four standalone guide pages (`import-from-todoist.html`, `offline-todo-app.html`, `changelog.html`, `how-its-built.html`) and the privacy policy (`privacy.html`, also used as the privacy policy URL on the Google OAuth consent screen, so its address must not change). The app's footer links to the how-it's-built page and the privacy policy; the other guide pages are reached from the sitemap, `llms.txt`, the landing block and each other's footers.

### Keeping the crawler copy current

The feature list, FAQ and changelog that crawlers see are generated from one file, `content/features.json`. When a feature ships, add it there (name, one-line description, shipped date) and run:

```bash
npm run seo
```

That rewrites the hidden landing block and the two JSON-LD blocks in `public/index.html` (between the `<!-- seo:start -->` / `<!-- seo:end -->` and `<!-- seo:jsonld:start -->` / `<!-- seo:jsonld:end -->` markers), all of `public/llms.txt`, the dated list in `public/changelog.html`, and every `<lastmod>` in `public/sitemap.xml` from the page's last git commit. The "Last updated" dates are set to the newest shipped date. The same script runs as `prebuild`, so `npm run build` (and every Vercel deploy) regenerates these files; `node scripts/generate-seo.mjs --check` exits non-zero if the committed files are out of date. Running it twice produces no diff. Hand-edit only outside the markers. The guide pages, the privacy policy and this README are not generated: when `content/features.json` changes, update the Features and FAQ sections here to match, and check the guide pages for claims the change makes stale.

Unknown paths return a real 404. `vercel.json` serves whatever exists in the build first (the app at `/`, the guide pages, assets) and sends every other path to `public/404.html` with a 404 status, replacing the Create React App preset's catch-all rewrite to `index.html` that used to answer 200 for any URL. The app has no client-side routes (state lives in query parameters), so nothing depends on that rewrite.

### Verify the site in Bing Webmaster Tools

1. Sign in at https://www.bing.com/webmasters and choose **Add a site**. If the site is already verified in Google Search Console, pick **Import from Google Search Console** and skip the rest of this list.
2. Enter `https://taskr-todo.vercel.app/` and choose the **XML file** method. Download the `BingSiteAuth.xml` file it gives you and commit it to `public/` so it is served at `https://taskr-todo.vercel.app/BingSiteAuth.xml`. (The **meta tag** method also works: add the tag to the `<head>` of `public/index.html`.)
3. Deploy, then click **Verify**.

### Submit the sitemap

In Bing Webmaster Tools open **Sitemaps → Submit sitemap** and enter `https://taskr-todo.vercel.app/sitemap.xml`. Google picks the same URL up from the `Sitemap:` line in `robots.txt`, or submit it under **Sitemaps** in Search Console. The `<lastmod>` dates in `public/sitemap.xml` are set by `npm run seo` from each page's last git commit.

### Ping IndexNow after a deploy

IndexNow tells Bing, Yandex, Naver, Seznam and Yep about changed URLs straight away, and Bing shares the pings with the others. The site's key is the file name of `public/0ca74054a6f2d846344421ed70a17452.txt`, which contains only the key and is served at the site root. To generate a new key, run `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`, save it as `public/<key>.txt` with the key as its only content, and use it below.

After a deploy that changes any of the listed pages, send one request with all changed URLs:

```bash
curl -X POST "https://api.indexnow.org/IndexNow" -H "Content-Type: application/json; charset=utf-8" -d '{"host":"taskr-todo.vercel.app","key":"0ca74054a6f2d846344421ed70a17452","keyLocation":"https://taskr-todo.vercel.app/0ca74054a6f2d846344421ed70a17452.txt","urlList":["https://taskr-todo.vercel.app/","https://taskr-todo.vercel.app/import-from-todoist.html","https://taskr-todo.vercel.app/offline-todo-app.html","https://taskr-todo.vercel.app/how-its-built.html","https://taskr-todo.vercel.app/changelog.html"]}'
```

A `200` or `202` response means the URLs were accepted. `403` means the key file could not be fetched (check it deployed), `422` means a URL does not belong to the host, and `429` means too many requests. Pinging unchanged URLs repeatedly is counted as spam, so only send URLs whose content actually changed.

## Deployment

The application is deployed on Vercel with automatic deployments from the main branch.

### Production URL
[https://taskr-todo.vercel.app/](https://taskr-todo.vercel.app/)

## Contact

Anish Kapse - kapseanish@gmail.com

Project Link: [https://github.com/theonlyanish/Taskr-Todo](https://github.com/theonlyanish/Taskr-Todo)
