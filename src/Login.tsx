import React, { useState } from "react";

const USERNAME = import.meta.env.VITE_ADMIN_USER;
const PASSWORD = import.meta.env.VITE_ADMIN_PASS;

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === USERNAME && password === PASSWORD) {
      localStorage.setItem("isLoggedIn", "true");
      onLogin();
    } else {
      setError("Sai tài khoản hoặc mật khẩu!");
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-100 via-sky-200 to-blue-300">
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-lg rounded-xl p-6 w-full max-w-sm space-y-4"
      >
        <h2 className="text-2xl font-bold text-center text-slate-800">
          Tiger Admin Login
        </h2>

        {error && (
          <div className="bg-red-100 text-red-600 text-sm p-2 rounded">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Tài khoản"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />

        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />

        <button
          type="submit"
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 rounded-lg transition"
        >
          Đăng nhập
        </button>
      </form>
    </div>
  );
}
