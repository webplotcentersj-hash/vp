-- Listas de instalación: admin elige ubicaciones; link público para marcar instalado.
-- Ejecutar una vez en la misma base que `locations`.

CREATE TABLE IF NOT EXISTS installation_lists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_slug VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_slug (public_slug),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS installation_list_locations (
  list_id INT NOT NULL,
  location_id INT NOT NULL,
  PRIMARY KEY (list_id, location_id),
  KEY idx_location (location_id),
  CONSTRAINT fk_inst_list FOREIGN KEY (list_id) REFERENCES installation_lists(id) ON DELETE CASCADE,
  CONSTRAINT fk_inst_loc FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS installation_completed (
  list_id INT NOT NULL,
  location_id INT NOT NULL,
  marked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, location_id),
  KEY idx_list (list_id),
  CONSTRAINT fk_inst_done_list FOREIGN KEY (list_id) REFERENCES installation_lists(id) ON DELETE CASCADE,
  CONSTRAINT fk_inst_done_loc FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
