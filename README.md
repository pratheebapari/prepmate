# PrepMate

Placement preparation platform with faculty-approved resume versions, a quiz bank, learning materials and activity tracking.

## Features
- Student and faculty login
- Resume upload (PDF, DOC, DOCX) with faculty review, versioning and compare
- 14 ready quiz sets with 20+ questions each, plus CSV quiz import for faculty
- Learning materials per topic
- Activity log, notifications, leaderboard and dashboards
- Light and dark themes

## Run locally
1. npm install
2. npm start
3. Open http://localhost:4000

## Demo logins
- Student: student@prepmate.local / student123
- Faculty: faculty@prepmate.local / faculty123

## Configuration
- PORT: server port (default 4000)
- FACULTY_CODE: access code for faculty sign-up (default PREPMATE-FACULTY)
- DATA_DIR: folder for prepmate.json and uploads (default: project folder)
- JWT_SECRET: signing key for logins, always set your own value in production

## Docker
docker build -t prepmate .
docker run -p 4000:4000 -v prepmate-data:/data -e FACULTY_CODE=your-code prepmate

## Stack
Node.js, Express, JSON file storage, vanilla JavaScript frontend
