import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "data", "rag");
const DB_PATH = path.join(DB_DIR, "rag.db");
const UPLOADS_DIR = path.join(DB_DIR, "uploads");
const PAGE_IMAGES_DIR = path.join(DB_DIR, "page_images");

function ensureDirectories() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(PAGE_IMAGES_DIR)) {
    fs.mkdirSync(PAGE_IMAGES_DIR, { recursive: true });
  }
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    ensureDirectories();
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }
  // Keep schema migrations idempotent and always applied, even when
  // the DB connection was created before hot-reload code changes.
  initializeSchema(_db);
  return _db;
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      total_pages INTEGER DEFAULT 0,
      total_chunks INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'processing',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      content TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      page_number INTEGER,
      embedding BLOB,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);

    CREATE TABLE IF NOT EXISTS page_images (
      document_id TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      image_index INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      caption TEXT NOT NULL,
      caption_embedding BLOB,
      PRIMARY KEY (document_id, page_number, image_index),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_page_images_document_id ON page_images(document_id);
    CREATE INDEX IF NOT EXISTS idx_page_images_document_page ON page_images(document_id, page_number);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student','teacher')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrate older page_images schema (primary key only on document_id,page_number).
  // We do an in-place table rebuild to add image_index + caption_embedding without losing data.
  const pageImageColumns = db
    .prepare(`PRAGMA table_info(page_images)`)
    .all() as { name: string }[];
  const pageImageColumnNames = pageImageColumns.map((c) => c.name);
  const needsMigration =
    pageImageColumnNames.includes("document_id") &&
    pageImageColumnNames.includes("page_number") &&
    !pageImageColumnNames.includes("image_index");
  if (needsMigration) {
    db.exec(`
      PRAGMA foreign_keys=OFF;
      BEGIN;
      CREATE TABLE IF NOT EXISTS page_images_v2 (
        document_id TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        image_index INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        caption TEXT NOT NULL,
        caption_embedding BLOB,
        PRIMARY KEY (document_id, page_number, image_index),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );
      INSERT INTO page_images_v2 (document_id, page_number, image_index, file_path, caption, caption_embedding)
      SELECT document_id, page_number, 0 as image_index, file_path, caption, NULL as caption_embedding
      FROM page_images;
      DROP TABLE page_images;
      ALTER TABLE page_images_v2 RENAME TO page_images;
      CREATE INDEX IF NOT EXISTS idx_page_images_document_id ON page_images(document_id);
      CREATE INDEX IF NOT EXISTS idx_page_images_document_page ON page_images(document_id, page_number);
      COMMIT;
      PRAGMA foreign_keys=ON;
    `);
  }

  // Ensure newer columns exist on the users table without breaking existing DBs
  const userColumns = db.prepare(`PRAGMA table_info(users)`).all() as {
    name: string;
  }[];
  const columnNames = userColumns.map((c) => c.name);
  if (!columnNames.includes("name")) {
    db.exec(`ALTER TABLE users ADD COLUMN name TEXT`);
  }
  if (!columnNames.includes("grade")) {
    db.exec(`ALTER TABLE users ADD COLUMN grade TEXT`);
  }
  if (!columnNames.includes("math_score")) {
    db.exec(`ALTER TABLE users ADD COLUMN math_score INTEGER`);
  }
  if (!columnNames.includes("science_score")) {
    db.exec(`ALTER TABLE users ADD COLUMN science_score INTEGER`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS student_subjects (
      user_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      PRIMARY KEY (user_id, subject),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS teacher_students (
      teacher_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      PRIMARY KEY (teacher_id, student_id),
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  ensureQuizSchema(db);
}

function ensureQuizSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      subject TEXT NOT NULL CHECK (subject IN ('math','science')),
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      topic_mastery_json TEXT,
      kt_source TEXT,
      duration_seconds INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_quiz_results_user ON quiz_results(user_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_results_user_subject ON quiz_results(user_id, subject);
  `);

  // Migrate quiz_results: add columns that may be absent in older DBs
  const qrCols = (db.prepare("PRAGMA table_info(quiz_results)").all() as { name: string }[]).map((c) => c.name);
  if (!qrCols.includes("topic_mastery_json")) db.exec("ALTER TABLE quiz_results ADD COLUMN topic_mastery_json TEXT");
  if (!qrCols.includes("kt_source")) db.exec("ALTER TABLE quiz_results ADD COLUMN kt_source TEXT");
  if (!qrCols.includes("duration_seconds")) db.exec("ALTER TABLE quiz_results ADD COLUMN duration_seconds INTEGER");

  db.exec(`

    CREATE TABLE IF NOT EXISTS quiz_question_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_result_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      question_id TEXT NOT NULL,
      question_preview TEXT,
      topic TEXT,
      kc_id TEXT,
      difficulty TEXT,
      selected_answer_index INTEGER,
      correct_answer_index INTEGER NOT NULL,
      is_correct INTEGER NOT NULL,
      time_spent_sec INTEGER,
      retry_count INTEGER,
      hint_used INTEGER DEFAULT 0,
      position_index INTEGER,
      FOREIGN KEY (quiz_result_id) REFERENCES quiz_results(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_qa_user_subject ON quiz_question_attempts(user_id, subject);
    CREATE INDEX IF NOT EXISTS idx_qa_quiz ON quiz_question_attempts(quiz_result_id);

    CREATE TABLE IF NOT EXISTS quiz_session_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_result_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      structured_json TEXT NOT NULL,
      narrative_text TEXT NOT NULL,
      source TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (quiz_result_id) REFERENCES quiz_results(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_subject_feedback_cache (
      user_id TEXT NOT NULL,
      subject TEXT NOT NULL CHECK (subject IN ('math','science')),
      structured_json TEXT NOT NULL,
      narrative_text TEXT NOT NULL,
      source TEXT,
      computed_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, subject),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teacher_student_insights (
      teacher_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      insight_text TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (teacher_id, student_id),
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Migrate quiz_question_attempts: legacy DBs may only have minimal columns.
  const qaCols = (
    db.prepare("PRAGMA table_info(quiz_question_attempts)").all() as {
      name: string;
    }[]
  ).map((c) => c.name);
  if (!qaCols.includes("question_preview")) {
    db.exec(
      "ALTER TABLE quiz_question_attempts ADD COLUMN question_preview TEXT"
    );
  }
  if (!qaCols.includes("topic")) {
    db.exec("ALTER TABLE quiz_question_attempts ADD COLUMN topic TEXT");
  }
  if (!qaCols.includes("kc_id")) {
    db.exec("ALTER TABLE quiz_question_attempts ADD COLUMN kc_id TEXT");
  }
  if (!qaCols.includes("difficulty")) {
    db.exec("ALTER TABLE quiz_question_attempts ADD COLUMN difficulty TEXT");
  }
  if (!qaCols.includes("selected_answer_index")) {
    db.exec(
      "ALTER TABLE quiz_question_attempts ADD COLUMN selected_answer_index INTEGER"
    );
  }
  if (!qaCols.includes("correct_answer_index")) {
    db.exec(
      "ALTER TABLE quiz_question_attempts ADD COLUMN correct_answer_index INTEGER"
    );
  }
  if (!qaCols.includes("is_correct")) {
    db.exec("ALTER TABLE quiz_question_attempts ADD COLUMN is_correct INTEGER");
  }
  if (!qaCols.includes("time_spent_sec")) {
    db.exec(
      "ALTER TABLE quiz_question_attempts ADD COLUMN time_spent_sec INTEGER"
    );
  }
  if (!qaCols.includes("retry_count")) {
    db.exec("ALTER TABLE quiz_question_attempts ADD COLUMN retry_count INTEGER");
  }
  if (!qaCols.includes("hint_used")) {
    db.exec(
      "ALTER TABLE quiz_question_attempts ADD COLUMN hint_used INTEGER DEFAULT 0"
    );
  }
  if (!qaCols.includes("position_index")) {
    db.exec(
      "ALTER TABLE quiz_question_attempts ADD COLUMN position_index INTEGER"
    );
  }
}

export function getUploadsDir(): string {
  ensureDirectories();
  return UPLOADS_DIR;
}

export function getPageImagesDir(): string {
  ensureDirectories();
  return PAGE_IMAGES_DIR;
}

// --- Page images (PDF figures with Llama Vision captions) ---

export interface PageImageRow {
  document_id: string;
  page_number: number;
  image_index: number;
  file_path: string;
  caption: string;
  caption_embedding?: Float32Array | null;
}

export function insertPageImage(row: {
  document_id: string;
  page_number: number;
  image_index: number;
  file_path: string;
  caption: string;
  caption_embedding?: number[] | null;
}): void {
  const db = getDb();
  const emb = row.caption_embedding ?? null;
  let embBuf: Buffer | null = null;
  if (emb && emb.length > 0) {
    embBuf = Buffer.alloc(emb.length * 4);
    for (let i = 0; i < emb.length; i++) {
      embBuf.writeFloatLE(emb[i], i * 4);
    }
  }
  db.prepare(
    `INSERT OR REPLACE INTO page_images (document_id, page_number, image_index, file_path, caption, caption_embedding) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    row.document_id,
    row.page_number,
    row.image_index,
    row.file_path,
    row.caption,
    embBuf
  );
}

export function getPageImagesByDocumentAndPages(
  documentId: string,
  pageNumbers: number[]
): PageImageRow[] {
  if (pageNumbers.length === 0) return [];
  const db = getDb();
  const placeholders = pageNumbers.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT document_id, page_number, image_index, file_path, caption, caption_embedding FROM page_images WHERE document_id = ? AND page_number IN (${placeholders}) ORDER BY page_number ASC, image_index ASC`
    )
    .all(documentId, ...pageNumbers) as {
    document_id: string;
    page_number: number;
    image_index: number;
    file_path: string;
    caption: string;
    caption_embedding: Buffer | null;
  }[];

  return rows.map((row) => {
    let embedding: Float32Array | null = null;
    if (row.caption_embedding && row.caption_embedding.length > 0) {
      const buf = row.caption_embedding;
      const ab = new ArrayBuffer(buf.length);
      const view = new Uint8Array(ab);
      for (let i = 0; i < buf.length; i++) view[i] = buf[i];
      embedding = new Float32Array(ab);
    }
    return {
      document_id: row.document_id,
      page_number: row.page_number,
      image_index: row.image_index,
      file_path: row.file_path,
      caption: row.caption,
      caption_embedding: embedding,
    };
  });
}

/** Get page images for multiple documents; returns map keyed by "documentId:pageNumber". */
export function getPageImagesForSources(
  items: { documentId: string; pageNumber?: number }[]
): Map<string, PageImageRow> {
  const byDoc = new Map<string, number[]>();
  for (const item of items) {
    const p = item.pageNumber ?? 0;
    if (p <= 0) continue;
    const list = byDoc.get(item.documentId) ?? [];
    if (!list.includes(p)) list.push(p);
    byDoc.set(item.documentId, list);
  }
  const result = new Map<string, PageImageRow>();
  for (const [docId, pages] of byDoc) {
    const rows = getPageImagesByDocumentAndPages(docId, pages);
    for (const row of rows) {
      // Keep compatibility with existing callers by selecting the first image on the page.
      if (row.image_index === 0) {
        result.set(`${row.document_id}:${row.page_number}`, row);
      }
    }
  }
  return result;
}

export interface PageImageEmbeddingRow {
  document_id: string;
  page_number: number;
  image_index: number;
  file_path: string;
  caption: string;
  caption_embedding: Float32Array;
}

/**
 * Load all page images with caption embeddings for the given documents (or all ready documents if omitted).
 * Used for cosine-similarity retrieval over image captions.
 */
export function getAllPageImagesWithEmbeddings(
  documentIds?: string[]
): PageImageEmbeddingRow[] {
  const db = getDb();
  if (documentIds && documentIds.length > 0) {
    const placeholders = documentIds.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT pi.document_id, pi.page_number, pi.image_index, pi.file_path, pi.caption, pi.caption_embedding
         FROM page_images pi
         JOIN documents d ON d.id = pi.document_id
         WHERE d.status = 'ready' AND pi.caption_embedding IS NOT NULL AND pi.document_id IN (${placeholders})
         ORDER BY pi.document_id, pi.page_number, pi.image_index`
      )
      .all(...documentIds) as {
      document_id: string;
      page_number: number;
      image_index: number;
      file_path: string;
      caption: string;
      caption_embedding: Buffer;
    }[];

    return rows.map((row) => {
      const buf = row.caption_embedding;
      const ab = new ArrayBuffer(buf.length);
      const view = new Uint8Array(ab);
      for (let i = 0; i < buf.length; i++) view[i] = buf[i];
      return {
        document_id: row.document_id,
        page_number: row.page_number,
        image_index: row.image_index,
        file_path: row.file_path,
        caption: row.caption,
        caption_embedding: new Float32Array(ab),
      };
    });
  }

  const rows = db
    .prepare(
      `SELECT pi.document_id, pi.page_number, pi.image_index, pi.file_path, pi.caption, pi.caption_embedding
       FROM page_images pi
       JOIN documents d ON d.id = pi.document_id
       WHERE d.status = 'ready' AND pi.caption_embedding IS NOT NULL
       ORDER BY pi.document_id, pi.page_number, pi.image_index`
    )
    .all() as {
    document_id: string;
    page_number: number;
    image_index: number;
    file_path: string;
    caption: string;
    caption_embedding: Buffer;
  }[];

  return rows.map((row) => {
    const buf = row.caption_embedding;
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; i++) view[i] = buf[i];
    return {
      document_id: row.document_id,
      page_number: row.page_number,
      image_index: row.image_index,
      file_path: row.file_path,
      caption: row.caption,
      caption_embedding: new Float32Array(ab),
    };
  });
}

// --- Document operations ---

export interface DocumentRow {
  id: string;
  name: string;
  file_path: string;
  size_bytes: number;
  total_pages: number;
  total_chunks: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export function createDocument(doc: {
  id: string;
  name: string;
  filePath: string;
  sizeBytes: number;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO documents (id, name, file_path, size_bytes, status) VALUES (?, ?, ?, ?, 'processing')`
  ).run(doc.id, doc.name, doc.filePath, doc.sizeBytes);
}

export function updateDocumentStatus(
  id: string,
  status: string,
  totalPages?: number,
  totalChunks?: number
): void {
  const db = getDb();
  if (totalPages !== undefined && totalChunks !== undefined) {
    db.prepare(
      `UPDATE documents SET status = ?, total_pages = ?, total_chunks = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(status, totalPages, totalChunks, id);
  } else {
    db.prepare(
      `UPDATE documents SET status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(status, id);
  }
}

export function getDocuments(): DocumentRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM documents ORDER BY created_at DESC")
    .all() as DocumentRow[];
}

export function getDocumentImageCounts(): Record<string, number> {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT document_id, COUNT(*) as count FROM page_images GROUP BY document_id"
    )
    .all() as { document_id: string; count: number }[];
  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.document_id] = row.count;
  }
  return map;
}

export function getDocument(id: string): DocumentRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as
    | DocumentRow
    | undefined;
}

export function deleteDocument(id: string): void {
  const db = getDb();
  const doc = db
    .prepare("SELECT file_path FROM documents WHERE id = ?")
    .get(id) as { file_path: string } | undefined;

  if (doc?.file_path && fs.existsSync(doc.file_path)) {
    fs.unlinkSync(doc.file_path);
  }
  db.prepare("DELETE FROM documents WHERE id = ?").run(id);
}

export function getReadyDocumentCount(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as count FROM documents WHERE status = 'ready'")
    .get() as { count: number };
  return row.count;
}

// --- Chunk operations ---

export function insertChunks(
  documentId: string,
  chunks: {
    content: string;
    chunkIndex: number;
    pageNumber: number;
    embedding: number[];
  }[]
): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO chunks (document_id, content, chunk_index, page_number, embedding) VALUES (?, ?, ?, ?, ?)`
  );
  const insertMany = db.transaction((items: typeof chunks) => {
    for (const chunk of items) {
      const buf = Buffer.alloc(chunk.embedding.length * 4);
      for (let i = 0; i < chunk.embedding.length; i++) {
        buf.writeFloatLE(chunk.embedding[i], i * 4);
      }
      stmt.run(
        documentId,
        chunk.content,
        chunk.chunkIndex,
        chunk.pageNumber,
        buf
      );
    }
  });
  insertMany(chunks);
}

export interface ChunkWithEmbedding {
  id: number;
  document_id: string;
  document_name: string;
  content: string;
  chunk_index: number;
  page_number: number | null;
  total_chunks: number;
  total_pages: number;
  embedding: Float32Array;
}

export function getAllChunksWithEmbeddings(): ChunkWithEmbedding[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.document_id, c.content, c.chunk_index, c.page_number, c.embedding,
              d.name as document_name, d.total_chunks, d.total_pages
       FROM chunks c
       JOIN documents d ON c.document_id = d.id
       WHERE d.status = 'ready' AND c.embedding IS NOT NULL`
    )
    .all() as {
    id: number;
    document_id: string;
    content: string;
    chunk_index: number;
    page_number: number | null;
    embedding: Buffer;
    document_name: string;
    total_chunks: number;
    total_pages: number;
  }[];

  return rows.map((row) => {
    const buf = row.embedding;
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; i++) {
      view[i] = buf[i];
    }
    return {
      id: row.id,
      document_id: row.document_id,
      document_name: row.document_name,
      content: row.content,
      chunk_index: row.chunk_index,
      page_number: row.page_number,
      total_chunks: row.total_chunks,
      total_pages: row.total_pages,
      embedding: new Float32Array(ab),
    };
  });
}

