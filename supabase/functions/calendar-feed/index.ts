import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface TreeNode {
  text: string;
  children: TreeNode[];
  deadline?: string;
  deadlineTime?: string;
  deadlineDuration?: number;
  priority?: string;
  checked?: boolean;
}

/** Simple hash to generate deterministic UIDs for calendar events. */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/** Escape special characters in iCalendar text fields. */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Format a Date as an iCalendar DTSTART/DTEND value (UTC). */
function formatDateTimeUTC(dateStr: string, timeStr: string): string {
  // dateStr: "2026-03-15", timeStr: "14:30"
  const [year, month, day] = dateStr.split("-");
  const [hour, minute] = timeStr.split(":");
  return `${year}${month}${day}T${hour}${minute}00`;
}

/** Recursively collect all nodes with a deadline. */
function collectDeadlines(nodes: TreeNode[], results: TreeNode[] = []): TreeNode[] {
  for (const node of nodes) {
    if (node.deadline) {
      results.push(node);
    }
    if (node.children && node.children.length > 0) {
      collectDeadlines(node.children, results);
    }
  }
  return results;
}

/** Generate a VEVENT block for a single node. */
function generateVEvent(node: TreeNode): string {
  const uid = `treenote-${simpleHash(node.text + node.deadline)}@treenote.app`;
  const summary = icsEscape(node.text);
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  let description = "Created by Treenote";
  if (node.priority) {
    description += `\\nPriority: ${node.priority}`;
  }

  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${icsEscape(description)}`,
  ];

  if (node.deadlineTime && node.deadlineDuration) {
    // Timed event with duration
    const dtstart = formatDateTimeUTC(node.deadline!, node.deadlineTime);
    // Calculate end time
    const [hour, minute] = node.deadlineTime.split(":").map(Number);
    const totalMinutes = hour * 60 + minute + node.deadlineDuration;
    const endHour = Math.floor(totalMinutes / 60) % 24;
    const endMinute = totalMinutes % 60;
    const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
    const dtend = formatDateTimeUTC(node.deadline!, endTime);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
  } else if (node.deadlineTime) {
    // Timed event, default 1 hour duration
    const dtstart = formatDateTimeUTC(node.deadline!, node.deadlineTime);
    const [hour, minute] = node.deadlineTime.split(":").map(Number);
    const totalMinutes = hour * 60 + minute + 60;
    const endHour = Math.floor(totalMinutes / 60) % 24;
    const endMinute = totalMinutes % 60;
    const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
    const dtend = formatDateTimeUTC(node.deadline!, endTime);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
  } else {
    // All-day event
    const [year, month, day] = node.deadline!.split("-");
    const dateValue = `${year}${month}${day}`;
    // End date is next day for all-day events
    const startDate = new Date(Number(year), Number(month) - 1, Number(day));
    startDate.setDate(startDate.getDate() + 1);
    const nextDay = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, "0")}${String(startDate.getDate()).padStart(2, "0")}`;
    lines.push(`DTSTART;VALUE=DATE:${dateValue}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay}`);
  }

  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

/** Generate a complete .ics calendar file. */
function generateICS(events: TreeNode[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Treenote//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Treenote Deadlines",
  ];

  for (const event of events) {
    lines.push(generateVEvent(event));
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Missing token parameter", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Look up the token to find the user
  const { data: feed, error: feedError } = await supabase
    .from("calendar_feeds")
    .select("user_id")
    .eq("token", token)
    .single();

  if (feedError || !feed) {
    return new Response("Not found", { status: 404 });
  }

  // Fetch the user's tree data
  const { data: treeRow, error: treeError } = await supabase
    .from("user_trees")
    .select("tree_data")
    .eq("user_id", feed.user_id)
    .single();

  if (treeError || !treeRow) {
    // User has no tree data — return empty calendar
    return new Response(generateICS([]), {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  const treeData = treeRow.tree_data as TreeNode[];
  const deadlines = collectDeadlines(treeData);
  const ics = generateICS(deadlines);

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
});
