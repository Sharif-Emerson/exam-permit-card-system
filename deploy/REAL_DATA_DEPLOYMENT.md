# Real Data Deployment

This stack supports two production shapes:

1. Same-origin deployment through Nginx and `/api`
2. Frontend build against a public API URL

## 1. Prepare backend environment

Copy [deploy/backend.env.example](c:/Users/kabuy/OneDrive/Desktop/project/deploy/backend.env.example) into your deployment environment and set real values.

Minimum required values for a fresh real deployment:

- `APP_DB_PATH=/app/data/production.sqlite`
- `BOOTSTRAP_ADMIN_EMAIL=owner@yourdomain.com`
- `BOOTSTRAP_ADMIN_PASSWORD=<strong password>`
- `CORS_ALLOWED_ORIGINS=https://app.yourdomain.com`

## 2. Persistent storage

The compose stack already mounts:

- `/app/data`
- `/app/uploads`

Do not remove those volumes in production. They hold your real student records, sessions, imports, and uploads.

## 3. Choose API strategy

### Same-origin proxy

Leave `VITE_API_BASE_URL` empty.

The frontend will call `/api`, and [deploy/nginx.conf](c:/Users/kabuy/OneDrive/Desktop/project/deploy/nginx.conf) will proxy those requests to the backend container.

### Public API URL

Set:

- `VITE_API_BASE_URL=https://api.yourdomain.com`

Then rebuild the frontend image so the app is compiled against that API base URL.

## 4. Deploy with Docker Compose

From the project root:

```bash
docker compose --env-file deploy/backend.env.example -f docker-compose.deploy.yml up --build -d
```

For real deployment, use your own env file instead of the example file.

## 5. First login

On a brand-new database, log in with the bootstrap admin credentials you set above.

After that:

1. Update fee structure if needed.
2. Import or create real students.
3. Stop using reset scripts on the production database.