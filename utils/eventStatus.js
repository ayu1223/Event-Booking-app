// Computes the *effective* status of an event for display purposes.
// The stored `status` field is only ever "cancelled" (set explicitly by an
// admin) or left as "upcoming"; whether an event is upcoming/ongoing/completed
// is derived live from the clock so we don't need a background job just to
// flip statuses.
function getEffectiveStatus(event) {
  if (event.status === "cancelled") return "cancelled";

  const now = Date.now();
  const start = event.getStartDateTime().getTime();
  const end = event.getEndDateTime().getTime();

  if (now < start) return "upcoming";
  if (now >= start && now < end) return "ongoing";
  return "completed";
}

module.exports = { getEffectiveStatus };
