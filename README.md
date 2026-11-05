# Quantum Edge Cold Calling Tracker

Next.js 15, Drizzle ORM and libSQL (Turso). Free hosting on Netlify.

Setup, restoring your data and deployment are in DEPLOYMENT.md.

Everyday commands
    npm run dev               run on your computer
    npm run db:migrate        apply new database changes to your development database
    npm run db:migrate:prod   apply them to the live database
    npm run seed              create or reset your admin login (development)
    npm run seed:prod         the same for the live database
    npm run seed:demo         fill the development database with demo data
