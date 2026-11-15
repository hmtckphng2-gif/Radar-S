// Störungszentrale: Verarbeitet GTFS-RT Service Alerts.
import { parseAlerts } from './feed-process.mjs';
export function severityClass(cause, effect) { return 'störung-sev-medium'; }
export function filterActiveAlerts(alerts) { return alerts; }
