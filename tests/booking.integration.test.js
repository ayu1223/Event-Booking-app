const mongoose = require("mongoose");
const request = require("supertest");

let MongoMemoryServer;
let mongod;
let app;
let Event;
let Booking;
let Admin;
let User;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-secret";
  process.env.ADMIN_EMAIL = "admin@test.com";
  process.env.ADMIN_PASSWORD = "TestPass123!";

  // mongodb-memory-server downloads a MongoDB binary on first run. In
  // network-restricted environments (e.g. CI sandboxes without access to
  // fastdl.mongodb.org) this suite will fail to start - run it in an
  // environment with normal internet access, or point MONGO_URI at a real
  // local MongoDB instance instead.
  ({ MongoMemoryServer } = require("mongodb-memory-server"));
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri("event-booking-test");

  await mongoose.connect(process.env.MONGO_URI);

  Event = require("../models/Event");
  Booking = require("../models/Booking");
  Admin = require("../models/Admin");
  User = require("../models/User");
  await Admin.ensureSeedAdmin();

  app = require("../server");
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

afterEach(async () => {
  await Booking.deleteMany({});
  await User.deleteMany({});
  await Event.deleteMany({ createdBy: { $ne: null } }); // leave admin-seeded/test-created events from other blocks alone if any
});

async function createTestEvent(overrides = {}) {
  const capacity = overrides.capacity ?? 2;
  return Event.create({
    title: "Test Event",
    description: "A test event",
    organizer: "Tester",
    date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
    startTime: "10:00",
    endTime: "11:00",
    mode: "online",
    meetingLink: "https://meet.jit.si/test",
    capacity,
    availableSeats: capacity,
    ...overrides,
  });
}

describe("Event creation", () => {
  test("creates an event with correct available seats", async () => {
    const event = await createTestEvent({ capacity: 5 });
    expect(event.availableSeats).toBe(5);
    expect(event.status).toBe("upcoming");
  });
});

describe("Booking creation", () => {
  test("successfully books an event and decrements available seats", async () => {
    const event = await createTestEvent({ capacity: 3 });

    const res = await request(app)
      .post(`/events/${event._id}/book`)
      .send({ attendeeName: "Alice", attendeeEmail: "alice@example.com" });

    expect(res.status).toBe(302); // redirect to confirmation
    const updated = await Event.findById(event._id);
    expect(updated.availableSeats).toBe(2);

    const booking = await Booking.findOne({ attendeeEmail: "alice@example.com" });
    expect(booking).not.toBeNull();
    expect(booking.status).toBe("confirmed");
    expect(booking.bookingId).toMatch(/^EVT-\d{4}-[A-Z0-9]{6}$/);
  });

  test("rejects booking with invalid email (server-side validation)", async () => {
    const event = await createTestEvent();
    const res = await request(app)
      .post(`/events/${event._id}/book`)
      .send({ attendeeName: "Bob", attendeeEmail: "not-an-email" });

    expect(res.status).toBe(400);
    const updated = await Event.findById(event._id);
    expect(updated.availableSeats).toBe(event.availableSeats); // untouched
  });

  test("prevents duplicate bookings for the same email on the same event", async () => {
    const event = await createTestEvent({ capacity: 5 });

    await request(app)
      .post(`/events/${event._id}/book`)
      .send({ attendeeName: "Carol", attendeeEmail: "carol@example.com" });

    const res = await request(app)
      .post(`/events/${event._id}/book`)
      .send({ attendeeName: "Carol", attendeeEmail: "carol@example.com" });

    expect(res.status).toBe(409);
    const bookings = await Booking.find({ attendeeEmail: "carol@example.com" });
    expect(bookings.length).toBe(1);
  });

  test("enforces capacity limits (event sells out)", async () => {
    const event = await createTestEvent({ capacity: 1 });

    const first = await request(app)
      .post(`/events/${event._id}/book`)
      .send({ attendeeName: "Dave", attendeeEmail: "dave@example.com" });
    expect(first.status).toBe(302);

    const second = await request(app)
      .post(`/events/${event._id}/book`)
      .send({ attendeeName: "Erin", attendeeEmail: "erin@example.com" });
    expect(second.status).toBe(409);

    const updated = await Event.findById(event._id);
    expect(updated.availableSeats).toBe(0);
  });

  test("prevents booking a cancelled event", async () => {
    const event = await createTestEvent({ status: "cancelled" });
    const res = await request(app)
      .post(`/events/${event._id}/book`)
      .send({ attendeeName: "Frank", attendeeEmail: "frank@example.com" });

    expect(res.status).toBe(409);
  });
});

describe("Booking cancellation", () => {
  test("cancelling a booking frees up a seat", async () => {
    const event = await createTestEvent({ capacity: 2 });
    await request(app)
      .post(`/events/${event._id}/book`)
      .send({ attendeeName: "Grace", attendeeEmail: "grace@example.com" });

    const booking = await Booking.findOne({ attendeeEmail: "grace@example.com" });

    const res = await request(app)
      .post(`/bookings/${booking.bookingId}/cancel`)
      .send({ email: "grace@example.com" });

    expect(res.status).toBe(302);

    const updatedBooking = await Booking.findOne({ bookingId: booking.bookingId });
    expect(updatedBooking.status).toBe("cancelled");

    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent.availableSeats).toBe(2);
  });

  test("rejects cancellation with a mismatched email", async () => {
    const event = await createTestEvent();
    await request(app)
      .post(`/events/${event._id}/book`)
      .send({ attendeeName: "Heidi", attendeeEmail: "heidi@example.com" });
    const booking = await Booking.findOne({ attendeeEmail: "heidi@example.com" });

    const res = await request(app)
      .post(`/bookings/${booking.bookingId}/cancel`)
      .send({ email: "someone-else@example.com" });

    expect(res.status).toBe(404);
    const unchanged = await Booking.findOne({ bookingId: booking.bookingId });
    expect(unchanged.status).toBe("confirmed");
  });
});

