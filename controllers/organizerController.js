const Event = require("../models/Event");
const Booking = require("../models/Booking");
const { AppError } = require("../middleware/errorHandler");
const { getEffectiveStatus } = require("../utils/eventStatus");

async function renderMyEvents(req, res) {
  const events = await Event.find({ createdBy: req.session.userId }).sort({ date: -1 });
  res.render("organizer/my-events", { events, getEffectiveStatus });
}

function renderNewEventForm(req, res) {
  res.render("organizer/event-form", { event: null, errorMessage: null });
}

async function createEvent(req, res) {
  const { title, description, date, startTime, endTime, timezone, mode, location, capacity } =
    req.body;

  const capacityNum = parseInt(capacity, 10);

  const event = new Event({
    title,
    description,
    organizer: req.session.userName,
    createdBy: req.session.userId,
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
  res.redirect("/my-events");
}

async function findOwnedEvent(req, next) {
  const event = await Event.findOne({ _id: req.params.id, createdBy: req.session.userId });
  if (!event) {
    next(new AppError("Event not found or you don't have permission to manage it.", 404));
    return null;
  }
  return event;
}

async function renderEditEventForm(req, res, next) {
  const event = await findOwnedEvent(req, next);
  if (!event) return;
  res.render("organizer/event-form", { event, errorMessage: null });
}

async function updateEvent(req, res, next) {
  const event = await findOwnedEvent(req, next);
  if (!event) return;

  const { title, description, date, startTime, endTime, timezone, mode, location, capacity } =
    req.body;

  const newCapacity = parseInt(capacity, 10);
  const seatsBooked = event.capacity - event.availableSeats;

  if (newCapacity < seatsBooked) {
    return res.status(400).render("organizer/event-form", {
      event,
      errorMessage: `Capacity cannot be lower than the number of seats already booked (${seatsBooked}).`,
    });
  }

  event.title = title;
  event.description = description;
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
  res.redirect("/my-events");
}

async function cancelEvent(req, res, next) {
  const event = await findOwnedEvent(req, next);
  if (!event) return;

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

  res.redirect("/my-events");
}

async function deleteEvent(req, res, next) {
  const event = await findOwnedEvent(req, next);
  if (!event) return;

  const activeBookings = await Booking.countDocuments({
    eventId: event._id,
    status: "confirmed",
  });

  if (activeBookings > 0) {
    return next(
      new AppError("Cannot delete an event with active bookings. Cancel it instead.", 409)
    );
  }

  await Booking.deleteMany({ eventId: event._id });
  await event.deleteOne();
  res.redirect("/my-events");
}

module.exports = {
  renderMyEvents,
  renderNewEventForm,
  createEvent,
  renderEditEventForm,
  updateEvent,
  cancelEvent,
  deleteEvent,
};
