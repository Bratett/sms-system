import { auth } from "@/lib/auth";
import { TimetableClient } from "./timetable-client";

export default async function StudentTimetablePage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  return <TimetableClient />;
}