// --- User operations ---

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  name: string | null;
  grade: string | null;
  math_score?: number | null;
  science_score?: number | null;
  created_at: string;
}

export function getUserByUsername(username: string): UserRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | UserRow
    | undefined;
}

export function getUserById(id: string): UserRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | UserRow
    | undefined;
}

export function getUserCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM users").get() as {
    count: number;
  };
  return row.count;
}

export function getStudents(): UserRow[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT id, username, password_hash, role, name, grade, math_score, science_score, created_at FROM users WHERE role = 'student' ORDER BY created_at ASC"
    )
    .all() as UserRow[];
}

export function getStudentSubjects(userId: string): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT subject FROM student_subjects WHERE user_id = ? ORDER BY subject"
    )
    .all(userId) as { subject: string }[];
  return rows.map((r) => r.subject);
}

export interface StudentWithDetails {
  id: string;
  username: string;
  name: string;
  grade: string | null;
  mathScore: number | null;
  scienceScore: number | null;
  subjects: string[];
  helpSummary: string | null;
  createdAt: string;
}

export function getStudentsForTeacher(teacherId: string): StudentWithDetails[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.name, u.grade, u.math_score, u.science_score, u.created_at
       FROM users u
       INNER JOIN teacher_students ts ON ts.student_id = u.id
       WHERE ts.teacher_id = ? AND u.role = 'student'
       ORDER BY u.created_at ASC`
    )
    .all(teacherId) as {
    id: string;
    username: string;
    name: string | null;
    grade: string | null;
    math_score: number | null;
    science_score: number | null;
    created_at: string;
  }[];
  return rows.map((u) => {
    const subjects = getStudentSubjects(u.id);
    const math = u.math_score ?? null;
    const science = u.science_score ?? null;
    let helpSummary: string | null = null;
    if (math !== null || science !== null) {
      const parts: string[] = [];
      if (math !== null && math < 80) parts.push("Math");
      if (science !== null && science < 80) parts.push("Science");
      if (parts.length > 0) {
        helpSummary = `Needs additional support with ${parts.join(" and ").toLowerCase()}.`;
      } else {
        helpSummary = "Performing well across topics.";
      }
    }
    return {
      id: u.id,
      username: u.username,
      name: u.name ?? u.username,
      grade: u.grade,
      mathScore: math,
      scienceScore: science,
      subjects,
      helpSummary,
      createdAt: u.created_at,
    };
  });
}

export function linkTeacherToStudent(
  teacherId: string,
  studentId: string
): void {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO teacher_students (teacher_id, student_id) VALUES (?, ?)"
  ).run(teacherId, studentId);
}

export function addStudentSubject(userId: string, subject: string): void {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO student_subjects (user_id, subject) VALUES (?, ?)"
  ).run(userId, subject);
}

export function updateStudentScores(
  userId: string,
  mathScore: number | null,
  scienceScore: number | null
): void {
  const db = getDb();
  db.prepare(
    "UPDATE users SET math_score = ?, science_score = ? WHERE id = ?"
  ).run(mathScore ?? null, scienceScore ?? null, userId);
}

export function createUser(user: {
  id: string;
  username: string;
  passwordHash: string;
  role: "student" | "teacher";
  name?: string | null;
  grade?: string | null;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO users (id, username, password_hash, role, name, grade) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    user.id,
    user.username,
    user.passwordHash,
    user.role,
    user.name ?? null,
    user.grade ?? null
  );
}

export function updateUserName(userId: string, name: string): void {
  const db = getDb();
  db.prepare(`UPDATE users SET name = ? WHERE id = ?`).run(name, userId);
}

export function updateUserProfile(
  userId: string,
  name: string | null,
  grade: string | null
): void {
  const db = getDb();
  db.prepare(`UPDATE users SET name = ?, grade = ? WHERE id = ?`).run(
    name,
    grade,
    userId
  );
}

export function updateUserUsernameAndName(
  userId: string,
  username: string
): void {
  const db = getDb();
  db.prepare(`UPDATE users SET username = ?, name = ? WHERE id = ?`).run(
    username,
    username,
    userId
  );
}

export function updateUserPassword(userId: string, passwordHash: string): void {
  const db = getDb();
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
    passwordHash,
    userId
  );
}

// --- Quiz persistence & analytics ---

export interface QuizAttemptInsert {
  questionId: string;
  questionPreview?: string;
  topic?: string;
  kcId?: string;
  difficulty?: string;
  selectedAnswerIndex: number | null;
  correctAnswerIndex: number;
  isCorrect: boolean;
  timeSpentSec?: number;
  retryCount?: number;
  hintUsed?: boolean;
  positionIndex?: number;
}

export function saveQuizResultWithAttempts(row: {
  userId: string;
  subject: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  topicMastery?: unknown;
  ktSource?: string;
  durationSeconds?: number;
  attempts: QuizAttemptInsert[];
}): number {
  const db = getDb();
  const ins = db.prepare(
    `INSERT INTO quiz_results (user_id, subject, score, total_questions, correct_count, topic_mastery_json, kt_source, duration_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const topicJson =
    row.topicMastery !== undefined
      ? JSON.stringify(row.topicMastery)
      : null;
  const info = ins.run(
    row.userId,
    row.subject,
    row.score,
    row.totalQuestions,
    row.correctCount,
    topicJson,
    row.ktSource ?? null,
    row.durationSeconds ?? null
  );
  const quizResultId = Number(info.lastInsertRowid);

  const aStmt = db.prepare(
    `INSERT INTO quiz_question_attempts (
      quiz_result_id, user_id, subject, question_id, question_preview, topic, kc_id, difficulty,
      selected_answer_index, correct_answer_index, is_correct, time_spent_sec, retry_count, hint_used, position_index
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction((attempts: QuizAttemptInsert[]) => {
    for (const a of attempts) {
      aStmt.run(
        quizResultId,
        row.userId,
        row.subject,
        a.questionId,
        a.questionPreview ?? null,
        a.topic ?? null,
        a.kcId ?? null,
        a.difficulty ?? null,
        a.selectedAnswerIndex,
        a.correctAnswerIndex,
        a.isCorrect ? 1 : 0,
        a.timeSpentSec ?? null,
        a.retryCount ?? null,
        a.hintUsed ? 1 : 0,
        a.positionIndex ?? null
      );
    }
  });
  tx(row.attempts);
  return quizResultId;
}

export function getQuestionAttemptsWithMetaForUserSubject(
  userId: string,
  subject: "math" | "science"
) {
  const db = getDb();
  return db
    .prepare(
      `SELECT qa.question_id as questionId, qa.question_preview as questionPreview, qa.topic, qa.kc_id as kcId,
              qa.difficulty, qa.selected_answer_index as selectedAnswerIndex, qa.correct_answer_index as correctAnswerIndex,
              qa.is_correct as isCorrect, qa.time_spent_sec as timeSpentSec, qa.retry_count as retryCount,
              qa.hint_used as hintUsed, qa.position_index as positionIndex, qa.quiz_result_id as quizResultId,
              qr.created_at as sessionCreatedAt, qa.subject
       FROM quiz_question_attempts qa
       JOIN quiz_results qr ON qr.id = qa.quiz_result_id
       WHERE qa.user_id = ? AND qa.subject = ?
       ORDER BY qr.created_at ASC, qa.id ASC`
    )
    .all(userId, subject) as {
    questionId: string;
    questionPreview: string | null;
    topic: string | null;
    kcId: string | null;
    difficulty: string | null;
    selectedAnswerIndex: number | null;
    correctAnswerIndex: number;
    isCorrect: number;
    timeSpentSec: number | null;
    retryCount: number | null;
    hintUsed: number;
    positionIndex: number | null;
    quizResultId: number;
    sessionCreatedAt: string;
    subject: string;
  }[];
}

export function getSessionStructuredJsonHistoryForUserSubject(
  userId: string,
  subject: "math" | "science"
): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT sf.structured_json FROM quiz_session_feedback sf
       JOIN quiz_results qr ON qr.id = sf.quiz_result_id
       WHERE sf.user_id = ? AND sf.subject = ?
       ORDER BY sf.created_at ASC`
    )
    .all(userId, subject) as { structured_json: string }[];
  return rows.map((r) => r.structured_json);
}

export function insertQuizSessionFeedback(row: {
  quizResultId: number;
  userId: string;
  subject: string;
  structuredJson: string;
  narrativeText: string;
  source?: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO quiz_session_feedback (quiz_result_id, user_id, subject, structured_json, narrative_text, source)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    row.quizResultId,
    row.userId,
    row.subject,
    row.structuredJson,
    row.narrativeText,
    row.source ?? null
  );
}

export function upsertSubjectFeedbackCache(row: {
  userId: string;
  subject: "math" | "science";
  structuredJson: string;
  narrativeText: string;
  source?: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO quiz_subject_feedback_cache (user_id, subject, structured_json, narrative_text, source, computed_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, subject) DO UPDATE SET
       structured_json = excluded.structured_json,
       narrative_text = excluded.narrative_text,
       source = excluded.source,
       computed_at = datetime('now')`
  ).run(
    row.userId,
    row.subject,
    row.structuredJson,
    row.narrativeText,
    row.source ?? null
  );
}

export function getSubjectFeedbackCache(
  userId: string,
  subject: "math" | "science"
): {
  narrativeText: string;
  computedAt: string;
} | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT narrative_text, computed_at FROM quiz_subject_feedback_cache WHERE user_id = ? AND subject = ?`
    )
    .get(userId, subject) as
    | { narrative_text: string; computed_at: string }
    | undefined;
  if (!row) return null;
  return { narrativeText: row.narrative_text, computedAt: row.computed_at };
}

export function getTeacherStudentInsight(
  teacherId: string,
  studentId: string
): { insightText: string; sourceHash: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT insight_text, source_hash FROM teacher_student_insights WHERE teacher_id = ? AND student_id = ?`
    )
    .get(teacherId, studentId) as
    | { insight_text: string; source_hash: string }
    | undefined;
  if (!row) return null;
  return { insightText: row.insight_text, sourceHash: row.source_hash };
}

export function upsertTeacherStudentInsight(row: {
  teacherId: string;
  studentId: string;
  insightText: string;
  sourceHash: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO teacher_student_insights (teacher_id, student_id, insight_text, source_hash, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(teacher_id, student_id) DO UPDATE SET
       insight_text = excluded.insight_text,
       source_hash = excluded.source_hash,
       updated_at = datetime('now')`
  ).run(row.teacherId, row.studentId, row.insightText, row.sourceHash);
}

