# Event Booking Platform

A full-stack event booking platform where attendees can browse events, book a
seat, manage their bookings, and anyone can register an account to create and
run their own events — alongside a separate admin dashboard with full
platform-wide control.

## Features

**For attendees**
- Browse and search/filter upcoming events (by mode, keyword)
- View full event details with a live countdown to the start time
- Book a seat with server-side validated attendee details
- Receive a human-friendly booking ID (e.g. `EVT-2026-A7F92K`) and a
  confirmation email
- Add the event to Google Calendar or download a `.ics` file
- Join online events via a generated Jitsi meeting link, or get venue/map
  details for offline events
- Look up, cancel, or reschedule bookings using email + booking ID
- Scan a QR code (or visit `/booking/verify/:bookingId`) to verify a booking

**For organizers (any registered user)**
- Register/log in with a normal account (bcrypt-hashed password, rate-limited
  login and registration) — completely separate from admin auth
- Create, edit, cancel, and delete their **own** events from `/my-events`
- Ownership is enforced server-side: one user can never edit, cancel, or
  delete another user's event, even by guessing the event ID
- Event-cancellation emails still go out automatically to attendees

**For admins**
- Secure session-based login (bcrypt-hashed password, rate-limited login)
- Full control over **every** event on the platform (not just their own),
  create/edit/cancel/delete
- Dashboard with live stats (bookings, seats, attendance)
- Search, filter, and paginate all bookings
- Export all bookings to CSV
- Automatic event-cancellation emails to all affected attendees
- Automatic 24h / 1h reminder emails via a background scheduler

**Platform-wide**
- Light/dark theme toggle (persisted in `localStorage`)
- Centralized error handling with friendly error pages, no leaked stack
  traces in production
- Helmet security headers, rate limiting, CSRF-conscious session cookies
- Atomic seat reservation to prevent overbooking under concurrent requests

## Architecture

```
config/         MongoDB connection setup
models/         Mongoose schemas: Event, Booking, Admin, User
controllers/    Route handler logic, grouped by resource
routes/         Express routers, grouped by resource
middleware/     Auth guards (admin + user), centralized error handler, validation rules
services/       Email, calendar (.ics/Google), QR code, reminder scheduler
utils/          Small stateless helpers (booking ID generator, status calc)
views/          EJS templates, grouped by feature area
public/         Static CSS/JS (theme toggle, countdown, form helpers)
tests/          Jest unit + integration tests
```

Events and bookings are separate collections (`Event` / `Booking`) linked by
`eventId`, rather than treating every booking as its own standalone event, so
an event's capacity and attendee list are properly modeled.

There are two independent auth systems, each with its own session key so
neither can grant access to the other:
- **Admin** (`Admin` model, `req.session.adminId`) — one seeded account,
  full control over all events and bookings, at `/admin/*`.
- **User** (`User` model, `req.session.userId`) — anyone can register at
  `/register`, and can create/manage only the events they created, at
  `/my-events/*`. Ownership is enforced with a `createdBy` field on `Event`
  and a query filter (`Event.findOne({ _id, createdBy: req.session.userId })`)
  on every edit/cancel/delete, not just a UI-level check.

## Tech Stack

Node.js, Express, EJS, MongoDB (Mongoose), express-session (+ connect-mongo),
Nodemailer, node-cron, QRCode, Helmet, express-validator, express-rate-limit,
bcryptjs.

## Installation

```bash
git clone <your-repo-url>
cd EVENT_BOOKING
npm install
cp .env.example .env
# edit .env with your own values (see below)
npm start
```

The app runs on `http://localhost:3000` by default.

## Environment Variables

Copy `.env.example` to `.env` and fill in real values. **Never commit `.env`.**

