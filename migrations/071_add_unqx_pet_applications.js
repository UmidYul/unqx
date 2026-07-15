module.exports = {
  id: "071_add_unqx_pet_applications",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS unqx_pet_applications (
        id SERIAL PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pet_id integer NOT NULL REFERENCES unqx_pets(id) ON DELETE CASCADE,
        status varchar(20) NOT NULL DEFAULT 'pending',
        created_at timestamp NOT NULL DEFAULT now(),
        reviewed_at timestamp NULL,
        admin_note text NULL,
        CONSTRAINT unqx_pet_applications_status_check
          CHECK (status IN ('pending', 'approved', 'rejected'))
      );

      CREATE INDEX IF NOT EXISTS unqx_pet_applications_status_created_idx
        ON unqx_pet_applications (status, created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS unqx_pet_applications_user_pet_idx
        ON unqx_pet_applications (user_id, pet_id, created_at DESC, id DESC);

      CREATE UNIQUE INDEX IF NOT EXISTS unqx_pet_applications_pending_unique
        ON unqx_pet_applications (user_id, pet_id)
        WHERE status = 'pending';
    `);
  },
};
