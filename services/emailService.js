const nodemailer = require("nodemailer");
const { generateGoogleCalendarUrl } = require("./calendarService");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(
      "EMAIL_USER / EMAIL_PASS not set - emails will be logged instead of sent."
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  return transporter;
}

async function sendMail({ to, subject, html }) {
  const t = getTransporter();

  if (!t) {
    console.log(`[email skipped - no credentials] To: ${to} | Subject: ${subject}`);
    return { skipped: true };
  }

  try {
    return await t.sendMail({
      from: `"Event Booking Platform" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err.message);
    // Email failure should never break the booking flow itself.
    return { error: err.message };
  }
}

function baseLayout(title, bodyHtml) {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background: #f7f7fb; padding: 24px;">
    <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
      <h2 style="color: #4f46e5; margin-top: 0;">${title}</h2>
      ${bodyHtml}
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="font-size: 12px; color: #888;">Event Booking Platform &mdash; this is an automated message.</p>
    </div>
  </div>`;
}

function formatEventDetailsHtml(event, booking) {
  const dateStr = new Date(event.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const locationLine =
    event.mode === "online"
      ? `<p><strong>Join link:</strong> <a href="${event.meetingLink}">${event.meetingLink}</a></p>`
      : `<p><strong>Location:</strong> ${event.location}</p>`;

  const calendarUrl = generateGoogleCalendarUrl(event);

  return `
    <p>Hi ${booking.attendeeName},</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 4px 0; color: #555;">Event</td><td style="padding: 4px 0;"><strong>${event.title}</strong></td></tr>
      <tr><td style="padding: 4px 0; color: #555;">Date</td><td style="padding: 4px 0;">${dateStr}</td></tr>
      <tr><td style="padding: 4px 0; color: #555;">Time</td><td style="padding: 4px 0;">${event.startTime} - ${event.endTime} (${event.timezone})</td></tr>
      <tr><td style="padding: 4px 0; color: #555;">Mode</td><td style="padding: 4px 0;">${event.mode}</td></tr>
      <tr><td style="padding: 4px 0; color: #555;">Booking ID</td><td style="padding: 4px 0;"><strong>${booking.bookingId}</strong></td></tr>
    </table>
    ${locationLine}
    <p><a href="${calendarUrl}" style="color:#4f46e5;">Add to Google Calendar</a></p>
  `;
}

async function sendBookingConfirmation(event, booking) {
  const html = baseLayout(
    "Booking Confirmed 🎉",
    formatEventDetailsHtml(event, booking) +
      `<p>You can retrieve or cancel this booking anytime using your booking ID and email on the "My Bookings" page.</p>`
  );

  return sendMail({
    to: booking.attendeeEmail,
    subject: `Booking Confirmed - ${event.title} (${booking.bookingId})`,
    html,
  });
}

async function sendCancellationEmail(event, booking) {
  const html = baseLayout(
    "Booking Cancelled",
    `<p>Hi ${booking.attendeeName},</p>
     <p>Your booking <strong>${booking.bookingId}</strong> for <strong>${event.title}</strong> has been cancelled as requested.</p>
     <p>If this wasn't you, please contact the organizer.</p>`
  );

  return sendMail({
    to: booking.attendeeEmail,
    subject: `Booking Cancelled - ${event.title}`,
    html,
  });
}

async function sendRescheduleEmail(event, booking) {
  const html = baseLayout(
    "Booking Rescheduled",
    formatEventDetailsHtml(event, booking) +
      `<p>Your booking has been moved to the details above. Your new booking ID is <strong>${booking.bookingId}</strong>.</p>`
  );

  return sendMail({
    to: booking.attendeeEmail,
    subject: `Booking Rescheduled - ${event.title}`,
    html,
  });
}

async function sendEventCancellationEmail(event, booking) {
  const html = baseLayout(
    "Event Cancelled",
    `<p>Hi ${booking.attendeeName},</p>
     <p>We're sorry to inform you that <strong>${event.title}</strong> scheduled on
     ${new Date(event.date).toLocaleDateString()} has been cancelled by the organizer.</p>
     <p>Your booking (${booking.bookingId}) has been cancelled automatically and no further action is required.</p>`
  );

  return sendMail({
    to: booking.attendeeEmail,
    subject: `Event Cancelled - ${event.title}`,
    html,
  });
}

async function sendEventReminderEmail(event, booking, hoursBefore) {
  const html = baseLayout(
    `Reminder: ${event.title} starts soon`,
    formatEventDetailsHtml(event, booking) +
      `<p>This is a reminder that your event starts in about ${hoursBefore} hour(s).</p>`
  );

  return sendMail({
    to: booking.attendeeEmail,
    subject: `Reminder - ${event.title} starts in ${hoursBefore}h`,
    html,
  });
}

module.exports = {
  sendBookingConfirmation,
  sendCancellationEmail,
  sendRescheduleEmail,
  sendEventCancellationEmail,
  sendEventReminderEmail,
};