| Variable         | Description                                                             |
|------------------|--------------------------------------------------------------------------|
| `MONGO_URI`      | MongoDB connection string                                                |
| `EMAIL_USER`     | Gmail address used to send notifications                                 |
| `EMAIL_PASS`     | Gmail **App Password** (not your regular password)                       |
| `SESSION_SECRET` | Long random string used to sign session cookies                          |
| `ADMIN_EMAIL`    | Seed admin login email (account is created automatically on first boot)  |
| `ADMIN_PASSWORD` | Seed admin login password                                                |
| `PORT`           | Port to listen on (default `3000`)                                       |
| `NODE_ENV`       | `development` or `production`                                            |

> ⚠️ **Security note:** the original `.env` in this repository contained a
> real Gmail address/app password and a MongoDB Atlas connection string with
> embedded credentials. Even though `.env` was already git-ignored, treat
> both as compromised since they were shared outside the project: **rotate
> the Gmail app password and the MongoDB Atlas user's password** before
> reusing this project, and use `.env.example` as the template going
> forward.

## MongoDB Setup

Any MongoDB 5+ instance works — local (`mongodb://localhost:27017/event-booking`)
or [Atlas](https://www.mongodb.com/atlas). No manual schema setup is needed;
Mongoose creates collections and indexes automatically on first use.

## Email Setup

1. Enable 2-Step Verification on the Gmail account you'll send from.
2. Generate an [App Password](https://myaccount.google.com/apppasswords).
3. Put the Gmail address in `EMAIL_USER` and the 16-character app password in
   `EMAIL_PASS`.

If these are left unset, the app still works — emails are logged to the
console instead of sent, so local development doesn't require a working
inbox.

## Running Locally

```bash
npm start        # production-style start
npm run dev       # auto-restarts on file changes (Node's built-in --watch)
```

On first boot, the app connects to MongoDB and creates the admin account from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` if it doesn't already exist.

## Testing

```bash
npm test
```

- `tests/utils.test.js` — pure unit tests (booking ID format/uniqueness,
  event status calculation, `.ics`/Google Calendar URL generation). These run
  anywhere, no database required.
- `tests/booking.integration.test.js` — full integration tests (event
  creation, booking creation, duplicate-booking prevention, capacity limits,
  cancellation, invalid-booking rejection, cancelled-event booking
  prevention, booking retrieval, admin authorization, user registration and
  login, and organizer event ownership — including a test that one user
  cannot edit or delete another user's event) using
  `mongodb-memory-server`, which downloads a real MongoDB binary the first
  time it runs. **This requires outbound internet access to
  `fastdl.mongodb.org`** — if that's blocked in your environment (e.g. a
  locked-down CI sandbox), point `MONGO_URI` at a real local MongoDB instance
  instead and adapt the test setup to skip spinning up the in-memory server.

## Deployment

The app is written to be deployment-ready out of the box:

- `PORT`, `MONGO_URI`, `EMAIL_*`, `SESSION_SECRET`, `ADMIN_*` are all read
  from environment variables — nothing is hardcoded.
- `NODE_ENV=production` disables verbose error output and enables secure
  (`https`-only) session cookies.
- Static assets are served from `public/` via Express, no separate build
  step needed.
- Graceful shutdown is wired up for `SIGINT`/`SIGTERM`.

Compatible with [Render](https://render.com) (or any Node host): set the
build command to `npm install`, the start command to `npm start`, and add
the environment variables from the table above in the dashboard.

## Security

- Passwords are hashed with bcrypt (12 rounds); nothing is ever stored or
  logged in plaintext.
- Sessions use `httpOnly`, `sameSite=lax` cookies, `secure` in production,
  and are persisted in MongoDB via `connect-mongo`.
- Helmet sets standard security headers (CSP, etc.).
- `express-rate-limit` protects the admin login endpoint (10 attempts / 15
  min) and the app as a whole (300 requests / 15 min per IP).
- All input is validated server-side with `express-validator`; client-side
  validation (HTML5 `required`, `type="email"`, etc.) is a UX nicety only.
- Seat reservation uses an atomic `findOneAndUpdate` with an
  `availableSeats > 0` guard to avoid race conditions under concurrent
  bookings, rather than a read-then-write check.
- Error responses never leak stack traces in production.

## API / Routes

**Public**
```
GET  /                              Home page with upcoming events
GET  /events                        Browse/search/filter events
GET  /events/:id                    Event details
GET  /events/:id/book               Booking form
POST /events/:id/book               Create booking
GET  /booking/confirmation/:id      Confirmation page
GET  /booking/:id/calendar.ics      Download .ics file
GET  /booking/verify/:id            Public booking verification
GET  /my-bookings                   Lookup form
POST /my-bookings                   Lookup by email
POST /bookings/:id/cancel           Cancel a booking
GET  /bookings/:id/reschedule       Reschedule form
POST /bookings/:id/reschedule       Reschedule a booking
GET  /register                      Registration form
POST /register                      Create an account
GET  /login                         Login form
POST /login                         Log in
POST /logout                        Log out
```

**Organizer (any logged-in user)** — all require login, redirect to `/login` otherwise
```
GET  /my-events                     List events you created
GET  /my-events/new                 New event form
POST /my-events/new                 Create an event (organizer = your account)
GET  /my-events/:id/edit            Edit form (only if you own the event)
POST /my-events/:id/edit            Update your event
POST /my-events/:id/cancel          Cancel your event (notifies attendees)
POST /my-events/:id/delete          Delete your event (only if no active bookings)
```

**Admin** (all require login except `/admin/login`)
```
GET  /admin/login
POST /admin/login
POST /admin/logout
GET  /admin                         Dashboard
GET  /admin/events                  List events
GET  /admin/events/new              New event form
POST /admin/events                  Create event
GET  /admin/events/:id/edit         Edit event form
POST /admin/events/:id/edit         Update event
POST /admin/events/:id/cancel       Cancel event (notifies attendees)
POST /admin/events/:id/delete       Delete event (only if no active bookings)
GET  /admin/bookings                Search/filter/paginate bookings
GET  /admin/bookings/export         CSV export
```

## Database Models / Schema

**Event** — title, description, organizer, date, startTime, endTime,
timezone, mode (`online`/`offline`), location, meetingLink, capacity,
availableSeats, status (`upcoming`/`ongoing`/`completed`/`cancelled`),
timestamps. Indexed on `date + status` and full-text on `title/description`.

**Booking** — bookingId (unique, human-friendly), eventId (ref `Event`),
attendeeName, attendeeEmail, bookingDate, status
(`confirmed`/`cancelled`/`attended`), remindersSent, rescheduledFrom (ref
`Booking`), timestamps. Indexed on `bookingId`, `attendeeEmail`, `eventId`.

**Admin** — email (unique), passwordHash, timestamps.

**User** — name, email (unique), passwordHash, timestamps. Referenced by
`Event.createdBy` for events created through the self-serve `/my-events` flow
(admin-created events leave `createdBy` as `null`).

## Future Improvements

1. **Attendance check-in flow** — turn `/booking/verify/:id` into a one-tap
   "mark attended" action for admins at the door, updating booking status to
   `attended` in real time.
2. **Waitlists** — when an event is full, let attendees join a waitlist and
   auto-notify the next person if a cancellation frees up a seat.
3. **Recurring events** — support a series of dates for the same event
   (e.g. a weekly meetup) instead of one-off events only.

## Limitations

- Reminder emails rely on a `node-cron` job running inside the same Node
  process; on platforms that spin down idle instances (e.g. free-tier
  Render), reminders may be delayed until the next request wakes the app.
- Rescheduling moves a booking to a different *event* (not a different time
  slot of the same event), since each event currently has a single
  date/time.
- The integration test suite needs outbound access to download a MongoDB
  binary the first time it runs (see Testing section above).