export interface QuizSessionRow {
  id: number;
  subject: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  createdAt: string;
}

export function getQuizResultsByUserSummary(userId: string) {
  const db = getDb();
  const sessions = db
    .prepare(
      `SELECT id, subject, score, total_questions, correct_count, created_at FROM quiz_results WHERE user_id = ? ORDER BY datetime(created_at) DESC, id DESC`
    )
    .all(userId) as {
    id: number;
    subject: string;
    score: number;
    total_questions: number;
    correct_count: number;
    created_at: string;
  }[];

  const mathSessions = sessions.filter((s) => s.subject === "math");
  const sciSessions = sessions.filter((s) => s.subject === "science");
  const avg = (arr: typeof sessions) =>
    arr.length === 0
      ? null
      : Math.round(
          arr.reduce((a, s) => a + Math.round((s.correct_count / s.total_questions) * 100), 0) /
            arr.length
        );

  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      subject: s.subject,
      score: s.score,
      totalQuestions: s.total_questions,
      correctCount: s.correct_count,
      createdAt: s.created_at,
    })),
    mathAverageScore: avg(mathSessions),
    scienceAverageScore: avg(sciSessions),
    totalQuizzes: sessions.length,
  };
}

export interface StudentQuizSummaryRow {
  userId: string;
  username: string;
  name: string;
  mathAverageScore: number | null;
  scienceAverageScore: number | null;
  totalQuizzes: number;
}

