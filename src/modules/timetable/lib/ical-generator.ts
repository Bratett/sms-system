/**
 * iCal (.ics) Generator for Timetable Schedules
 *
 * Generates RFC 5545 compliant iCalendar files for timetable slots.
 */

interface TimetableEvent {
  subject: string;
  teacher?: string;
  className?: string;
  room?: string;
  dayOfWeek: number; // 1=Monday, 7=Sunday
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  termStartDate: Date;
  termEndDate: Date;
}

const ICAL_DAYS = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"];

function escapeIcal(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

function formatIcalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function getFirstOccurrence(dayOfWeek: number, termStartDate: Date): Date {
  const start = new Date(termStartDate);
  const targetDay = dayOfWeek === 7 ? 0 : dayOfWeek; // JS: 0=Sun, 1=Mon
  while (start.getDay() !== targetDay) {
    start.setDate(start.getDate() + 1);
  }
  return start;
}

function setTime(date: Date, timeStr: string): Date {
  const result = new Date(date);
  const [hours, minutes] = timeStr.split(":").map(Number);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function generateIcal(params: {
  events: TimetableEvent[];
  calendarName: string;
  description?: string;
}): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SMS//Timetable//EN",
    `X-WR-CALNAME:${escapeIcal(params.calendarName)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  if (params.description) {
    lines.push(`X-WR-CALDESC:${escapeIcal(params.description)}`);
  }

  for (const event of params.events) {
    const firstDate = getFirstOccurrence(event.dayOfWeek, event.termStartDate);
    const dtstart = setTime(firstDate, event.startTime);
    const dtend = setTime(firstDate, event.endTime);
    const until = formatIcalDate(event.termEndDate);
    const rruleDay = ICAL_DAYS[event.dayOfWeek];

    const summary = event.className
      ? `${event.subject} - ${event.className}`
      : event.subject;

    const descParts: string[] = [];
    if (event.teacher) descParts.push(`Teacher: ${event.teacher}`);
    if (event.className) descParts.push(`Class: ${event.className}`);
    if (event.room) descParts.push(`Room: ${event.room}`);

    const uid = `${formatIcalDate(dtstart)}-${event.dayOfWeek}-${event.subject.replace(/\s/g, "")}@sms`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART:${formatIcalDate(dtstart)}`);
    lines.push(`DTEND:${formatIcalDate(dtend)}`);
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${rruleDay};UNTIL=${until}`);
    lines.push(`SUMMARY:${escapeIcal(summary)}`);
    if (descParts.length > 0) {
      lines.push(`DESCRIPTION:${escapeIcal(descParts.join("\\n"))}`);
    }
    if (event.room) {
      lines.push(`LOCATION:${escapeIcal(event.room)}`);
    }
    lines.push(`DTSTAMP:${formatIcalDate(new Date())}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
