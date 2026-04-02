/**
 * Timetable Constraint Solver
 *
 * Uses backtracking with constraint propagation to generate timetables.
 * Replaces the basic greedy algorithm for better slot coverage.
 */

interface Assignment {
  staffId: string;
  subjectId: string;
  classArmId: string;
  subjectName: string;
}

interface Period {
  id: string;
  name: string;
  order: number;
}

interface Room {
  id: string;
  name: string;
  features: string[];
}

interface TeacherAvailabilityEntry {
  teacherId: string;
  dayOfWeek: number;
  periodId: string;
  isAvailable: boolean;
}

interface TeacherPreferenceEntry {
  teacherId: string;
  maxPeriodsPerDay: number | null;
  maxConsecutivePeriods: number | null;
}

export interface SolverConstraints {
  maxConsecutivePeriodsPerTeacher: number;
  subjectFrequencyPerWeek: Record<string, number>;
  teacherAvailability: TeacherAvailabilityEntry[];
  teacherPreferences: TeacherPreferenceEntry[];
}

export interface SlotResult {
  classArmId: string;
  subjectId: string;
  teacherId: string;
  periodId: string;
  roomId: string | null;
  dayOfWeek: number;
}

interface SolverState {
  // Occupied tracking
  teacherSchedule: Map<string, Set<string>>; // teacherId -> Set<"day-periodId">
  roomSchedule: Map<string, Set<string>>; // roomId -> Set<"day-periodId">
  classSchedule: Map<string, Set<string>>; // classArmId -> Set<"day-periodId">
  // Per-day counters
  teacherDayCount: Map<string, Map<number, number>>; // teacherId -> day -> count
  // Subject frequency tracking
  classSubjectCount: Map<string, Map<string, number>>; // classArmId -> subjectId -> count
  // Results
  slots: SlotResult[];
  conflicts: string[];
}

function slotKey(day: number, periodId: string): string {
  return `${day}-${periodId}`;
}

function isTeacherFree(state: SolverState, teacherId: string, day: number, periodId: string): boolean {
  const schedule = state.teacherSchedule.get(teacherId);
  return !schedule || !schedule.has(slotKey(day, periodId));
}

function isClassFree(state: SolverState, classArmId: string, day: number, periodId: string): boolean {
  const schedule = state.classSchedule.get(classArmId);
  return !schedule || !schedule.has(slotKey(day, periodId));
}

function isRoomFree(state: SolverState, roomId: string, day: number, periodId: string): boolean {
  const schedule = state.roomSchedule.get(roomId);
  return !schedule || !schedule.has(slotKey(day, periodId));
}

function isTeacherAvailable(
  constraints: SolverConstraints,
  teacherId: string,
  day: number,
  periodId: string,
): boolean {
  const entry = constraints.teacherAvailability.find(
    (a) => a.teacherId === teacherId && a.dayOfWeek === day && a.periodId === periodId,
  );
  // If no entry, assume available
  return entry ? entry.isAvailable : true;
}

function getTeacherDayCount(state: SolverState, teacherId: string, day: number): number {
  return state.teacherDayCount.get(teacherId)?.get(day) ?? 0;
}

function getTeacherMaxPerDay(constraints: SolverConstraints, teacherId: string): number {
  const pref = constraints.teacherPreferences.find((p) => p.teacherId === teacherId);
  return pref?.maxPeriodsPerDay ?? 8; // default high limit
}

