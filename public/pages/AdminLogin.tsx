import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginAdmin } from "../lib/adminAuth";
import { Properties } from "csstype";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (loginAdmin(password)) {
      navigate("/admin");
    } else {
      setError("Invalid password.");
      setPassword("");
    }
  };

  return (
    <div style={styles.wrapper}>
      <h2 style={styles.header}>Admin Sign In</h2>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>Enter the admin password.</p>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          style={styles.input}
        />
        <button type="submit" style={styles.button}>Login</button>
        {error && <p style={styles.error}>{error}</p>}
      </form>
    </div>
  );
}

const styles: { [key: string]: Properties } = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "4rem 1rem",
  },
  header: {
    fontSize: "2rem",
    marginBottom: "0.5rem",
  },
  form: {
    width: "100%",
    maxWidth: "400px",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    textAlign: "center",
  },
  input: {
    padding: "1rem",
    fontSize: "1.2rem",
    borderRadius: "8px",
    border: "2px solid #4f8cff",
    outline: "none",
  },
  button: {
    padding: "1rem",
    fontSize: "1.2rem",
    borderRadius: "8px",
    border: "none",
    background: "#4f8cff",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },
  error: {
    color: "#ff4d4d",
    fontWeight: "bold",
  },
};
