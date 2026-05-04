// Seed: 001_seed_roles_users.js
import bcrypt from 'bcrypt';

export async function seed(knex) {
  await knex('users').del();
  await knex('roles').del();
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'admin', 12);
  await knex('roles').insert([
    { id: 1, name: 'admin' },
    { id: 2, name: 'manager' },
    { id: 3, name: 'user' },
  ]);
  await knex('users').insert([
    {
      id: 1,
      email: 'admin@erp.local',
      password_hash: passwordHash,
      role_id: 1,
      active: true,
    },
  ]);
}
