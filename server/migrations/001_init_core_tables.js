// Migration: 001_init_core_tables.js
export async function up(knex) {
  await knex.schema.createTable('roles', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
  });
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.integer('role_id').unsigned().references('id').inTable('roles');
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
  await knex.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table.string('sku').notNullable().unique();
    table.string('name').notNullable();
    table.string('uom');
    table.decimal('cost', 14, 2);
    table.decimal('price', 14, 2);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
  await knex.schema.createTable('stock_movements', (table) => {
    table.increments('id').primary();
    table.integer('product_id').unsigned().references('id').inTable('products');
    table.integer('qty').notNullable();
    table.enu('type', ['in', 'out', 'adjust']).notNullable();
    table.string('ref');
    table.date('date').notNullable();
  });
  await knex.schema.createTable('purchase_orders', (table) => {
    table.increments('id').primary();
    table.integer('supplier_id').unsigned();
    table.string('status').defaultTo('draft');
    table.decimal('total', 14, 2);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
  await knex.schema.createTable('po_lines', (table) => {
    table.increments('id').primary();
    table.integer('po_id').unsigned().references('id').inTable('purchase_orders');
    table.integer('product_id').unsigned().references('id').inTable('products');
    table.integer('qty').notNullable();
    table.decimal('unit_price', 14, 2);
  });
  await knex.schema.createTable('invoices', (table) => {
    table.increments('id').primary();
    table.integer('customer_id').unsigned();
    table.decimal('total', 14, 2);
    table.date('due_date');
    table.string('status').defaultTo('unpaid');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('invoices');
  await knex.schema.dropTableIfExists('po_lines');
  await knex.schema.dropTableIfExists('purchase_orders');
  await knex.schema.dropTableIfExists('stock_movements');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('roles');
}
