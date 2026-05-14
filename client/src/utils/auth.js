import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const publicPages = ["/signin", "/signup"];

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token && !publicPages.includes(router.pathname)) {
      router.replace("/signin");
    } else if (token) {
      setIsAuthenticated(true);
    }
  }, [router, publicPages]);

  return isAuthenticated;
}