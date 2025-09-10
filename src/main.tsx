import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import AdminApp from "./App";
import Login from "./Login";

function Root() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("isLoggedIn");
    if (saved === "true") setIsLoggedIn(true);
  }, []);

  return isLoggedIn ? (
    <AdminApp />
  ) : (
    <Login onLogin={() => setIsLoggedIn(true)} />
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
