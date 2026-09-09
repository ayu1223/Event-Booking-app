const Event = require("../models/Event");
const Booking = require("../models/Booking");
const { AppError } = require("../middleware/errorHandler");
const { generateBookingId } = require("../utils/bookingId");
const { getEffectiveStatus } = require("../utils/eventStatus");
const {
  sendBookingConfirmation,
  sendCancellationEmail,
  sendRescheduleEmail,
} = require("../services/emailService");
const { generateICS, generateGoogleCalendarUrl } = require("../services/calendarService");
const { generateBookingQRCode } = require("../services/qrService");

function assertEventIsBookable(event) {
  if (!event) throw new AppError("Event not found", 404);
  if (event.status === "cancelled") {
    throw new AppError("This event has been cancelled.", 409);
  }
  if (event.hasStarted()) {
    throw new AppError("This event has already started or ended.", 409);
  }
  if (event.isFull()) {
    throw new AppError("This event is fully booked.", 409);
  }
}

async function renderBookingForm(req, res, next) {
  const event = await Event.findById(req.params.id);
  if (!event) return next(new AppError("Event not found", 404));

  try {
    assertEventIsBookable(event);
  } catch (err) {
    return res.status(err.statusCode).render("errors/validation", {
      message: err.message,
    });
  }

  res.render("booking/book", { event, errorMessage: null });
}

async function createBooking(req, res, next) {
  const event = await Event.findById(req.params.id);
  if (!event) return next(new AppError("Event not found", 404));

  const { attendeeName, attendeeEmail } = req.body;

  try {
    assertEventIsBookable(event);

    const existing = await Booking.findOne({
      eventId: event._id,
      attendeeEmail: attendeeEmail.toLowerCase(),
      status: "confirmed",
    });
    if (existing) {
      throw new AppError(
        "You already have a confirmed booking for this event.",
        409
      );
    }

    // Atomically reserve a seat to avoid race conditions between concurrent
    // bookings. Only succeeds if a seat is still available right now.
    const reserved = await Event.findOneAndUpdate(
      { _id: event._id, availableSeats: { $gt: 0 }, status: { $ne: "cancelled" } },
      { $inc: { availableSeats: -1 } },
      { new: true }
    );

    if (!reserved) {
      throw new AppError("This event just sold out. Please try another event.", 409);
    }

    let booking;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        booking = await Booking.create({
          bookingId: generateBookingId(),
          eventId: event._id,
          attendeeName,
          attendeeEmail: attendeeEmail.toLowerCase(),
          status: "confirmed",
        });
        break;
      } catch (err) {
        if (err.code === 11000 && attempt < 4) continue; // bookingId collision, retry
        // Roll back the seat reservation if booking creation ultimately failed.
        await Event.updateOne({ _id: event._id }, { $inc: { availableSeats: 1 } });
        throw err;
      }
    }

    sendBookingConfirmation(reserved, booking).catch((err) =>
      console.error("Failed to send confirmation email:", err.message)
    );

    req.session.recentBooking = booking.bookingId;
    res.redirect(`/booking/confirmation/${booking.bookingId}`);
  } catch (err) {
    if (err.isOperational) {
      return res.status(err.statusCode).render("booking/book", {
        event,
        errorMessage: err.message,
      });
    }
    next(err);
  }
}

async function showConfirmation(req, res, next) {
  const booking = await Booking.findOne({ bookingId: req.params.bookingId });
  if (!booking) return next(new AppError("Booking not found", 404));

  const event = await Event.findById(booking.eventId);
  if (!event) return next(new AppError("Event not found", 404));

  const isOwner = req.session.recentBooking === booking.bookingId;
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const qrCode = await generateBookingQRCode(booking.bookingId, baseUrl);
  const googleCalendarUrl = generateGoogleCalendarUrl(event);

  res.render("booking/confirmation", {
    booking,
    event,
    isOwner,
    qrCode,
    googleCalendarUrl,
    getEffectiveStatus,
  });
}

async function downloadCalendarFile(req, res, next) {
  const booking = await Booking.findOne({ bookingId: req.params.bookingId });
  if (!booking) return next(new AppError("Booking not found", 404));

  const event = await Event.findById(booking.eventId);
  if (!event) return next(new AppError("Event not found", 404));

  const ics = generateICS(event, booking);
  res.setHeader("Content-Type", "text/calendar");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${booking.bookingId}.ics"`
  );
  res.send(ics);
}

function renderMyBookingsForm(req, res) {
  res.render("booking/my-bookings", { bookings: null, email: "", errorMessage: null });
}

