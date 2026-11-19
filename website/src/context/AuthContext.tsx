"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface AuthContextType {
  user: WorkspaceUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
}

const STORAGE_KEY = "browsy_workspace_user_v1";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<WorkspaceUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch {
      // Ignore storage errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { ok: false, error: "Please enter a valid email address." };
    }
    if (!password || password.length < 6) {
      return { ok: false, error: "Please enter your password (at least 6 characters)." };
    }

    const rawName = cleanEmail.split("@")[0].replace(/[._-]/g, " ");
    const formattedName = rawName.replace(/\b\w/g, (c) => c.toUpperCase());

    const sessionUser: WorkspaceUser = {
      id: "usr_" + Math.random().toString(36).slice(2, 9),
      name: formattedName || "Browsy User",
      email: cleanEmail,
      createdAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
      setUser(sessionUser);
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not save your session in browser storage." };
    }
  };

  const signUp = async (
    name: string,
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) {
      return { ok: false, error: "Please enter your name." };
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { ok: false, error: "Please enter a valid email address." };
    }
    if (!password || password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters long." };
    }

    const sessionUser: WorkspaceUser = {
      id: "usr_" + Math.random().toString(36).slice(2, 9),
      name: cleanName,
      email: cleanEmail,
      createdAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
      setUser(sessionUser);
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not save your session in browser storage." };
    }
  };

  const signOut = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
