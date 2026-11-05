# Moving the Cold Calling Tracker off Cloudflare (free, with all your data)

The app now runs on Netlify (free, commercial use allowed) with its database on Turso (free, no card).
Run every command in the project folder, the one that contains package.json.

## 1. Save your live data FIRST (2 minutes)
Do this before you change anything in the project folder.

    npx wrangler d1 export quantumedge-tracker --remote --output backup.sql

Check that backup.sql exists and is not empty. Keep a copy somewhere safe. It contains all your
leads, calls, meetings, projects, payments, scripts and logins. Do not upload it anywhere public.

## 2. Create the two free accounts
- Turso (turso.tech): sign up, then create TWO databases:
    quantumedge-prod   the live one
    quantumedge-dev    optional, for trying things out (you can use a plain local file instead)
  For the live database choose a location in the US East, next to where Netlify runs your pages.
  Open the database, copy its URL (it starts with libsql://) and create a token (a long text).
- Netlify (netlify.com) and GitHub (github.com): sign up with GitHub. No card is needed.

## 3. Update the project
1. Extract the new zip into your project folder and choose Replace for all files.
2. Delete these old files if they are still there: wrangler.jsonc, open-next.config.ts, cloudflare-env.d.ts
3. npm install

## 4. Try it on your own computer (no account needed)
1. Copy .env.example to a new file called .env.local (leave it as it is, it uses a plain file)
2. npm run db:migrate
3. npm run seed          (creates your admin login for local testing)
4. npm run dev           (open http://localhost:3000)

## 5. Restore your live data into Turso
1. Create a file called .env.prod containing:
       TURSO_DATABASE_URL=libsql://your-database-url-from-turso
       TURSO_AUTH_TOKEN=your-token-from-turso
2. npm run db:import:prod -- backup.sql
   It copies everything and then checks every table against the backup. Every line must say OK.
3. npm run db:migrate:prod
You sign in with the same usernames and passwords as before. Nothing needs to be re-created.

## 6. Put the site online on Netlify
1. Create a private GitHub repository and upload the project (.env.local, .env.prod, backup.sql and
   local.db are ignored automatically and will not be uploaded).
2. Netlify > Add new site > Import an existing project > choose the repository.
3. Before the first deploy open Site configuration > Environment variables and add:
       TURSO_DATABASE_URL   (the same value as in .env.prod)
       TURSO_AUTH_TOKEN     (the same value as in .env.prod)
4. Deploy. Then Site configuration > Change site name to something short.

Later updates: push to GitHub and Netlify redeploys. If an update adds a migration, run
npm run db:migrate:prod first.

## Your own domain
Netlify > Domain management > Add a domain. Follow its DNS instructions. Free HTTPS is included.

## Free plan limits to know about
- Netlify gives 300 credits a month. Each production deploy costs about 15, and traffic and function time
  use a few more. A small team stays well inside this. If credits run out the site pauses until the next
  month (nothing is charged). Check Team > Usage now and then, and avoid deploying many times a day.
- Turso free: 5 GB, 500 million row reads and 10 million row writes a month. Far above what you use.

## Backups
Take a copy whenever you like. In the Turso dashboard open the database and use its export or dump
option, or keep taking the backup.sql style copy before big changes.
Keep your Cloudflare database for a few weeks as a second copy before deleting it.

## Demo data for screenshots (development database only)
    npm run seed:demo
It refuses to run on the live database.
