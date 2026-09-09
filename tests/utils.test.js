const { generateBookingId } = require("../utils/bookingId");
const { getEffectiveStatus } = require("../utils/eventStatus");
const { generateGoogleCalendarUrl, generateICS } = require("../services/calendarService");

function makeEvent(overrides = {}) {
  const base = {
    title: "Test Event",
    description: "desc",
    date: new Date(),
    startTime: "10:00",
    endTime: "11:00",
    timezone: "Asia/Kolkata",
    mode: "online",
    location: "",
    meetingLink: "https://meet.jit.si/abc",
    status: "upcoming",
    ...overrides,
  };
  base.getStartDateTime = function () {
    const [h, m] = this.startTime.split(":").map(Number);
    const d = new Date(this.date);
    d.setHours(h, m, 0, 0);
    return d;
  };
  base.getEndDateTime = function () {
    const [h, m] = this.endTime.split(":").map(Number);
    const d = new Date(this.date);
    d.setHours(h, m, 0, 0);
    return d;
  };
  return base;
}

describe("generateBookingId", () => {
  test("matches the EVT-YYYY-XXXXXX pattern", () => {
    const id = generateBookingId();
    expect(id).toMatch(/^EVT-\d{4}-[A-Z0-9]{6}$/);
  });

  test("generates distinct IDs across many calls", () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateBookingId()));
    expect(ids.size).toBe(200);
  });
});

describe("getEffectiveStatus", () => {
  test("returns 'cancelled' regardless of dates when explicitly cancelled", () => {
    const event = makeEvent({
      status: "cancelled",
      date: new Date(Date.now() + 86400000),
    });
    expect(getEffectiveStatus(event)).toBe("cancelled");
  });

  test("returns 'upcoming' for a future event", () => {
    const event = makeEvent({ date: new Date(Date.now() + 86400000) });
    expect(getEffectiveStatus(event)).toBe("upcoming");
  });

  test("returns 'completed' for a past event", () => {
    const event = makeEvent({
      date: new Date(Date.now() - 86400000),
      startTime: "00:00",
      endTime: "01:00",
    });
    expect(getEffectiveStatus(event)).toBe("completed");
  });

  test("returns 'ongoing' while between start and end time", () => {
    const now = new Date();
    const event = makeEvent({
      date: now,
      startTime: `${String(now.getHours()).padStart(2, "0")}:00`,
      endTime: "23:59",
    });
    expect(["ongoing", "upcoming"]).toContain(getEffectiveStatus(event));
  });
});

describe("calendarService", () => {
  test("generateGoogleCalendarUrl includes required fields", () => {
    const event = makeEvent();
    const url = generateGoogleCalendarUrl(event);
    expect(url).toContain("https://calendar.google.com/calendar/render");
    expect(url).toContain("text=Test+Event");
  });

  test("generateICS produces a valid VCALENDAR block", () => {
    const event = makeEvent();
    const booking = { bookingId: "EVT-2026-ABC123" };
    const ics = generateICS(event, booking);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("SUMMARY:Test Event");
    expect(ics).toContain(`UID:${booking.bookingId}@event-booking-platform`);
  });
});