export function getAllStudentQuizSummaries(): StudentQuizSummaryRow[] {
  const db = getDb();
  const students = db
    .prepare(
      `SELECT id, username, name FROM users WHERE role = 'student' ORDER BY created_at ASC`
    )
    .all() as { id: string; username: string; name: string | null }[];

  return students.map((u) => {
    const s = getQuizResultsByUserSummary(u.id);
    return {
      userId: u.id,
      username: u.username,
      name: u.name ?? u.username,
      mathAverageScore: s.mathAverageScore,
      scienceAverageScore: s.scienceAverageScore,
      totalQuizzes: s.totalQuizzes,
    };
  });
}

/** Per-topic stats for dashboard: lifetime attempts + mean of per-quiz topic scores. */
export interface TopicAggregateRow {
  /** Pooled correct / total across every saved attempt in this topic */
  correct: number;
  total: number;
  /** How many completed quizzes included at least one question in this topic */
  quizSessions: number;
  /** Mean of (topic accuracy within each quiz), 0-100 - “average over all quizzes” */
  avgAcrossQuizzesPct: number;
}

export function getTopicAggregatesForUser(userId: string): {
  math: Record<string, TopicAggregateRow>;
  science: Record<string, TopicAggregateRow>;
} {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT subject, label,
              SUM(correct) AS correct,
              SUM(total) AS total,
              COUNT(*) AS quiz_sessions,
              AVG(100.0 * correct / CAST(total AS REAL)) AS avg_quiz_pct
       FROM (
         SELECT quiz_result_id, subject,
                COALESCE(NULLIF(topic, ''), kc_id, 'General') AS label,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) AS correct,
                COUNT(*) AS total
         FROM quiz_question_attempts
         WHERE user_id = ?
         GROUP BY quiz_result_id, subject, label
         HAVING total > 0
       ) AS per_quiz_topic
       GROUP BY subject, label`
    )
    .all(userId) as {
    subject: string;
    label: string;
    correct: number;
    total: number;
    quiz_sessions: number;
    avg_quiz_pct: number;
  }[];

  const math: Record<string, TopicAggregateRow> = {};
  const science: Record<string, TopicAggregateRow> = {};
  for (const r of rows) {
    const bucket = r.subject === "science" ? science : math;
    const avg =
      r.avg_quiz_pct != null && Number.isFinite(r.avg_quiz_pct)
        ? Math.round(r.avg_quiz_pct * 10) / 10
        : r.total > 0
          ? Math.round((r.correct / r.total) * 1000) / 10
          : 0;
    bucket[r.label] = {
      correct: r.correct,
      total: r.total,
      quizSessions: r.quiz_sessions,
      avgAcrossQuizzesPct: avg,
    };
  }
  return { math, science };
}

/** Aggregated topic performance across all students (teacher dashboard). */
export function getAllTopicAggregates(): {
  math: Record<string, { correct: number; total: number }>;
  science: Record<string, { correct: number; total: number }>;
} {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT subject, COALESCE(NULLIF(topic, ''), kc_id, 'General') as label,
              SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
              COUNT(*) as total
       FROM quiz_question_attempts
       GROUP BY subject, label`
    )
    .all() as {
    subject: string;
    label: string;
    correct: number;
    total: number;
  }[];

  const math: Record<string, { correct: number; total: number }> = {};
  const science: Record<string, { correct: number; total: number }> = {};
  for (const r of rows) {
    const bucket = r.subject === "science" ? science : math;
    bucket[r.label] = { correct: r.correct, total: r.total };
  }
  return { math, science };
}

