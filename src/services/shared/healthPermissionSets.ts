import { HEALTH_METRICS } from '../../HealthMetrics';
import { WRITEBACK_METRICS } from '../../WritebackMetrics';
import type {
  PermissionRequest,
  HealthMetricStates,
} from '../../types/healthRecords';

/**
 * Why a request may carry a direction the caller did not ask about.
 *
 * The platform authorization sheet is authoritative for every row it displays:
 * confirming it commits the state of each visible toggle. Asking for one direction
 * while the other is already enabled can therefore leave the omitted direction sitting
 * at its default (off) state — which is how enabling read ends up switching write back
 * off, and vice versa.
 *
 * So whenever both directions of a record type are enabled, they are requested together.
 * This changes only what a single request *contains*. The two toggles remain independent
 * opt-ins with independent prefs, the sheet still exposes a per-row toggle, and a
 * direction that is switched off is never requested for.
 */

/**
 * Write permissions for EVERY writeback metric, enabled or not.
 *
 * The startup protocol asks with this rather than the enabled-only set below.
 * Writeback metrics are off by default, so asking only for the enabled ones
 * meant the startup sheet contained read rows and nothing else — iOS then had
 * an answer for every type it had shown, so it never asked about writing again,
 * and turning a writeback toggle on later hit `authorizationStatusFor` returning
 * "not authorized" and silently wrote nothing.
 *
 * Asking for write access is not the same as enabling writeback: the per-metric
 * opt-in preferences are untouched and still default to off. This only makes
 * sure the permission exists by the time the user asks for the feature.
 */
export const allWritebackPermissions = (): PermissionRequest[] =>
  WRITEBACK_METRICS.map((metric) => metric.permission);

/** Write permissions for writeback metrics that are enabled, optionally scoped to record types. */
export const enabledWritebackPermissions = (
  writebackStates: Record<string, boolean>,
  recordTypes?: ReadonlySet<string>
): PermissionRequest[] =>
  WRITEBACK_METRICS.filter(
    (metric) =>
      writebackStates[metric.id] === true &&
      (!recordTypes || recordTypes.has(metric.permission.recordType))
  ).map((metric) => metric.permission);

/** Read permissions for enabled read metrics covering a record type. */
export const enabledReadPermissionsForRecordType = (
  healthMetricStates: HealthMetricStates,
  recordType: string
): PermissionRequest[] =>
  HEALTH_METRICS.filter(
    (metric) =>
      metric.recordType === recordType &&
      healthMetricStates[metric.stateKey] === true
  ).flatMap((metric) => metric.permissions);
