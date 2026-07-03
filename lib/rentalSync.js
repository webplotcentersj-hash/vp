/**
 * Mantiene coherencia entre rentals y locations.status:
 * - Elimina alquileres vencidos
 * - Quita duplicados activos por ubicación (conserva el de fin más lejano)
 * - Ajusta status rented/available según alquiler vigente hoy
 */

export async function syncRentals(conn) {
  const [[{ deletedExpired }]] = await conn.execute(
    "SELECT COUNT(*) AS deletedExpired FROM rentals WHERE endDate < CURDATE()"
  );
  await conn.execute("DELETE FROM rentals WHERE endDate < CURDATE()");

  const [dupes] = await conn.execute(`
    SELECT locationId, GROUP_CONCAT(id ORDER BY endDate DESC, id DESC) AS ids
    FROM rentals
    WHERE CURDATE() BETWEEN startDate AND endDate
    GROUP BY locationId
    HAVING COUNT(*) > 1
  `);

  let removedDuplicates = 0;
  for (const row of dupes || []) {
    const ids = String(row.ids || "")
      .split(",")
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const toDelete = ids.slice(1);
    if (toDelete.length === 0) continue;
    const ph = toDelete.map(() => "?").join(",");
    const [del] = await conn.execute(`DELETE FROM rentals WHERE id IN (${ph})`, toDelete);
    removedDuplicates += del.affectedRows || 0;
  }

  const [fixAvailable] = await conn.execute(`
    UPDATE locations l
    SET l.status = 'available'
    WHERE l.status = 'rented'
      AND NOT EXISTS (
        SELECT 1 FROM rentals r
        WHERE r.locationId = l.id
          AND CURDATE() BETWEEN r.startDate AND r.endDate
      )
  `);

  const [fixRented] = await conn.execute(`
    UPDATE locations l
    INNER JOIN rentals r ON r.locationId = l.id
      AND CURDATE() BETWEEN r.startDate AND r.endDate
    SET l.status = 'rented'
    WHERE l.status = 'available'
  `);

  return {
    deletedExpired: Number(deletedExpired) || 0,
    removedDuplicates,
    fixedToAvailable: fixAvailable.affectedRows || 0,
    fixedToRented: fixRented.affectedRows || 0,
  };
}

/** Solapamiento: r1.start <= r2.end AND r1.end >= r2.start */
export async function findConflictingLocationIds(conn, locationIds, startDate, endDate, excludeRentalId = null) {
  if (!locationIds.length) return [];
  const ph = locationIds.map(() => "?").join(",");
  const params = [...locationIds, endDate, startDate];
  let excludeSql = "";
  if (excludeRentalId != null) {
    excludeSql = " AND r.id <> ?";
    params.push(excludeRentalId);
  }
  const [rows] = await conn.execute(
    `SELECT DISTINCT r.locationId
     FROM rentals r
     WHERE r.locationId IN (${ph})
       AND r.startDate <= ?
       AND r.endDate >= ?${excludeSql}`,
    params
  );
  return (rows || []).map((r) => Number(r.locationId));
}

export async function withRentalSync(pool, fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const syncResult = await syncRentals(conn);
    const result = await fn(conn, syncResult);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
