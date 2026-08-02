const ROLE_PERMISSIONS = {
  admin: ["CompositePerformance", "Account", "Benchmark"],
  analyst: ["CompositePerformance", "Account", "Benchmark"],
  viewer: ["CompositePerformance", "Benchmark"],
};

export function isAuthorizedForTable(user, tablesUsed) {
  const role = user?.role || "analyst";
  const allowed = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.analyst;

  for (const table of tablesUsed) {
    const match = allowed.find((t) => t.toLowerCase() === table.toLowerCase());
    if (!match) {
      return {
        authorized: false,
        reason: `Role '${role}' is not authorized to access table '${table}'.`,
      };
    }
  }

  return { authorized: true };
}

export function applyRbacConstraints(sql, user) {
  if (!user || !user.region || user.role === "admin") {
    return sql;
  }

  const regionEscaped = user.region.replace(/'/g, "''");

  if (/\bAccount\b/i.test(sql)) {
    if (/\bWHERE\b/i.test(sql)) {
      return sql.replace(/\bWHERE\b/i, `WHERE AccountName LIKE '%${regionEscaped}%' AND `);
    } else if (/\bGROUP BY\b/i.test(sql)) {
      return sql.replace(/\bGROUP BY\b/i, `WHERE AccountName LIKE '%${regionEscaped}%' GROUP BY`);
    } else if (/\bORDER BY\b/i.test(sql)) {
      return sql.replace(/\bORDER BY\b/i, `WHERE AccountName LIKE '%${regionEscaped}%' ORDER BY`);
    } else {
      return `${sql} WHERE AccountName LIKE '%${regionEscaped}%'`;
    }
  }

  return sql;
}
