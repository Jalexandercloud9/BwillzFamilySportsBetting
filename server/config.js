// Admin PIN and initial seed data. This is a family event, not a bank —
// the PIN is meant to keep siblings out of the admin panel, not stop a
// determined attacker. Override via env vars before deploying.

export const config = {
  adminPin: process.env.ADMIN_PIN || '2580',
  defaultStartingBalance: Number(process.env.STARTING_BALANCE) || 1000,
  initialRoster: (process.env.INITIAL_ROSTER || 'Dad,Mom,Uncle Rick,Sarah,Justin')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
