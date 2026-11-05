import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";

const MOCK_COURSES = [
  {
    id: "c1",
    code: "BIO 101",
    title: "Introduction to Biotechnology",
    materials: [
      { id: "m1", title: "Cell Structure & Function", date: "20 Sep 2026", size: "2.4 MB" },
      { id: "m2", title: "Genetics Basics", date: "21 Sep 2026", size: "4.1 MB" },
    ],
    activeTest: {
      id: "t1",
      title: "Mid-Term Assessment",
      duration: "15 mins",
      questions: 10
    }
  },
  {
    id: "c2",
    code: "BIO 202",
    title: "Molecular Genetics",
    materials: [
      { id: "m3", title: "DNA Replication", date: "22 Sep 2026", size: "1.8 MB" },
      { id: "m4", title: "RNA Transcription", date: "23 Sep 2026", size: "3.2 MB" },
    ],
    activeTest: null
  },
  {
    id: "c3",
    code: "BIO 305",
    title: "Biochemical Engineering",
    materials: [
      { id: "m5", title: "Bioreactor Design Fundamentals", date: "15 Sep 2026", size: "5.5 MB" }
    ],
    activeTest: null
  }
];

export async function GET() {
  try {
    for (const course of MOCK_COURSES) {
      // Create a document reference with the specific ID so it matches our mock data
      const docRef = doc(collection(db, "courses"), course.id);
      await setDoc(docRef, course);
    }
    
    return NextResponse.json({ message: "Successfully seeded Firestore with mock courses!" });
  } catch (error) {
    console.error("Error seeding Firestore:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
