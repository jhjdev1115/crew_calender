import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["crew", "partner"] }),
  airline: text("airline"),
  baseAirport: text("base_airport"),
  scheduleTz: text("schedule_tz").notNull().default("Asia/Seoul"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletionRequestedAt: text("deletion_requested_at"),
});

export const duties = sqliteTable("duties", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => profiles.userId),
  type: text("type").notNull(),
  rosterMonth: text("roster_month").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  startAt: text("start_at"),
  endAt: text("end_at"),
  eventTz: text("event_tz"),
  flightNo: text("flight_no"),
  depAirport: text("dep_airport"),
  arrAirport: text("arr_airport"),
  aircraft: text("aircraft"),
  layoverCity: text("layover_city"),
  hotelName: text("hotel_name"),
  note: text("note"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
}, (table) => [
  index("idx_duties_user_roster").on(table.userId, table.rosterMonth),
  index("idx_duties_user_start_date").on(table.userId, table.startDate),
  index("idx_duties_user_start_at").on(table.userId, table.startAt),
]);

export const notificationPreferences = sqliteTable("notification_preferences", {
  userId: text("user_id").primaryKey().references(() => profiles.userId),
  allEnabled: integer("all_enabled", { mode: "boolean" }).notNull().default(true),
  ownFlightPre: integer("own_flight_pre", { mode: "boolean" }).notNull().default(true),
  partnerFlightPre: integer("partner_flight_pre", { mode: "boolean" }).notNull().default(true),
  partnerFlightPost: integer("partner_flight_post", { mode: "boolean" }).notNull().default(true),
  rosterChanged: integer("roster_changed", { mode: "boolean" }).notNull().default(true),
  sharedOffD1: integer("shared_off_d1", { mode: "boolean" }).notNull().default(true),
  hideDetails: integer("hide_details", { mode: "boolean" }).notNull().default(true),
  notificationTz: text("notification_tz").notNull().default("auto"),
  updatedAt: text("updated_at").notNull(),
});

export const inviteCodes = sqliteTable("invite_codes", {
  id: text("id").primaryKey(),
  issuerUserId: text("issuer_user_id").notNull().references(() => profiles.userId),
  codeHash: text("code_hash").notNull(),
  codeHint: text("code_hint").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  usedAt: text("used_at"),
  revokedAt: text("revoked_at"),
}, (table) => [
  uniqueIndex("idx_invite_codes_hash").on(table.codeHash),
  index("idx_invite_codes_issuer_active").on(table.issuerUserId, table.expiresAt),
]);

export const connections = sqliteTable("connections", {
  id: text("id").primaryKey(),
  userLowId: text("user_low_id").notNull().references(() => profiles.userId),
  userHighId: text("user_high_id").notNull().references(() => profiles.userId),
  status: text("status").notNull().default("active"),
  linkedAt: text("linked_at").notNull(),
  unlinkedAt: text("unlinked_at"),
}, (table) => [
  uniqueIndex("idx_connections_pair").on(table.userLowId, table.userHighId),
  index("idx_connections_low_status").on(table.userLowId, table.status),
  index("idx_connections_high_status").on(table.userHighId, table.status),
]);

export const activeMemberships = sqliteTable("active_memberships", {
  userId: text("user_id").primaryKey().references(() => profiles.userId),
  connectionId: text("connection_id").notNull().references(() => connections.id),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_active_memberships_connection").on(table.connectionId),
]);
