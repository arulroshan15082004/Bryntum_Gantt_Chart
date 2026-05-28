export function formatDateOnly(dateVal: any): string {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateStr: string | Date, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateDuration(startDate: any, endDate: any): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 0;
  const diffTime = end.getTime() - start.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function checkDependencyConflict(
  predecessor: { startDate: string | Date; endDate: string | Date },
  successor: { startDate: string | Date; endDate: string | Date },
  type: 'FS' | 'SS' | 'FF' | 'SF',
  lag: number
): boolean {
  const succStart = formatDateOnly(successor.startDate);
  const succEnd = formatDateOnly(successor.endDate);
  const predStart = formatDateOnly(predecessor.startDate);
  const predEnd = formatDateOnly(predecessor.endDate);

  if (!succStart || !succEnd || !predStart || !predEnd) return false;

  if (type === 'FS') {
    const minSuccStart = addDays(predEnd, lag);
    return new Date(succStart) < new Date(minSuccStart);
  } else if (type === 'SS') {
    const minSuccStart = addDays(predStart, lag);
    return new Date(succStart) < new Date(minSuccStart);
  } else if (type === 'FF') {
    const minSuccEnd = addDays(predEnd, lag);
    return new Date(succEnd) < new Date(minSuccEnd);
  } else if (type === 'SF') {
    const minSuccEnd = addDays(predStart, lag);
    return new Date(succEnd) < new Date(minSuccEnd);
  }
  return false;
}

export function calculateSuccessorDates(
  predecessor: { startDate: string | Date; endDate: string | Date },
  successorDuration: number,
  type: 'FS' | 'SS' | 'FF' | 'SF',
  lag: number
): { startDate: string; endDate: string } {
  const predStart = formatDateOnly(predecessor.startDate);
  const predEnd = formatDateOnly(predecessor.endDate);
  let startDate = '';
  let endDate = '';

  if (type === 'FS') {
    startDate = addDays(predEnd, lag);
    endDate = addDays(startDate, successorDuration);
  } else if (type === 'SS') {
    startDate = addDays(predStart, lag);
    endDate = addDays(startDate, successorDuration);
  } else if (type === 'FF') {
    endDate = addDays(predEnd, lag);
    startDate = addDays(endDate, -successorDuration);
  } else if (type === 'SF') {
    endDate = addDays(predStart, lag);
    startDate = addDays(endDate, -successorDuration);
  }

  return { startDate, endDate };
}
