/**
 * Google Calendar sync — one-way push from treenote to Google Calendar.
 *
 * Uses the Google Calendar REST API directly with fetch().
 * If the provider token is missing or expired, sync is silently skipped.
 */

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/**
 * Get the Google provider token from the current Supabase session.
 * Returns null if not available (non-Google login, expired, etc).
 */
export function getGoogleToken(session) {
  return session?.provider_token || null;
}

/**
 * Create a Google Calendar all-day event for a node with a deadline.
 * Returns the event ID on success, or null on failure.
 */
export async function createCalendarEvent(token, nodeText, deadline) {
  if (!token || !deadline) return null;

  try {
    const res = await fetch(CALENDAR_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: nodeText,
        description: 'Created by Treenote',
        start: { date: deadline },
        end: { date: deadline },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.id || null;
  } catch {
    return null;
  }
}

/**
 * Update an existing Google Calendar event.
 * Returns true on success, false on failure.
 */
export async function updateCalendarEvent(token, eventId, nodeText, deadline) {
  if (!token || !eventId) return false;

  // If deadline was removed, delete the event instead
  if (!deadline) {
    return deleteCalendarEvent(token, eventId);
  }

  try {
    const res = await fetch(`${CALENDAR_API}/${eventId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: nodeText,
        description: 'Created by Treenote',
        start: { date: deadline },
        end: { date: deadline },
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Delete a Google Calendar event.
 * Returns true on success, false on failure.
 */
export async function deleteCalendarEvent(token, eventId) {
  if (!token || !eventId) return false;

  try {
    const res = await fetch(`${CALENDAR_API}/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    // 204 No Content = success, 410 Gone = already deleted
    return res.ok || res.status === 410;
  } catch {
    return false;
  }
}

/**
 * Walk the entire tree and sync all nodes that have calendarSync enabled.
 * This is called during the save flow.
 *
 * For each node with calendarSync: true and a deadline:
 *   - If no calendarEventId → create event, store the ID on the node
 *   - If calendarEventId exists → update event
 *   - If deadline was removed but calendarEventId exists → delete event, clear the ID
 *
 * Mutates the tree in place (adds/updates calendarEventId).
 * Returns true if any node was modified (so the caller can trigger a re-save).
 */
export async function syncTreeToCalendar(tree, token) {
  if (!token || !tree) return false;

  let modified = false;

  async function walkNodes(nodes) {
    for (const node of nodes) {
      if (node.calendarSync) {
        if (node.deadline) {
          if (node.calendarEventId) {
            // Update existing event
            await updateCalendarEvent(token, node.calendarEventId, node.text, node.deadline);
          } else {
            // Create new event
            const eventId = await createCalendarEvent(token, node.text, node.deadline);
            if (eventId) {
              node.calendarEventId = eventId;
              modified = true;
            }
          }
        } else if (node.calendarEventId) {
          // Deadline removed — delete the event
          await deleteCalendarEvent(token, node.calendarEventId);
          delete node.calendarEventId;
          delete node.calendarSync;
          modified = true;
        }
      }

      if (node.children && node.children.length > 0) {
        await walkNodes(node.children);
      }
    }
  }

  await walkNodes(tree);
  return modified;
}
