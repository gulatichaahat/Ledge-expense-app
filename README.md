# Ledge

Ledge is a full-stack shared-expense management web app inspired by Splitwise. It helps users create groups, invite friends, add shared expenses, split bills using multiple methods, simplify debts, record settlements, and analyze spending behavior.

The project is built as a production-style MERN application with authentication, email OTP verification, invite notifications, MongoDB persistence, receipt uploads, analytics, and deployment-ready configuration.

## Features

- Email/password authentication with OTP email verification
- JWT-based protected API routes
- Private user accounts and user-specific groups
- Group creation for trips, roommates, friends, family, or teams
- Email-based member invites
- In-app notification dropdown for pending group invitations
- Accept invite flow so invited users can join shared groups
- Add expenses with payer, category, date, notes, receipt image, currency, and exchange rate
- Split methods: equal, exact amount, percentage, and shares
- Automatic balance calculation
- Debt simplification to reduce the number of settlement transactions
- Pay Now style settlement action
- Manual settlement history
- Reminder emails for pending balances
- Analytics dashboard with category breakdown, member contribution, monthly trend, top payer, average expense, and open transfer count
- CSV export for expenses
- Receipt upload support with optional Cloudinary storage
- Dark/light mode toggle
- Responsive dashboard UI for desktop, tablet, and mobile

## Tech Stack

**Frontend**

- React
- Vite
- CSS
- Lucide React icons

**Backend**

- Node.js
- Express.js
- Mongoose
- JWT authentication
- PBKDF2 password hashing

**Database**

- MongoDB Atlas

**Email**

- SendGrid API support
- Resend API support
- Nodemailer SMTP fallback

**Storage**

- Cloudinary for receipt images when configured
- MongoDB fallback for local receipt testing

## Architecture

```text
React + Vite Client
        |
        | REST API
        v
Express.js Backend
        |
        | JWT Auth Middleware
        v
MongoDB Atlas + Mongoose
        |
        | Email / Receipts
        v
SendGrid / Resend / SMTP + Cloudinary
```

## Folder Structure

```text
splitwise-fullstack/
  client/
    src/
      main.jsx
      styles.css
    package.json
  server/
    src/
      index.js
      routes/
        auth.js
        groups.js
      models/
        User.js
        Group.js
      utils/
        balances.js
        mailer.js
        receipts.js
        tokens.js
    package.json
    .env.example
  package.json
  README.md
```

## Local Setup

Open the project folder:

```powershell
cd C:\Users\prnav\Documents\Codex\2026-07-02\splitwise-is-a-popular-app-for\outputs\splitwise-fullstack
```

Install dependencies:

```powershell
npm run install:all
```

Create `server/.env`:

```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
CLIENT_URL=http://127.0.0.1:5173

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d

SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
RESEND_API_KEY=

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

Create `client/.env`:

```env
VITE_API_URL=http://127.0.0.1:5000/api
```

Start the app:

```powershell
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://127.0.0.1:5173
```

## Email Setup

For deployed OTP and invite emails, SendGrid is recommended because it uses an HTTPS API and avoids SMTP timeout issues on hosting platforms.

Recommended Render variables:

```env
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=your_verified_sender_email
MAIL_FROM=Ledge <your_verified_sender_email>
```

SendGrid should show as active at:

```text
https://your-render-backend.onrender.com/api/health
```

Expected response:

```json
{
  "ok": true,
  "service": "splitwise-server",
  "emailProvider": "sendgrid"
}
```

If `SENDGRID_API_KEY` is not configured, the app can use Resend through `RESEND_API_KEY`, or SMTP through the `SMTP_*` variables.

## Deployment

Recommended deployment:

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas
- Email: SendGrid
- Receipts: Cloudinary

### Backend On Render

Create a Render Web Service:

```text
Root Directory: server
Build Command: npm install
Start Command: npm start
```

Required environment variables:

```env
MONGODB_URI=your_mongodb_atlas_connection_string
CLIENT_URL=https://your-vercel-app.vercel.app
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=your_verified_sender_email
MAIL_FROM=Ledge <your_verified_sender_email>
```

Optional environment variables:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
RESEND_API_KEY=
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
```

### Frontend On Vercel

Create a Vercel project:

```text
Root Directory: client
Build Command: npm run build
Output Directory: dist
```

Required environment variable:

```env
VITE_API_URL=https://your-render-backend.onrender.com/api
```

After deployment, update Render `CLIENT_URL` to your actual Vercel frontend URL and redeploy the backend.

## API Routes

### Auth

- `POST /api/auth/register`
- `POST /api/auth/verify-otp`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Groups

- `GET /api/groups`
- `POST /api/groups`
- `DELETE /api/groups/:id`
- `POST /api/groups/:id/members`

### Invitations

- `GET /api/groups/invitations`
- `POST /api/groups/invitations/:id/accept`

### Expenses

- `POST /api/groups/:id/expenses`
- `DELETE /api/groups/:id/expenses/:expenseId`

### Settlements

- `POST /api/groups/:id/settlements`
- `DELETE /api/groups/:id/settlements/:settlementId`

### Reminders

- `POST /api/groups/:id/reminders`

### Health

- `GET /api/health`

## Data Analytics Features

The analytics dashboard is useful for data-analysis evaluation because it summarizes:

- Category-wise spending
- Member-wise contribution
- Monthly spending trend
- Highest expense
- Top payer
- Settlement progress
- Open balance amount
- Simplified transfer count

## Resume Highlights

- Built a full-stack expense-sharing platform with React, Node.js, Express, MongoDB, and JWT authentication
- Implemented OTP-based signup verification and email-based group invitations
- Designed a debt simplification algorithm to minimize settlement transactions
- Added analytics for spending categories, member contributions, monthly trends, and settlement progress
- Integrated deployment-ready email providers, MongoDB Atlas, Cloudinary, Vercel, and Render
- Built a responsive dark/light dashboard UI with notification-driven invite acceptance

## Future Improvements

- Add password reset
- Add real-time invite notifications using WebSockets
- Add live currency conversion API
- Add payment gateway integration
- Add automated tests for balance calculation and debt simplification
- Add charts using Recharts or Chart.js
