export const calculateDuration = (startDate: any, endDate: any): number => {
  if (!startDate || !endDate) return 0;
  
  // Enforce YYYY-MM-DD parsing timezone-neutrally
  const formatDateString = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(val);
      if (match) return val;
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const startStr = formatDateString(startDate);
  const endStr = formatDateString(endDate);

  if (!startStr || !endStr) return 0;

  const start = new Date(startStr);
  const end = new Date(endStr);
  
  if (end <= start) return 0;
  const diffTime = end.getTime() - start.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

export const formatDateOnly = (dateVal: any): string => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    const matchesYmD = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateVal);
    if (matchesYmD) return dateVal;
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const serializeTask = (task: any) => {
  if (!task) return null;
  const obj = task.toObject ? task.toObject() : { ...task };
  
  const startStr = formatDateOnly(obj.startDate);
  const endStr = formatDateOnly(obj.endDate);

  // Enforce auto-calculated duration strictly
  obj.duration = obj.isMilestone ? 0 : calculateDuration(startStr, endStr);
  obj.startDate = startStr;
  obj.endDate = endStr;
  obj.id = obj._id ? obj._id.toString() : obj.id;
  return obj;
};