/** Per-topic correct/total for the user's most recent quiz in that subject. */
export function getTopicBreakdownForLatestQuiz(
  userId: string,
  subject: string
): { label: string; correct: number; total: number; pct: number }[] {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id FROM quiz_results WHERE user_id = ? AND subject = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 1`
    )
    .get(userId, subject) as { id: number } | undefined;
  if (!row) return [];
  const attempts = db
    .prepare(
      `SELECT COALESCE(NULLIF(topic, ''), kc_id, 'General') as label,
              SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
              COUNT(*) as total
       FROM quiz_question_attempts
       WHERE user_id = ? AND subject = ? AND quiz_result_id = ?
       GROUP BY label`
    )
    .all(userId, subject, row.id) as {
    label: string;
    correct: number;
    total: number;
  }[];
  return attempts.map((a) => ({
    label: a.label,
    correct: a.correct,
    total: a.total,
    pct: a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0,
  }));
}

/** IEKT mastery values captured in topic_mastery_json for the latest quiz. */
export function getLatestTopicMasteryForSubject(
  userId: string,
  subject: string
): { label: string; pct: number }[] {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT topic_mastery_json FROM quiz_results
       WHERE user_id = ? AND subject = ?
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT 1`
    )
    .get(userId, subject) as { topic_mastery_json: string | null } | undefined;

  if (!row?.topic_mastery_json) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.topic_mastery_json);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];

  const entries = Object.entries(parsed as Record<string, unknown>)
    .map(([label, value]) => {
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      const pct = value <= 1 ? value * 100 : value;
      return {
        label,
        pct: Math.max(0, Math.min(100, Math.round(pct * 10) / 10)),
      };
    })
    .filter((x): x is { label: string; pct: number } => x !== null)
    .sort((a, b) => b.pct - a.pct);

  return entries;
}

