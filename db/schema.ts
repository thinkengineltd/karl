import {sqliteTable,text,integer,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const clients=sqliteTable('clients',{id:text('id').primaryKey(),data:text('data').notNull(),createdAt:text('created_at').notNull()});
export const profiles=sqliteTable('profiles',{id:text('id').primaryKey(),data:text('data').notNull()});
export const reports=sqliteTable('reports',{id:text('id').primaryKey(),clientId:text('client_id').notNull().references(()=>clients.id),month:text('month').notNull(),data:text('data').notNull(),revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull()},t=>[uniqueIndex('idx_reports_client_month').on(t.clientId,t.month)]);
export const settings=sqliteTable('settings',{id:text('id').primaryKey(),data:text('data').notNull()});
export const datasets=sqliteTable('datasets',{id:text('id').primaryKey(),reportId:text('report_id').notNull().references(()=>reports.id),sectionId:text('section_id').notNull(),nameKey:text('name_key').notNull(),data:text('data').notNull(),createdAt:text('created_at').notNull()},t=>[uniqueIndex('idx_datasets_report_section_name').on(t.reportId,t.sectionId,t.nameKey)]);
