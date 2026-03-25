/**
 * Calendar integration utilities
 * Generates .ics files and external calendar links for sessions
 */

export interface SessionEvent {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  meetingLink?: string;
  isVirtual?: boolean;
  organName?: string;
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeICS(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

/**
 * Generate .ics file content for a session
 */
export function generateICS(event: SessionEvent): string {
  const start = formatICSDate(event.startDate);
  const end = formatICSDate(event.endDate ?? new Date(event.startDate.getTime() + 2 * 60 * 60 * 1000));
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@grigraboard`;

  let description = event.description ?? "";
  if (event.organName) description = `Organe: ${event.organName}\\n${description}`;
  if (event.meetingLink) description += `\\nLien de réunion: ${event.meetingLink}`;

  const location = event.isVirtual && event.meetingLink
    ? event.meetingLink
    : event.location ?? "";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GrigraBoard//Session//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location)}`,
    "STATUS:CONFIRMED",
    `DTSTAMP:${formatICSDate(new Date())}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Download .ics file
 */
export function downloadICS(event: SessionEvent): void {
  const ics = generateICS(event);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Z0-9À-ÿ ]/g, "").trim().replace(/\s+/g, "_")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate Google Calendar link
 */
export function getGoogleCalendarLink(event: SessionEvent): string {
  const start = formatICSDate(event.startDate);
  const end = formatICSDate(event.endDate ?? new Date(event.startDate.getTime() + 2 * 60 * 60 * 1000));

  let details = event.description ?? "";
  if (event.organName) details = `Organe: ${event.organName}\n${details}`;
  if (event.meetingLink) details += `\nLien: ${event.meetingLink}`;

  const location = event.isVirtual && event.meetingLink ? event.meetingLink : event.location ?? "";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details,
    location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate Outlook Web link
 */
export function getOutlookLink(event: SessionEvent): string {
  const start = event.startDate.toISOString();
  const end = (event.endDate ?? new Date(event.startDate.getTime() + 2 * 60 * 60 * 1000)).toISOString();

  let body = event.description ?? "";
  if (event.organName) body = `Organe: ${event.organName}\n${body}`;
  if (event.meetingLink) body += `\nLien: ${event.meetingLink}`;

  const location = event.isVirtual && event.meetingLink ? event.meetingLink : event.location ?? "";

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: start,
    enddt: end,
    body,
    location,
  });

  return `https://outlook.office.com/calendar/0/action/compose?${params.toString()}`;
}

/**
 * Generate Microsoft Teams meeting link (deep link)
 */
export function getTeamsLink(event: SessionEvent): string {
  const start = event.startDate.toISOString();
  const end = (event.endDate ?? new Date(event.startDate.getTime() + 2 * 60 * 60 * 1000)).toISOString();

  let content = event.description ?? "";
  if (event.organName) content = `Organe: ${event.organName} - ${content}`;

  const params = new URLSearchParams({
    subject: event.title,
    startTime: start,
    endTime: end,
    content,
  });

  return `https://teams.microsoft.com/l/meeting/new?${params.toString()}`;
}

/**
 * Open Google Drive
 */
export function getGoogleDriveLink(): string {
  return "https://drive.google.com/";
}

/**
 * Open OneDrive
 */
export function getOneDriveLink(): string {
  return "https://onedrive.live.com/";
}
