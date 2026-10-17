-- Everyone who has an account today becomes an Admin, so admins can then downgrade people to Member from
-- Settings › Team & Access. New people still get the role from their invite (Google sign-ups: Member).
UPDATE "User" SET "role" = 'ADMIN' WHERE "role" <> 'ADMIN';