function getConsecutiveCount(
  state: SolverState,
  teacherId: string,
  day: number,
  periods: Period[],
  currentPeriodOrder: number,
): number {
  let count = 0;
  // Count backwards from current
  for (let o = currentPeriodOrder - 1; o >= 1; o--) {
    const p = periods.find((pp) => pp.order === o);
    if (!p) break;
    const schedule = state.teacherSchedule.get(teacherId);
    if (schedule?.has(slotKey(day, p.id))) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function markSlot(state: SolverState, slot: SlotResult): void {
  const key = slotKey(slot.dayOfWeek, slot.periodId);

  if (!state.teacherSchedule.has(slot.teacherId)) state.teacherSchedule.set(slot.teacherId, new Set());
  state.teacherSchedule.get(slot.teacherId)!.add(key);

  if (!state.classSchedule.has(slot.classArmId)) state.classSchedule.set(slot.classArmId, new Set());
  state.classSchedule.get(slot.classArmId)!.add(key);

  if (slot.roomId) {
    if (!state.roomSchedule.has(slot.roomId)) state.roomSchedule.set(slot.roomId, new Set());
    state.roomSchedule.get(slot.roomId)!.add(key);
  }

  // Update day count
  if (!state.teacherDayCount.has(slot.teacherId)) state.teacherDayCount.set(slot.teacherId, new Map());
  const dayMap = state.teacherDayCount.get(slot.teacherId)!;
  dayMap.set(slot.dayOfWeek, (dayMap.get(slot.dayOfWeek) ?? 0) + 1);

  // Update subject frequency
  if (!state.classSubjectCount.has(slot.classArmId)) state.classSubjectCount.set(slot.classArmId, new Map());
  const subjMap = state.classSubjectCount.get(slot.classArmId)!;
  subjMap.set(slot.subjectId, (subjMap.get(slot.subjectId) ?? 0) + 1);

  state.slots.push(slot);
}

function unmarkSlot(state: SolverState, slot: SlotResult): void {
  const key = slotKey(slot.dayOfWeek, slot.periodId);

  state.teacherSchedule.get(slot.teacherId)?.delete(key);
  state.classSchedule.get(slot.classArmId)?.delete(key);
  if (slot.roomId) state.roomSchedule.get(slot.roomId)?.delete(key);

  const dayMap = state.teacherDayCount.get(slot.teacherId);
  if (dayMap) {
    const count = dayMap.get(slot.dayOfWeek) ?? 0;
    if (count > 1) dayMap.set(slot.dayOfWeek, count - 1);
    else dayMap.delete(slot.dayOfWeek);
  }

  const subjMap = state.classSubjectCount.get(slot.classArmId);
  if (subjMap) {
    const count = subjMap.get(slot.subjectId) ?? 0;
    if (count > 1) subjMap.set(slot.subjectId, count - 1);
    else subjMap.delete(slot.subjectId);
  }

  state.slots.pop();
}

/**
 * Solve timetable using backtracking with constraint propagation.
 */
export function solveTimetable(params: {
  classArmIds: string[];
  assignments: Assignment[];
  periods: Period[];
  rooms: Room[];
  days: number[];
  constraints: SolverConstraints;
  schoolId: string;
  academicYearId: string;
  termId: string;
}): { slots: SlotResult[]; conflicts: string[] } {
  const { classArmIds, assignments, periods, rooms, days, constraints } = params;

  const state: SolverState = {
    teacherSchedule: new Map(),
    roomSchedule: new Map(),
    classSchedule: new Map(),
    teacherDayCount: new Map(),
    classSubjectCount: new Map(),
    slots: [],
    conflicts: [],
  };

  const maxConsecutive = constraints.maxConsecutivePeriodsPerTeacher;

  // Group assignments by classArm
  const assignmentsByClass = new Map<string, Assignment[]>();
  for (const a of assignments) {
    if (!assignmentsByClass.has(a.classArmId)) assignmentsByClass.set(a.classArmId, []);
    assignmentsByClass.get(a.classArmId)!.push(a);
  }

  const totalSlotsPerWeek = periods.length * days.length;

  // Build task queue: (classArmId, assignment, remaining)
  interface Task {
    classArmId: string;
    assignment: Assignment;
    remaining: number;
  }

  const taskQueue: Task[] = [];

  for (const classArmId of classArmIds) {
    const classAssignments = assignmentsByClass.get(classArmId) ?? [];
    if (classAssignments.length === 0) {
      state.conflicts.push(`No assignments for class arm ${classArmId}`);
      continue;
    }

    const defaultFreq = Math.max(1, Math.floor(totalSlotsPerWeek / classAssignments.length));
    for (const a of classAssignments) {
      const freq = constraints.subjectFrequencyPerWeek[a.subjectId] ?? defaultFreq;
      taskQueue.push({ classArmId, assignment: a, remaining: freq });
    }
  }

  // Sort tasks: subjects with higher frequency first (most constrained first heuristic)
  taskQueue.sort((a, b) => b.remaining - a.remaining);

  // Backtracking solver with limited depth
  const MAX_BACKTRACKS = 5000;
  let backtracks = 0;

  function solve(taskIndex: number): boolean {
    if (taskIndex >= taskQueue.length) return true;

    const task = taskQueue[taskIndex];
    if (task.remaining <= 0) return solve(taskIndex + 1);

    const teacherId = task.assignment.staffId;

    // Try each day-period combination
    for (const day of days) {
      for (const period of periods) {
        // Quick checks
        if (!isClassFree(state, task.classArmId, day, period.id)) continue;
        if (!isTeacherFree(state, teacherId, day, period.id)) continue;
        if (!isTeacherAvailable(constraints, teacherId, day, period.id)) continue;

        // Max periods per day check
        const dayCount = getTeacherDayCount(state, teacherId, day);
        if (dayCount >= getTeacherMaxPerDay(constraints, teacherId)) continue;

        // Consecutive periods check
        const consecutive = getConsecutiveCount(state, teacherId, day, periods, period.order);
        if (consecutive >= maxConsecutive) continue;

        // Avoid same subject twice in same day for same class
        const classSubjDayCount = state.slots.filter(
          (s) =>
            s.classArmId === task.classArmId &&
            s.subjectId === task.assignment.subjectId &&
            s.dayOfWeek === day,
        ).length;
        if (classSubjDayCount >= 2) continue; // max 2 periods of same subject per day

        // Find a free room
        let roomId: string | null = null;
        for (const room of rooms) {
          if (isRoomFree(state, room.id, day, period.id)) {
            roomId = room.id;
            break;
          }
        }

        // Place the slot
        const slot: SlotResult = {
          classArmId: task.classArmId,
          subjectId: task.assignment.subjectId,
          teacherId,
          periodId: period.id,
          roomId,
          dayOfWeek: day,
        };

        markSlot(state, slot);
        task.remaining--;

        if (solve(taskIndex + (task.remaining <= 0 ? 1 : 0))) {
          return true;
        }

        // Backtrack
        unmarkSlot(state, slot);
        task.remaining++;
        backtracks++;

        if (backtracks >= MAX_BACKTRACKS) {
          // Fall through to greedy for remaining
          return false;
        }
      }
    }

    // Could not place this task
    if (task.remaining > 0) {
      state.conflicts.push(
        `Could not schedule ${task.assignment.subjectName} for class arm ${task.classArmId} (${task.remaining} slots remaining)`,
      );
      task.remaining = 0; // skip it
    }
    return solve(taskIndex + 1);
  }

  solve(0);

  return { slots: state.slots, conflicts: state.conflicts };
}
