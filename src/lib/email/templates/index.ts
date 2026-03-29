/**
 * Email Template Renderer
 * Simple template system using HTML strings with variable interpolation.
 */

type TemplateData = Record<string, unknown>;

const templates: Record<string, (data: TemplateData) => string> = {
  "fee-reminder": (data) => baseLayout(`
    <h2>Fee Payment Reminder</h2>
    <p>Dear ${data.guardianName},</p>
    <p>This is a reminder that <strong>${data.studentName}</strong> has an outstanding balance of
    <strong>GH₵ ${data.amount}</strong> for <strong>${data.termName}</strong>.</p>
    <p>Please make payment at your earliest convenience to avoid any disruption.</p>
    <p>Thank you,<br/>${data.schoolName}</p>
  `),

  "result-published": (data) => baseLayout(`
    <h2>Term Results Published</h2>
    <p>Dear ${data.guardianName},</p>
    <p>The results for <strong>${data.termName}</strong> have been published for <strong>${data.studentName}</strong>.</p>
    <p>You can log in to the parent portal to view the full report card.</p>
    <p>Thank you,<br/>${data.schoolName}</p>
  `),

  "admission-update": (data) => baseLayout(`
    <h2>Admission Application Update</h2>
    <p>Dear ${data.applicantName},</p>
    <p>Your application (Reference: <strong>${data.applicationRef}</strong>) status has been updated to:
    <strong>${data.status}</strong>.</p>
    ${data.message ? `<p>${data.message}</p>` : ""}
    <p>Thank you,<br/>${data.schoolName}</p>
  `),

  "exeat-alert": (data) => baseLayout(`
    <h2>Exeat ${data.action}</h2>
    <p>Dear ${data.guardianName},</p>
    <p><strong>${data.studentName}</strong>'s exeat request has been <strong>${data.status}</strong>.</p>
    <p><strong>Type:</strong> ${data.exeatType}<br/>
    <strong>Dates:</strong> ${data.startDate} — ${data.endDate}<br/>
    <strong>Destination:</strong> ${data.destination}</p>
    <p>Thank you,<br/>${data.schoolName}</p>
  `),

  "absentee-alert": (data) => baseLayout(`
    <h2>Absence Notification</h2>
    <p>Dear ${data.guardianName},</p>
    <p><strong>${data.studentName}</strong> was marked <strong>absent</strong> on <strong>${data.date}</strong>.</p>
    ${data.notes ? `<p>Notes: ${data.notes}</p>` : ""}
    <p>Please contact the school if you have any questions.</p>
    <p>Thank you,<br/>${data.schoolName}</p>
  `),

  "leave-status": (data) => baseLayout(`
    <h2>Leave Request ${data.status}</h2>
    <p>Dear ${data.staffName},</p>
    <p>Your leave request for <strong>${data.leaveType}</strong> (${data.startDate} — ${data.endDate})
    has been <strong>${data.status}</strong>.</p>
    ${data.remarks ? `<p>Remarks: ${data.remarks}</p>` : ""}
    <p>Thank you,<br/>${data.schoolName}</p>
  `),
};

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
    h2 { color: #1a56db; border-bottom: 2px solid #1a56db; padding-bottom: 8px; }
    strong { color: #111; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
}

export function renderTemplate(templateName: string, data: TemplateData): string {
  const template = templates[templateName];
  if (!template) {
    throw new Error(`Email template "${templateName}" not found`);
  }
  return template(data);
}
