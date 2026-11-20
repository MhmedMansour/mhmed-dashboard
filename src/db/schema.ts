import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  bigint,
  customType,
} from "drizzle-orm/pg-core";

// Internal one-time markers. Prevents starter/demo rows from reappearing after
// the user intentionally deletes them.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default("1"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Binary column for durable file storage inside PostgreSQL. Files kept on the
// sandbox disk disappear on restart, so uploaded bytes live in the database.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const fileBlobs = pgTable("file_blobs", {
  id: serial("id").primaryKey(),
  ownerType: text("owner_type").notNull(), // 'engineering_file' | 'general_info'
  ownerId: integer("owner_id").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  clientOrSite: text("client_or_site").notNull(),
  segment: text("segment").notNull(), // 'autocad' | 'revit' | 'om' | 'parallel'
  discipline: text("discipline").notNull(),
  software: text("software").notNull(),
  status: text("status").notNull(), // 'in_progress' | 'review' | 'completed' | 'on_hold'
  priority: text("priority").notNull(), // 'urgent' | 'high' | 'normal'
  progress: integer("progress").notNull().default(0),
  sheetsCount: integer("sheets_count").notNull().default(0),
  hoursLogged: integer("hours_logged").notNull().default(0),
  slaScore: integer("sla_score").notNull().default(95),
  isSample: boolean("is_sample").notNull().default(false),
  sampleSummary: text("sample_summary"),
  location: text("location"),
  dueDate: text("due_date").notNull(), // YYYY-MM-DD
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const siteOperations = pgTable("site_operations", {
  id: serial("id").primaryKey(),
  siteName: text("site_name").notNull(),
  roleTitle: text("role_title").notNull(),
  operationType: text("operation_type").notNull(), // 'preventive' | 'corrective' | 'handover' | 'inspection'
  systemCategory: text("system_category").notNull(),
  projectName: text("project_name"),
  siteStatus: text("site_status").notNull(), // 'active_site' | 'previous_site' | 'scheduled'
  uptimePercent: integer("uptime_percent").notNull().default(98),
  ticketsResolved: integer("tickets_resolved").notNull().default(0),
  ticketsTotal: integer("tickets_total").notNull().default(0),
  periodLabel: text("period_label").notNull(),
  loggedDate: text("logged_date").notNull(), // YYYY-MM-DD
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  issuer: text("issuer").notNull(),
  category: text("category").notNull(), // 'cad_bim' | 'om_facility' | 'safety_pm' | 'academic'
  credentialCode: text("credential_code").notNull(),
  issueDate: text("issue_date").notNull(), // YYYY-MM-DD
  expiryDate: text("expiry_date"),
  verified: boolean("verified").notNull().default(true),
  fileUrl: text("file_url"),
  highlights: text("highlights"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// مهام الحرم النبوي الشريف — imported from the user's Excel sheet, each task can
// hold any number of attachments through engineeringFiles.haramTaskId.
export const haramTasks = pgTable("haram_tasks", {
  id: serial("id").primaryKey(),
  taskNo: text("task_no"), // serial / reference as written in the sheet
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("other"), // 'drawing' | 'survey' | 'planning' | 'coordination' | 'operation' | 'other'
  location: text("location"), // zone / area / courtyard inside the Haram
  requestedBy: text("requested_by"), // department / entity
  status: text("status").notNull().default("completed"), // 'completed' | 'in_progress' | 'pending' | 'on_hold'
  priority: text("priority").notNull().default("normal"), // 'urgent' | 'high' | 'normal'
  startDate: text("start_date"), // YYYY-MM-DD
  endDate: text("end_date"), // YYYY-MM-DD
  sheetsCount: integer("sheets_count").notNull().default(0),
  hours: integer("hours").notNull().default(0),
  notes: text("notes"),
  sourceSheet: text("source_sheet"), // which Excel sheet it came from
  sourceRow: integer("source_row"), // row number inside the sheet
  importBatch: text("import_batch"), // groups rows from the same import run
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// الوثائق الرسمية لمشروع الحرم النبوي (بطاقات الدخول، التصاريح، التوكيلات...)
export const haramDocuments = pgTable("haram_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  docType: text("doc_type").notNull().default("card"), // 'card_front' | 'card_back' | 'permit' | 'other'
  holderName: text("holder_name"),
  roleTitle: text("role_title"),
  organization: text("organization"),
  projectTitle: text("project_title"),
  contactNumber: text("contact_number"),
  cardNote: text("card_note"),
  fileName: text("file_name"),
  storagePath: text("storage_path"),
  mimeType: text("mime_type"),
  sizeFormatted: text("size_formatted"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const engineeringFiles = pgTable("engineering_files", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  extension: text("extension").notNull(),
  formatGroup: text("format_group").notNull(), // 'autocad' | 'revit_bim' | 'documents_pdf' | 'archives_other'
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  sizeFormatted: text("size_formatted").notNull(),
  segment: text("segment").notNull(), // 'autocad' | 'revit' | 'om' | 'certificates' | 'samples' | 'haram'
  projectId: integer("project_id"),
  certificateId: integer("certificate_id"),
  haramTaskId: integer("haram_task_id"),
  projectTitle: text("project_title"),
  isClientSample: boolean("is_client_sample").notNull().default(false),
  sampleNote: text("sample_note"),
  storagePath: text("storage_path"),
  mimeType: text("mime_type"),
  uploadedDate: text("uploaded_date").notNull(), // YYYY-MM-DD
  downloadsCount: integer("downloads_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const telemetrySnapshots = pgTable("telemetry_snapshots", {
  id: serial("id").primaryKey(),
  periodDate: text("period_date").notNull(), // YYYY-MM-DD
  label: text("label").notNull(), // e.g., 'يناير', 'فبراير' or 'أسبوع 1'
  granularity: text("granularity").notNull(), // 'daily' | 'monthly'
  autocadSheets: integer("autocad_sheets").notNull().default(0),
  revitModels: integer("revit_models").notNull().default(0),
  omTasks: integer("om_tasks").notNull().default(0),
  hoursLogged: integer("hours_logged").notNull().default(0),
  efficiencyRate: integer("efficiency_rate").notNull().default(94),
});

export const engineerProfile = pgTable("engineer_profile", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  headline: text("headline").notNull(),
  phoneOrWhatsapp: text("phone_or_whatsapp"),
  email: text("email"),
  city: text("city"),
  yearsExperience: integer("years_experience").notNull().default(5),
  objective: text("objective"),
  skills: text("skills"),
  responsibilities: text("responsibilities"),
  education: text("education"),
  personalDetails: text("personal_details"),
  workspaceMode: text("workspace_mode").notNull().default("live_active"), // 'live_active' | 'clean_empty'
  isActivated: boolean("is_activated").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cvExperiences = pgTable("cv_experiences", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  roleTitle: text("role_title").notNull(),
  periodLabel: text("period_label").notNull(),
  location: text("location"),
  details: text("details"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const generalInfo = pgTable("general_info", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  mediaType: text("media_type").notNull().default("image"), // 'image' | 'pdf' | 'note'
  fileName: text("file_name"),
  storagePath: text("storage_path"),
  mimeType: text("mime_type"),
  sizeFormatted: text("size_formatted"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Autodesk APS OAuth connection per browser session; sensitive token payload is
// AES-GCM encrypted server-side. The browser only holds a random session id.
export const apsConnections = pgTable("aps_connections", {
  sessionId: text("session_id").primaryKey(),
  encryptedTokens: text("encrypted_tokens").notNull(),
  displayName: text("display_name"),
  email: text("email"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Translation status for uploaded CAD/BIM files. Only metadata/URN here, not bytes.
export const apsModels = pgTable("aps_models", {
  fileId: integer("file_id").primaryKey(),
  urn: text("urn").notNull(),
  objectId: text("object_id").notNull(),
  status: text("status").notNull().default("inprogress"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const shareLinks = pgTable("share_links", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  resourceType: text("resource_type").notNull(), // 'engineering_file' | 'general_info' | 'haram_document' | 'project' | 'haram_task' | 'certificate' | 'operation'
  resourceId: integer("resource_id").notNull(),
  title: text("title").notNull(),
  fileName: text("file_name"),
  allowDownload: boolean("allow_download").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ShareLinkRecord = typeof shareLinks.$inferSelect;

export type CvExperienceRecord = typeof cvExperiences.$inferSelect;
export type GeneralInfoRecord = typeof generalInfo.$inferSelect;
export type HaramTaskRecord = typeof haramTasks.$inferSelect;
export type NewHaramTaskRecord = typeof haramTasks.$inferInsert;
export type HaramDocumentRecord = typeof haramDocuments.$inferSelect;

export type ProjectRecord = typeof projects.$inferSelect;
export type NewProjectRecord = typeof projects.$inferInsert;
export type SiteOperationRecord = typeof siteOperations.$inferSelect;
export type NewSiteOperationRecord = typeof siteOperations.$inferInsert;
export type CertificateRecord = typeof certificates.$inferSelect;
export type NewCertificateRecord = typeof certificates.$inferInsert;
export type EngineeringFileRecord = typeof engineeringFiles.$inferSelect;
export type NewEngineeringFileRecord = typeof engineeringFiles.$inferInsert;
export type TelemetrySnapshotRecord = typeof telemetrySnapshots.$inferSelect;
export type EngineerProfileRecord = typeof engineerProfile.$inferSelect;
