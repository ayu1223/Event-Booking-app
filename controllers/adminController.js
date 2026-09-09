const Admin = require("../models/Admin");
const Booking = require("../models/Booking");
const Event = require("../models/Event");
const { AppError } = require("../middleware/errorHandler");

function renderLogin(req, res) {
  res.render("admin/login", { errorMessage: null });
}

async function login(req, res) {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email: String(email).toLowerCase() });

  const invalidCreds = () =>
    res.status(401).render("admin/login", {
      errorMessage: "Invalid email or password.",
    });

  if (!admin) return invalidCreds();

  const valid = await admin.verifyPassword(password);
  if (!valid) return invalidCreds();

  req.session.regenerate((err) => {
    if (err) return res.status(500).render("admin/login", {
      errorMessage: "Something went wrong. Please try again.",
    });

    req.session.adminId = admin._id.toString();
    const returnTo = req.session.returnTo || "/admin";
    delete req.session.returnTo;
    res.redirect(returnTo);
  });
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
}

async function listBookings(req, res) {
  const { search, status, eventId, mode, page = 1 } = req.query;
  const PAGE_SIZE = 15;
  const filter = {};

  if (status && ["confirmed", "cancelled", "attended"].includes(status)) {
    filter.status = status;
  }
  if (eventId) {
    filter.eventId = eventId;
  }
  if (search) {
    const regex = new RegExp(search.trim(), "i");
    filter.$or = [
      { bookingId: regex },
      { attendeeName: regex },
      { attendeeEmail: regex },
    ];
  }

  let eventIdsForMode = null;
  if (mode && ["online", "offline"].includes(mode)) {
    const events = await Event.find({ mode }).select("_id");
    eventIdsForMode = events.map((e) => e._id);
    filter.eventId = filter.eventId
      ? filter.eventId
      : { $in: eventIdsForMode };
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);

  const [bookings, total, events] = await Promise.all([
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE),
    Booking.countDocuments(filter),
    Event.find().select("title date"),
  ]);

  const eventMap = new Map(events.map((e) => [String(e._id), e]));
  const bookingsWithEvents = bookings.map((b) => ({
    booking: b,
    event: eventMap.get(String(b.eventId)),
  }));

  res.render("admin/bookings", {
    bookingsWithEvents,
    events,
    search: search || "",
    status: status || "",
    eventId: eventId || "",
    mode: mode || "",
    currentPage,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}

async function exportBookingsCSV(req, res) {
  const bookings = await Booking.find().sort({ createdAt: -1 });
  const eventIds = bookings.map((b) => b.eventId);
  const events = await Event.find({ _id: { $in: eventIds } });
  const eventMap = new Map(events.map((e) => [String(e._id), e]));

  const header = [
    "Booking ID",
    "Attendee Name",
    "Attendee Email",
    "Event",
    "Event Date",
    "Event Time",
    "Mode",
    "Booking Status",
    "Created Date",
  ];

  const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

  const rows = bookings.map((b) => {
    const event = eventMap.get(String(b.eventId));
    return [
      b.bookingId,
      b.attendeeName,
      b.attendeeEmail,
      event ? event.title : "Unknown",
      event ? new Date(event.date).toISOString().split("T")[0] : "",
      event ? `${event.startTime}-${event.endTime}` : "",
      event ? event.mode : "",
      b.status,
      b.createdAt.toISOString(),
    ]
      .map(escapeCsv)
      .join(",");
  });

  const csv = [header.map(escapeCsv).join(","), ...rows].join("\r\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="bookings-export.csv"`);
  res.send(csv);
}

module.exports = {
  renderLogin,
  login,
  logout,
  listBookings,
  exportBookingsCSV,
};
