-- Logo de cliente (ejecutar en la BD principal, tabla clients).

ALTER TABLE clients
  ADD COLUMN logo_mime VARCHAR(64) NULL DEFAULT NULL AFTER phone,
  ADD COLUMN logo_data MEDIUMBLOB NULL DEFAULT NULL AFTER logo_mime;