/** Latest completed session per subject (for "latest test" card) */
export function getLatestSessionPerSubject(userId: string) {
  const db = getDb();
  const pick = (sub: string) =>
    db
      .prepare(
        `SELECT id, score, total_questions, correct_count, created_at FROM quiz_results
         WHERE user_id = ? AND subject = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 1`
      )
      .get(userId, sub) as
      | {
          id: number;
          score: number;
          total_questions: number;
          correct_count: number;
          created_at: string;
        }
      | undefined;

  const m = pick("math");
  const s = pick("science");
  return {
    math: m
      ? {
          pct: Math.round((m.correct_count / m.total_questions) * 100),
          correctCount: m.correct_count,
          total: m.total_questions,
          at: m.created_at,
        }
      : null,
    science: s
      ? {
          pct: Math.round((s.correct_count / s.total_questions) * 100),
          correctCount: s.correct_count,
          total: s.total_questions,
          at: s.created_at,
        }
      : null,
  };
}

export function getStudentsWithQuizAggregates(): StudentWithDetails[] {
  const students = getStudents();
  return students.map((u) => {
    const sum = getQuizResultsByUserSummary(u.id);
    const math = sum.mathAverageScore;
    const science = sum.scienceAverageScore;
    let helpSummary: string | null = null;
    if (math !== null || science !== null) {
      const parts: string[] = [];
      if (math !== null && math < 70) parts.push("Math");
      if (science !== null && science < 70) parts.push("Science");
      helpSummary =
        parts.length > 0
          ? `Needs support in ${parts.join(" & ")}.`
          : "On track in recent quizzes.";
    } else {
      helpSummary = "No quiz data yet.";
    }
    return {
      id: u.id,
      username: u.username,
      name: u.name ?? u.username,
      grade: u.grade,
      mathScore: math,
      scienceScore: science,
      subjects: getStudentSubjects(u.id),
      helpSummary,
      createdAt: u.created_at,
    };
  });
}
