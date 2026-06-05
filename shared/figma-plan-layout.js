/** Колонка для новых макетов — не накладывать на старые Landing/Onboarding. */
export const MOBBIN_PLAN_ORIGIN_X = 2800;
export const MOBBIN_PLAN_ORIGIN_Y = 120;

/**
 * Сдвигает корневые фреймы (без parentKey) в свободную колонку справа.
 * @param {object} plan
 * @param {number} [baseX]
 * @param {number} [baseY]
 */
export function shiftPlanToFreeColumn(plan, baseX = MOBBIN_PLAN_ORIGIN_X, baseY = MOBBIN_PLAN_ORIGIN_Y) {
  if (!plan?.operations?.length) return plan;

  const ops = plan.operations.map((op) => ({ ...op }));
  const roots = ops.filter((op) => !op.parentKey && op.x != null);
  if (!roots.length) return { ...plan, operations: ops };

  const minX = Math.min(...roots.map((o) => Number(o.x)));
  const minY = Math.min(...roots.map((o) => Number(o.y ?? MOBBIN_PLAN_ORIGIN_Y)));
  const deltaX = baseX - minX;
  const deltaY = baseY - minY;

  for (const op of ops) {
    if (op.parentKey) continue;
    if (op.x != null) op.x = Number(op.x) + deltaX;
    if (op.y != null) op.y = Number(op.y) + deltaY;
  }

  return { ...plan, operations: ops };
}
