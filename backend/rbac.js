/**
 * Server-side Role-Based Access Control (RBAC) & Data Restriction Engine.
 * Enforces security constraints based on user role and region.
 * Never relies on the AI model to self-restrict.
 */

export function applyRbacConstraints(sql, user) {
  if (!user || user.role === "admin") {
    return sql; // Admin has unrestricted access
  }

  // Example: If user is restricted to a specific region or account subset
  if (user.region) {
    const regionFilter = `AccountName LIKE '%${user.region}%'`;
    if (/WHERE/i.test(sql)) {
      return sql.replace(/WHERE\s+/i, `WHERE (${regionFilter}) AND `);
    } else {
      // Append WHERE before ORDER BY, GROUP BY, or end of string
      if (/(ORDER\s+BY|GROUP\s+BY)/i.test(sql)) {
        return sql.replace(/(ORDER\s+BY|GROUP\s+BY)/i, `WHERE ${regionFilter} $1`);
      }
      return `${sql} WHERE ${regionFilter}`;
    }
  }

  return sql;
}

export function isAuthorizedForTable(user, tablesUsed) {
  if (!user) return true;
  if (user.role === "viewer") {
    // Viewers cannot access sensitive Account raw tables, only Benchmark / Performance
    const restrictedTables = ["Account"];
    const containsRestricted = tablesUsed.some((t) => restrictedTables.includes(t));
    if (containsRestricted) {
      return { authorized: false, reason: "Viewer role is not authorized to query individual client Account records." };
    }
  }
  return { authorized: true };
}
