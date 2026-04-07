-- Fotos de auditoría por lista y chupete (ejecutar en la misma base que locations / installation_lists).

CREATE TABLE IF NOT EXISTS installation_audit_photos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  list_id INT NOT NULL,
  location_id INT NOT NULL,
  mime_type VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
  data LONGBLOB NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_list (list_id),
  KEY idx_list_loc (list_id, location_id),
  CONSTRAINT fk_audit_list FOREIGN KEY (list_id) REFERENCES installation_lists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
