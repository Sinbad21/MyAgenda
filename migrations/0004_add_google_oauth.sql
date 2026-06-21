-- Login con Google: collega l'account Google all'utente (match per email).
ALTER TABLE users ADD COLUMN google_id TEXT;
