# Ledge

Ledge is a full-stack shared-expense management app for trips, roommates, friends, and teams. It helps users create private groups, invite members, record expenses, split bills, simplify debts, settle balances, and analyze spending patterns.

## Highlights

- OTP-based signup verification with email/password login and JWT
- User-private groups and MongoDB Atlas persistence
- Email-based member invites and balance reminders
- Expense receipt upload with optional Cloudinary storage
- Multiple split modes: equal, exact, percentage, shares
- Per-expense currency and exchange-rate support
- Debt simplification algorithm
- Pay Now settlement action
- Settlement history
- Analytics for spending categories, member contribution, monthly trends, average expense, and top payer
- CSV export for expense data
- Responsive React dashboard UI

## Tech Stack

- Frontend: React, Vite, CSS
- Backend: Node.js, Express.js
- Database: MongoDB Atlas, Mongoose
- Auth: Email OTP verification, JWT, PBKDF2 password hashing
- Email: Nodemailer + SMTP
- Receipt storage: Cloudinary when configured, MongoDB fallback for local development

## Architecture

```text
React/Vite Client
  -> Express REST API
    -> JWT auth middleware
    -> MongoDB/Mongoose models
    -> Nodemailer SMTP service
    -> Cloudinary receipt upload service
```

## Key Features For Evaluation

- Full-stack CRUD with private user data
- Real-world data modeling for groups, members, expenses, settlements, receipts, and invites
- Practical algorithmic feature: debt simplification
- Data-analysis features: category breakdown, monthly trend, member contribution, top payer, average expense
- Deployment-ready environment variable structure
- Production-oriented improvements: OTP verification, JWT auth, optional Cloudinary, SMTP integration

## Local Setup

1. Open this folder in VS Code:

   `C:\Users\prnav\Documents\Codex\2026-07-02\splitwise-is-a-popular-app-for\outputs\splitwise-fullstack`

2. Install dependencies:

   ```bash
   npm run install:all
   ```

3. Create `server\.env`:

   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_atlas_connection_string
   CLIENT_URL=http://127.0.0.1:5173
   JWT_SECRET=replace_with_a_long_random_secret
   JWT_EXPIRES_IN=7d

   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_gmail_app_password
   MAIL_FROM=Ledge <your_email@gmail.com>

   CLOUDINARY_CLOUD_NAME=
   CLOUDINARY_API_KEY=
   CLOUDINARY_API_SECRET=
   ```

4. Create `client\.env`:

   ```env
   VITE_API_URL=http://127.0.0.1:5000/api
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open the Vite URL shown in the terminal.

## Email Setup

For Gmail SMTP:

1. Enable 2-step verification on your Google account.
2. Generate an app password.
3. Use that app password as `SMTP_PASS`.

If SMTP is not configured, Ledge will not crash. It logs skipped emails in the backend terminal.

## Receipt Storage

If Cloudinary variables are configured, receipt images are uploaded to Cloudinary and MongoDB stores the returned URL. If not configured, the app stores image data directly in MongoDB for easier local testing.

## Main API Routes

- `POST /api/auth/register`
- `POST /api/auth/verify-otp`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/groups`
- `POST /api/groups`
- `POST /api/groups/:id/members`
- `POST /api/groups/:id/expenses`
- `DELETE /api/groups/:id/expenses/:expenseId`
- `POST /api/groups/:id/settlements`
- `DELETE /api/groups/:id/settlements/:settlementId`
- `POST /api/groups/:id/reminders`
- `DELETE /api/groups/:id`

## Deployment Plan

- Frontend: Vercel
- Backend: Render or Railway
- Database: MongoDB Atlas
- Images: Cloudinary
- Email: Gmail SMTP, SendGrid, or Resend SMTP

Set `CLIENT_URL` on the backend to the deployed frontend URL and set `VITE_API_URL` on the frontend to the deployed backend API URL.

## Future Scope

- Accept invite links directly inside the app
- Add live exchange-rate API
- Add payment gateway integration
- Add charts with Recharts or Chart.js
- Add password reset flow
- Add automated tests for balance calculation and debt simplification
