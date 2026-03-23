import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import {
  createUser,
  getUserByUsername,
  linkTeacherToStudent,
  addStudentSubject,
  updateStudentScores,
  updateUserProfile,
  type UserRow,
} from "@/lib/rag/db";

const DEMO_PASSWORD = "password123";

// Ensure demo users exist for easy offline testing.
// Teachers: teacher1 / password123, teacher2 / password123
// Students: student1, student2, student3, student4 / password123
// teacher1 -> student1, student2; teacher2 -> student3, student4
export async function ensureDemoUsers(): Promise<void> {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const demoTeachers = [
    { username: "teacher1", name: "Dr. Sarah Johnson", grade: null as string | null },
    { username: "teacher2", name: "Mr. James Wilson", grade: null as string | null },
  ];
  const demoStudents = [
    { username: "student1", name: "John Smith", grade: "Grade 8" },
    { username: "student2", name: "Akil Khatri", grade: "Grade 8" },
    { username: "student3", name: "Misha Nagewadia", grade: "Grade 9" },
    { username: "student4", name: "Tiana Nagewadia", grade: "Grade 9" },
  ];

  for (const t of demoTeachers) {
    const existing = getUserByUsername(t.username);
    if (!existing) {
      createUser({
        id: randomUUID(),
        username: t.username,
        passwordHash: hash,
        role: "teacher",
        name: t.name,
        grade: t.grade,
      });
    } else {
      updateUserProfile(existing.id, t.name, t.grade);
    }
  }
  for (const s of demoStudents) {
    const existing = getUserByUsername(s.username);
    if (!existing) {
      createUser({
        id: randomUUID(),
        username: s.username,
        passwordHash: hash,
        role: "student",
        name: s.name,
        grade: s.grade,
      });
    } else {
      updateUserProfile(existing.id, s.name, s.grade);
    }
  }

  // Link teachers to students and set subjects/scores (idempotent)
  const t1 = getUserByUsername("teacher1");
  const t2 = getUserByUsername("teacher2");
  const s1 = getUserByUsername("student1");
  const s2 = getUserByUsername("student2");
  const s3 = getUserByUsername("student3");
  const s4 = getUserByUsername("student4");

  if (t1 && t2 && s1 && s2 && s3 && s4) {
    linkTeacherToStudent(t1.id, s1.id);
    linkTeacherToStudent(t1.id, s2.id);
    linkTeacherToStudent(t2.id, s3.id);
    linkTeacherToStudent(t2.id, s4.id);

    const subjectMap: Record<string, string[]> = {
      student1: ["Maths", "Chemistry"],
      student2: ["Maths", "Physics"],
      student3: ["Chemistry", "Biology"],
      student4: ["Maths", "Chemistry", "Physics"],
    };
    for (const [uname, subjects] of Object.entries(subjectMap)) {
      const u = getUserByUsername(uname);
      if (u) for (const sub of subjects) addStudentSubject(u.id, sub);
    }

    const scores: Record<string, [number, number]> = {
      student1: [88, 86],
      student2: [92, 89],
      student3: [75, 78],
      student4: [95, 93],
    };
    for (const [uname, [math, science]] of Object.entries(scores)) {
      const u = getUserByUsername(uname);
      if (u) updateStudentScores(u.id, math, science);
    }
  }
}

export async function verifyUser(
  username: string,
  password: string
): Promise<UserRow | null> {
  const user = getUserByUsername(username);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  return ok ? user : null;
}

