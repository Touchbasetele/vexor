// Seed: 001_seed_roles_users.js
export async function seed(knex) {
  await knex('roles').del();
  await knex('users').del();
  await knex('roles').insert([
    { id: 1, name: 'admin' },
    { id: 2, name: 'manager' },
    { id: 3, name: 'user' },
  ]);
  await knex('users').insert([
    {
      id: 1,
      email: 'admin@erp.local',
      password_hash: '$2b$10$abcdefghijklmnopqrstuv', // placeholder hash
      role_id: 1,
      active: true,
    },
  ]);
}
