-- Administrator accounts, kept separate from customers (the `users` table).
-- The app also creates this table automatically on startup, so running this
-- file is optional.

USE buildit;  -- change if your DB_NAME in .env is different

CREATE TABLE IF NOT EXISTS admins (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    full_name  VARCHAR(255) NOT NULL,
    email      VARCHAR(255) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,          -- bcrypt hash, never plain text
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- To add an admin, the easiest way is:   node create-admin.js
--
-- Or insert one by hand. First make a bcrypt hash in the project folder:
--   node -e "console.log(require('bcrypt').hashSync('YourPassword', 12))"
-- then paste the printed hash below:
--
-- INSERT INTO admins (full_name, email, password)
-- VALUES ('Your Name', 'you@example.com', '<paste bcrypt hash here>');
