/** Format a Date (or serialized date) as `YYYY-MM-DD HH:MM:SS`. */
export function formatDate(date: Date | string | number) {
  return new Date(date).toLocaleString("sv-SE");
}
