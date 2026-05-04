// db-setup.js: Run migrations and seeds
import knexConfig from '../knexfile.js';
import Knex from 'knex';

const knex = Knex(knexConfig);

async function setup() {
  await knex.migrate.latest();
  await knex.seed.run();
  console.log('Migrations and seeds complete.');
  process.exit(0);
}

setup();
