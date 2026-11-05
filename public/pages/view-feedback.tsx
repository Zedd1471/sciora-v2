// pages/view-feedback.tsx
import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

type Feedback = {
  id: string;
  name: string;
  student_id: string;
  course: string;
  category: string;
  message: string;
  submitted_at: string;
};

export default function ViewFeedback() {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedback = async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (error) {
        console.error("Error fetching feedback:", error);
      } else {
        setFeedbackList(data || []);
      }
      setLoading(false);
    };

    fetchFeedback();
  }, []);

  return (
    <div className="max-w-5xl mx-auto mt-8 p-4 bg-white shadow rounded-lg">
      <h1 className="text-2xl font-bold mb-4">Submitted Feedback</h1>
      {loading ? (
        <p>Loading...</p>
      ) : feedbackList.length === 0 ? (
        <p>No feedback submitted yet.</p>
      ) : (
        <table className="w-full table-auto border">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2 border">Date</th>
              <th className="p-2 border">Name</th>
              <th className="p-2 border">Student ID</th>
              <th className="p-2 border">Course</th>
              <th className="p-2 border">Category</th>
              <th className="p-2 border">Message</th>
            </tr>
          </thead>
          <tbody>
            {feedbackList.map((fb) => (
              <tr key={fb.id} className="border-t hover:bg-gray-50">
                <td className="p-2 border text-sm">{new Date(fb.submitted_at).toLocaleString()}</td>
                <td className="p-2 border">{fb.name || "—"}</td>
                <td className="p-2 border">{fb.student_id}</td>
                <td className="p-2 border">{fb.course}</td>
                <td className="p-2 border">{fb.category}</td>
                <td className="p-2 border whitespace-pre-wrap">{fb.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