async function lookupMyBookings(req, res) {
  const { email } = req.body;
  const bookings = await Booking.find({ attendeeEmail: email.toLowerCase() }).sort({
    createdAt: -1,
  });

  const eventIds = bookings.map((b) => b.eventId);
  const events = await Event.find({ _id: { $in: eventIds } });
  const eventMap = new Map(events.map((e) => [String(e._id), e]));

  const bookingsWithEvents = bookings.map((b) => ({
    booking: b,
    event: eventMap.get(String(b.eventId)),
  }));

  res.render("booking/my-bookings", {
    bookings: bookingsWithEvents,
    email,
    errorMessage: null,
    getEffectiveStatus,
  });
}

async function cancelBooking(req, res, next) {
  const { email } = req.body;
  const booking = await Booking.findOne({ bookingId: req.params.bookingId });

  if (!booking || booking.attendeeEmail !== String(email || "").toLowerCase()) {
    return next(new AppError("Booking not found for that email address.", 404));
  }

  if (booking.status === "cancelled") {
    return next(new AppError("This booking is already cancelled.", 409));
  }

  const event = await Event.findById(booking.eventId);
  if (event && event.hasStarted()) {
    return next(new AppError("Cannot cancel a booking after the event has started.", 409));
  }

  booking.status = "cancelled";
  await booking.save();

  if (event) {
    await Event.updateOne({ _id: event._id }, { $inc: { availableSeats: 1 } });
    sendCancellationEmail(event, booking).catch((err) =>
      console.error("Failed to send cancellation email:", err.message)
    );
  }

  res.redirect(`/my-bookings`);
}

async function renderRescheduleForm(req, res, next) {
  const booking = await Booking.findOne({ bookingId: req.params.bookingId });
  if (!booking) return next(new AppError("Booking not found", 404));

  const currentEvent = await Event.findById(booking.eventId);
  const alternatives = await Event.find({
    _id: { $ne: booking.eventId },
    status: { $ne: "cancelled" },
    availableSeats: { $gt: 0 },
    date: { $gte: new Date() },
  }).sort({ date: 1 });

  res.render("booking/reschedule", {
    booking,
    currentEvent,
    alternatives,
    errorMessage: null,
  });
}

async function rescheduleBooking(req, res, next) {
  const { email, newEventId } = req.body;
  const booking = await Booking.findOne({ bookingId: req.params.bookingId });

  if (!booking || booking.attendeeEmail !== String(email || "").toLowerCase()) {
    return next(new AppError("Booking not found for that email address.", 404));
  }
  if (booking.status !== "confirmed") {
    return next(new AppError("Only confirmed bookings can be rescheduled.", 409));
  }

  const oldEvent = await Event.findById(booking.eventId);
  const newEvent = await Event.findOneAndUpdate(
    { _id: newEventId, availableSeats: { $gt: 0 }, status: { $ne: "cancelled" } },
    { $inc: { availableSeats: -1 } },
    { new: true }
  );

  if (!newEvent) {
    return next(new AppError("The selected event is no longer available.", 409));
  }
  if (newEvent.hasStarted()) {
    await Event.updateOne({ _id: newEvent._id }, { $inc: { availableSeats: 1 } });
    return next(new AppError("The selected event has already started.", 409));
  }

  // Free the seat on the old event and mark the old booking as cancelled.
  if (oldEvent) {
    await Event.updateOne({ _id: oldEvent._id }, { $inc: { availableSeats: 1 } });
  }
  booking.status = "cancelled";
  await booking.save();

  const newBooking = await Booking.create({
    bookingId: generateBookingId(),
    eventId: newEvent._id,
    attendeeName: booking.attendeeName,
    attendeeEmail: booking.attendeeEmail,
    status: "confirmed",
    rescheduledFrom: booking._id,
  });

  sendRescheduleEmail(newEvent, newBooking).catch((err) =>
    console.error("Failed to send reschedule email:", err.message)
  );

  res.redirect(`/booking/confirmation/${newBooking.bookingId}`);
}

async function verifyBooking(req, res) {
  const booking = await Booking.findOne({ bookingId: req.params.bookingId });

  if (!booking) {
    return res.render("booking/verify", { booking: null, event: null });
  }

  const event = await Event.findById(booking.eventId);
  res.render("booking/verify", { booking, event, getEffectiveStatus });
}

module.exports = {
  renderBookingForm,
  createBooking,
  showConfirmation,
  downloadCalendarFile,
  renderMyBookingsForm,
  lookupMyBookings,
  cancelBooking,
  renderRescheduleForm,
  rescheduleBooking,
  verifyBooking,
};
