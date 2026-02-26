-- Tabla para guardar las ubicaciones seleccionadas en la página pública (/ubicaciones).
-- Cada fila = una ubicación seleccionada por una "sesión" (navegador/celular).
-- Ejecutar una sola vez en la misma base de datos donde está la tabla locations.

CREATE TABLE IF NOT EXISTS public_location_selections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL COMMENT 'Identificador de sesión (ej. UUID en localStorage)',
  location_id INT NOT NULL COMMENT 'ID de la ubicación seleccionada',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_session_location (session_id, location_id),
  KEY idx_session (session_id),
  KEY idx_location (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Selecciones de ubicaciones en la página pública por sesión';
