// Runs once before the test workers start, so they inherit this timezone.
// Los Angeles is west of UTC, where storing due dates as UTC midnight is
// easiest to get wrong (a date read in local time shows the day before), so
// the date tests run there. Changing TZ from inside a test doesn't take effect.
module.exports = () => {
  process.env.TZ = 'America/Los_Angeles';
};