describe("Booking retrieval", () => {
  test("retrieves bookings by email via /my-bookings", async () => {
    const event = await createTestEvent();
    await request(app)
      .post(`/events/${event._id}/book`)
      .send({ attendeeName: "Ivan", attendeeEmail: "ivan@example.com" });

    const res = await request(app).post("/my-bookings").send({ email: "ivan@example.com" });
    expect(res.status).toBe(200);
    expect(res.text).toContain("EVT-");
  });

  test("verify endpoint shows booking without requiring authentication", async () => {
    const event = await createTestEvent();
    await request(app)
      .post(`/events/${event._id}/book`)
      .send({ attendeeName: "Judy", attendeeEmail: "judy@example.com" });
    const booking = await Booking.findOne({ attendeeEmail: "judy@example.com" });

    const res = await request(app).get(`/booking/verify/${booking.bookingId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain(booking.bookingId);
  });
});

describe("Admin authorization", () => {
  test("blocks unauthenticated access to admin routes", async () => {
    const res = await request(app).get("/admin/events");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/admin/login");
  });

  test("rejects invalid admin credentials", async () => {
    const res = await request(app)
      .post("/admin/login")
      .send({ email: "admin@test.com", password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  test("allows access after logging in with correct credentials", async () => {
    const agent = request.agent(app);
    const login = await agent
      .post("/admin/login")
      .send({ email: "admin@test.com", password: "TestPass123!" });
    expect(login.status).toBe(302);
    expect(login.headers.location).toBe("/admin");

    const dashboard = await agent.get("/admin");
    expect(dashboard.status).toBe(200);
  });
});

describe("User registration and login", () => {
  test("registers a new user and logs them in automatically", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/register")
      .send({ name: "Priya Organizer", email: "priya@example.com", password: "SecurePass123" });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/my-events");

    const user = await User.findOne({ email: "priya@example.com" });
    expect(user).not.toBeNull();
    expect(user.name).toBe("Priya Organizer");

    const myEvents = await agent.get("/my-events");
    expect(myEvents.status).toBe(200);
  });

  test("rejects registration with a duplicate email", async () => {
    await User.create({
      name: "Existing",
      email: "dupe@example.com",
      passwordHash: await User.hashPassword("whatever123"),
    });

    const res = await request(app)
      .post("/register")
      .send({ name: "New Person", email: "dupe@example.com", password: "AnotherPass123" });

    expect(res.status).toBe(409);
  });

  test("rejects registration with a short password", async () => {
    const res = await request(app)
      .post("/register")
      .send({ name: "Short Pass", email: "shortpass@example.com", password: "abc" });

    expect(res.status).toBe(400);
    const user = await User.findOne({ email: "shortpass@example.com" });
    expect(user).toBeNull();
  });

  test("rejects invalid login credentials", async () => {
    await User.create({
      name: "Real User",
      email: "real@example.com",
      passwordHash: await User.hashPassword("CorrectPass123"),
    });

    const res = await request(app)
      .post("/login")
      .send({ email: "real@example.com", password: "WrongPassword" });

    expect(res.status).toBe(401);
  });

  test("blocks unauthenticated access to /my-events", async () => {
    const res = await request(app).get("/my-events");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });
});

describe("Organizer self-serve event creation and ownership", () => {
  async function registerAndLogin(agent, overrides = {}) {
    await agent.post("/register").send({
      name: "Test Organizer",
      email: "organizer@example.com",
      password: "OrganizerPass123",
      ...overrides,
    });
  }

  test("a logged-in user can create their own event", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent);

    const res = await agent.post("/my-events/new").send({
      title: "Community Meetup",
      description: "A casual meetup",
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString().split("T")[0],
      startTime: "18:00",
      endTime: "20:00",
      mode: "online",
      capacity: "10",
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/my-events");

    const event = await Event.findOne({ title: "Community Meetup" });
    expect(event).not.toBeNull();
    expect(event.organizer).toBe("Test Organizer");
    expect(event.availableSeats).toBe(10);
    expect(event.createdBy).not.toBeNull();
  });

  test("a user cannot edit or delete another user's event", async () => {
    const ownerAgent = request.agent(app);
    await registerAndLogin(ownerAgent, { email: "owner@example.com" });
    await ownerAgent.post("/my-events/new").send({
      title: "Owner's Event",
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString().split("T")[0],
      startTime: "10:00",
      endTime: "11:00",
      mode: "offline",
      location: "Community Hall",
      capacity: "5",
    });
    const event = await Event.findOne({ title: "Owner's Event" });

    const intruderAgent = request.agent(app);
    await registerAndLogin(intruderAgent, { email: "intruder@example.com" });

    const editAttempt = await intruderAgent.get(`/my-events/${event._id}/edit`);
    expect(editAttempt.status).toBe(404);

    const deleteAttempt = await intruderAgent.post(`/my-events/${event._id}/delete`);
    expect(deleteAttempt.status).toBe(404);

    const stillExists = await Event.findById(event._id);
    expect(stillExists).not.toBeNull();
  });

  test("admin routes remain unaffected by the organizer login system", async () => {
    const res = await request(app).get("/admin/events");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/admin/login");
  });
});
