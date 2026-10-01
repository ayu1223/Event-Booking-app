const Event = require("../models/Event");
const Booking = require("../models/Booking");
const { AppError } = require("../middleware/errorHandler");
const { getEffectiveStatus } = require("../utils/eventStatus");

// ---------- Public ----------

async function renderHome(req, res) {
  const upcomingEvents = await Event.find({
    status: { $ne: "cancelled" },
    date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
  })
    .sort({ date: 1 })
    .limit(6);

  res.render("index", { upcomingEvents, getEffectiveStatus });
}

async function listEvents(req, res) {
  const { search, mode, status, page = 1 } = req.query;
  const PAGE_SIZE = 9;
  const filter = {};

  if (search) {
    filter.$text = { $search: search };
  }
  if (mode && ["online", "offline"].includes(mode)) {
    filter.mode = mode;
  }
  if (status === "cancelled") {
    filter.status = "cancelled";
  } else {
    filter.status = { $ne: "cancelled" };
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);

  const [events, total] = await Promise.all([
    Event.find(filter)
      .sort({ date: 1 })
      .skip((currentPage - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE),
    Event.countDocuments(filter),
  ]);

  res.render("events/list", {
    events,
    getEffectiveStatus,
    search: search || "",
    mode: mode || "",
    status: status || "",
    currentPage,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}

async function showEventDetails(req, res, next) {
  const event = await Event.findById(req.params.id);
  if (!event) return next(new AppError("Event not found", 404));

  res.render("events/details", { event, getEffectiveStatus });
}

// ---------- Admin ----------

async function renderAdminDashboard(req, res) {
  const [totalEvents, upcomingEvents, totalBookings, confirmedBookings, cancelledBookings, events] =
    await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({
        status: { $ne: "cancelled" },
        date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: "confirmed" }),
      Booking.countDocuments({ status: "cancelled" }),
      Event.find(),
    ]);

  const availableSeats = events.reduce((sum, e) => sum + e.availableSeats, 0);
  const attendedCount = await Booking.countDocuments({ status: "attended" });

  res.render("admin/dashboard", {
    stats: {
      totalEvents,
      upcomingEvents,
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      availableSeats,
      attendedCount,
    },
  });
}

async function renderEventList(req, res) {
  const events = await Event.find().sort({ date: -1 });
  res.render("admin/events", { events, getEffectiveStatus });
}

function renderNewEventForm(req, res) {
  res.render("admin/event-form", { event: null, errorMessage: null });
}

async function renderEditEventForm(req, res, next) {
  const event = await Event.findById(req.params.id);
  if (!event) return next(new AppError("Event not found", 404));
  res.render("admin/event-form", { event, errorMessage: null });
}

async function createEvent(req, res) {
  const { title, description, organizer, date, startTime, endTime, timezone, mode, location, capacity } =
    req.body;

  const capacityNum = parseInt(capacity, 10);

  const event = new Event({
    title,
    description,
    organizer,
    date: new Date(date),
    startTime,
    endTime,
    timezone: timezone || "Asia/Kolkata",
    mode,
    location: mode === "offline" ? location : "",
    capacity: capacityNum,
    availableSeats: capacityNum,
  });

  if (mode === "online") {
    const { v4: uuidv4 } = require("uuid");
    event.meetingLink = `https://meet.jit.si/${uuidv4()}`;
  }

  await event.save();
  res.redirect("/admin/events");
}

async function updateEvent(req, res, next) {
  const event = await Event.findById(req.params.id);
  if (!event) return next(new AppError("Event not found", 404));

  const { title, description, organizer, date, startTime, endTime, timezone, mode, location, capacity } =
    req.body;

  const newCapacity = parseInt(capacity, 10);
  const seatsBooked = event.capacity - event.availableSeats;

  if (newCapacity < seatsBooked) {
    return res.status(400).render("admin/event-form", {
      event,
      errorMessage: `Capacity cannot be lower than the number of seats already booked (${seatsBooked}).`,
    });
  }

  event.title = title;
  event.description = description;
  event.organizer = organizer;
  event.date = new Date(date);
  event.startTime = startTime;
  event.endTime = endTime;
  event.timezone = timezone || "Asia/Kolkata";
  event.mode = mode;
  event.location = mode === "offline" ? location : "";
  event.availableSeats = event.availableSeats + (newCapacity - event.capacity);
  event.capacity = newCapacity;

  if (mode === "online" && !event.meetingLink) {
    const { v4: uuidv4 } = require("uuid");
    event.meetingLink = `https://meet.jit.si/${uuidv4()}`;
  }
  if (mode === "offline") {
    event.meetingLink = "";
  }

  await event.save();
  res.redirect("/admin/events");
}

async function cancelEvent(req, res, next) {
  const event = await Event.findById(req.params.id);
  if (!event) return next(new AppError("Event not found", 404));

  event.status = "cancelled";
  await event.save();

  const { sendEventCancellationEmail } = require("../services/emailService");
  const bookings = await Booking.find({ eventId: event._id, status: "confirmed" });

  for (const booking of bookings) {
    booking.status = "cancelled";
    await booking.save();
    sendEventCancellationEmail(event, booking).catch((err) =>
      console.error("Failed to send event-cancellation email:", err.message)
    );
  }

  res.redirect("/admin/events");
}

async function deleteEvent(req, res, next) {
  const event = await Event.findById(req.params.id);
  if (!event) return next(new AppError("Event not found", 404));

  const activeBookings = await Booking.countDocuments({
    eventId: event._id,
    status: "confirmed",
  });

  if (activeBookings > 0) {
    return next(
      new AppError(
        "Cannot delete an event with active bookings. Cancel it instead.",
        409
      )
    );
  }

  await Booking.deleteMany({ eventId: event._id });
  await event.deleteOne();
  res.redirect("/admin/events");
}

module.exports = {
  renderHome,
  listEvents,
  showEventDetails,
  renderAdminDashboard,
  renderEventList,
  renderNewEventForm,
  renderEditEventForm,
  createEvent,
  updateEvent,
  cancelEvent,
  deleteEvent,
};
