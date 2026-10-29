# BlogSpace — Blog Platform with Comments

A responsive full-stack blog application built for an internship task. Users can register/login, publish posts, edit/delete their own posts, comment on posts, and delete comments they authored. The post owner can also remove comments on their own post.

## Tech stack
- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js and Express REST API
- Database: MongoDB with Mongoose
- Authentication: bcrypt password hashing + JSON Web Tokens (JWT)

## Features
- User registration, login, and authenticated sessions
- Create, read, update, and delete blog posts
- Add comments and delete permitted comments
- Ownership checks on edits/deletes
- Responsive layout for desktop and mobile
- REST API error handling and `/api/health` endpoint

## Requirements
- Node.js 18 or newer
- A MongoDB database, local or MongoDB Atlas
- Internet connection for installing packages

## Setup (Windows)
1. Extract the ZIP into a folder, for example `blog-platform-with-comments`.
2. Install Node.js LTS from https://nodejs.org/ if it is not already installed.
3. Open the extracted folder in VS Code.
4. In VS Code choose **Terminal → New Terminal**.
5. Run:
   ```bash
   npm install
   ```
6. Create a database:
   - Easiest hosted option: create a free cluster at https://www.mongodb.com/atlas/database.
   - Create a database user and password.
   - In Atlas, add your current IP address under Network Access.
   - Open **Connect → Drivers** and copy the connection string.
   - Replace the username/password placeholders. Use URL-encoding for special characters in the password.
7. Copy `.env.example` and rename the copy to `.env` (make sure it is not named `.env.txt`).
8. Edit `.env` and set `MONGODB_URI` to your connection string and `JWT_SECRET` to a long random secret. Example:
   ```env
   PORT=3000
   MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.example.mongodb.net/blog_platform?retryWrites=true&w=majority
   JWT_SECRET=put_a_long_random_secret_here
   ```
9. Start the server:
   ```bash
   npm start
   ```
10. Open http://localhost:3000 in Chrome.

The terminal should show `Connected to MongoDB` and `Blog platform running at http://localhost:3000`.

## How to test
1. Click **Create account** and register with your name, email, and a password of at least 6 characters.
2. Publish a post.
3. Publish a second account in another browser/incognito window to test comments.
4. Verify that you can edit/delete only your own posts.
5. Verify comments can be added and deleted by their author or the owner of the post.
6. Check the API health endpoint at http://localhost:3000/api/health.

## REST API overview

| Method | Endpoint | Purpose | Auth required |
|---|---|---|---|
| GET | `/api/health` | Health check | No |
| POST | `/api/auth/register` | Create an account | No |
| POST | `/api/auth/login` | Log in | No |
| GET | `/api/auth/me` | Current user | Yes |
| GET | `/api/posts` | List posts | No |
| GET | `/api/posts/:id` | Get one post | No |
| POST | `/api/posts` | Create a post | Yes |
| PUT | `/api/posts/:id` | Update own post | Yes |
| DELETE | `/api/posts/:id` | Delete own post | Yes |
| POST | `/api/posts/:id/comments` | Add a comment | Yes |
| DELETE | `/api/posts/:postId/comments/:commentId` | Delete permitted comment | Yes |

Authenticated requests send `Authorization: Bearer <token>`.

## Project structure

```text
blog-platform-with-comments/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── README.md
```

## Troubleshooting
- **`npm` is not recognized:** close and reopen VS Code after installing Node.js; verify with `node -v` and `npm -v`.
- **MongoDB connection failed:** recheck `MONGODB_URI`, database username/password, and Atlas Network Access IP allowlist.
- **Port already in use:** change `PORT=3000` to `PORT=3001` in `.env`, restart, and open `http://localhost:3001`.
- **Missing `.env`:** ensure the file is named exactly `.env` and is in the same folder as `server.js`.
- **GitHub:** do not upload `.env` or `node_modules`. Upload `.env.example` and the source files instead.

## Security notes
This is an educational internship project, not a production-hardened service. Use a strong private JWT secret, never commit `.env`, and add rate limiting, validation, and security headers before production use.
