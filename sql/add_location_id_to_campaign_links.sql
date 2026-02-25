-- Ejecutar en la base de datos de campañas (u956355532_mapados)
-- Permite asociar un link trackable a un chupete (ubicación) concreta.
-- Ejecutar una sola vez en phpMyAdmin o tu cliente MySQL.

ALTER TABLE campaign_links
  ADD COLUMN location_id INT NULL COMMENT 'Chupete/ubicación de este link' AFTER campaign_id;
