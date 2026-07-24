// Standard class display format used everywhere a class is shown or picked: Test Creation,
// Attendance, Staff Assignment, Reports. "SCOE · COMP(2028) - A" when the class has a Division
// (Institute · Department(Batch) - Division); falls back to the legacy "SCOE · <name> (<batch>)"
// shape for classes an admin hasn't assigned into a Division yet, so nothing already relying on
// those classes breaks while admins migrate at their own pace.
export function formatClassLabel(cls) {
  const institute = cls.institute?.name ? `${cls.institute.name} · ` : "";
  if (cls.division) {
    const department = cls.division.department?.name || "—";
    const batch = cls.batchYear ? `(${cls.batchYear})` : "";
    return `${institute}${department}${batch} - ${cls.division.name}`;
  }
  const batch = cls.batchYear ? ` (${cls.batchYear})` : "";
  return `${institute}${cls.name}${batch}`;
}

// Institute -> Batch -> Department -> Section label for an AcademicGroup: "SCOE · COMP(2028) - A".
// Falls back to formatClassLabel(assignment.class) for any pre-migration assignment that somehow
// still only carries the legacy class link.
export function formatAcademicGroupLabel(group, cls) {
  if (group) {
    const institute = group.institute?.name ? `${group.institute.name} · ` : "";
    const department = group.department?.name || "—";
    const batch = group.batch ? `(${group.batch})` : "";
    return `${institute}${department}${batch} - ${group.section}`;
  }
  return cls ? formatClassLabel(cls) : "—";
}

// Groups a flat class list into { [batchYear]: Class[] } (sorted by batch year descending) plus a
// separate `legacy` bucket for classes with no Division set — the shared grouping logic every
// cascading Institute -> Batch -> Department/Division picker on the platform reuses instead of
// re-deriving it per page.
export function groupClassesByBatch(classes) {
  const byBatch = {};
  const legacy = [];
  for (const cls of classes) {
    if (!cls.division) {
      legacy.push(cls);
      continue;
    }
    const batch = cls.batchYear || "Unknown";
    if (!byBatch[batch]) byBatch[batch] = [];
    byBatch[batch].push(cls);
  }
  const batches = Object.keys(byBatch).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return { batches, byBatch, legacy };
}

// Same shape as groupClassesByBatch, for a flat AcademicGroup list — every group always has all 4
// keys by construction, so there's no "legacy" bucket to carry.
export function groupAcademicGroupsByBatch(groups) {
  const byBatch = {};
  for (const g of groups) {
    const batch = g.batch || "Unknown";
    if (!byBatch[batch]) byBatch[batch] = [];
    byBatch[batch].push(g);
  }
  const batches = Object.keys(byBatch).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return { batches, byBatch };
}
