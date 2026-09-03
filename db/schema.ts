import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import type { TzModel } from "../lib/tz/model";

/**
 * Схема базы. Скелет покрывает организации, пользователей, документы и версии.
 * Таблицы rules / rule_findings / legal_acts / okgz_codes появляются на этапе 7
 * плана — до тех пор справочники живут в lib/reference как сид.
 */

/** Роли соответствуют маршруту согласования из раздела 06 плана. */
export const userRole = pgEnum("user_role", [
  "initiator",
  "drafter",
  "lawyer",
  "secretary",
  "head",
]);

/** Статусы движутся только вперёд по маршруту; возврат создаёт новую версию. */
export const docStatus = pgEnum("doc_status", [
  "draft",
  "revision",
  "review",
  "checked",
  "approved",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull().default(""),
  address: text("address").notNull().default(""),
  headName: text("head_name").notNull().default(""),
  headPosition: text("head_position").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull().default(""),
    position: text("position").notNull().default(""),
    role: userRole("role").notNull().default("drafter"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    okgzCode: text("okgz_code").notNull().default(""),
    status: docStatus("status").notNull().default("draft"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_org_idx").on(t.orgId, t.updatedAt)],
);

/**
 * Версия хранит снимок модели целиком. Это даёт сравнение редакций и
 * возможность восстановить документ ровно в том виде, в каком он был утверждён,
 * даже если код шаблона с тех пор изменился.
 */
export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    model: jsonb("model").$type<TzModel>().notNull(),
    note: text("note").notNull().default(""),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("document_versions_uq").on(t.documentId, t.version)],
);

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentVersion = typeof documentVersions.$inferSelect;
