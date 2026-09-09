// Formats a Date as UTC "YYYYMMDDTHHmmssZ" for ICS / Google Calendar URLs.
function toICSDate(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function getLocationOrLink(event) {
  return event.mode === "online" ? event.meetingLink : event.location;
}

/**
 * Builds a valid .ics calendar file (as a string) for a given event/booking.
 */
function generateICS(event, booking) {
  const start = event.getStartDateTime();
  const end = event.getEndDateTime();
  const now = new Date();

  const description = (event.description || "").replace(/\n/g, "\\n");
  const locationOrLink = getLocationOrLink(event);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Event Booking Platform//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.bookingId}@event-booking-platform`,
    `DTSTAMP:${toICSDate(now)}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${locationOrLink}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

/**
 * Builds a Google Calendar "quick add" event URL.
 */
function generateGoogleCalendarUrl(event) {
  const start = event.getStartDateTime();
  const end = event.getEndDateTime();

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toICSDate(start)}/${toICSDate(end)}`,
    details: event.description || "",
    location: getLocationOrLink(event),
    ctz: event.timezone || "UTC",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

module.exports = { generateICS, generateGoogleCalendarUrl };
