import { useRouter } from "next/router";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";


export default function SignupPage() {
  const router = useRouter();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [response, setResponse] = useState("");

  // Handle Sign Up
  const handleSignUp = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      console.log(data)
      if (response.ok) {
        setResponse(data.message)
        await new Promise((resolve) => setTimeout(resolve, 5000));
        router.push("/signin");
      } else {
        setResponse(data.message || "Sign-up failed.");
      }
    } catch (error) {
      setResponse(data.message || "An unexpected error occurred.");
    }
  };

  return (
    <div className="min-h-screen font-sans text-gray-900 flex flex-col">
      {/* Header with Centered Navigation */}
      <header className="flex items-center justify-between p-4 bg-[#E8F8FF] shadow-md w-full">
        {/* Left Section: Logo & Title */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Clinical Clarity</h1>
            <div className="flex items-center cursor-pointer">
              <Image
                src="/ClinicalClarityLogo.png"
                alt="Clinical Clarity Logo"
                width={48} // Set appropriate width
                height={48} // Set appropriate height
                priority // Ensures it loads quickly
              />
            </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col items-center flex-grow text-center px-6 pt-24">
        {/* Hero Section */}
        <div className="space-y-4 max-w-2xl">
          <h1 className="welcome-text">
            Welcome to <span className="brand-text">Clinical Clarity!</span>
          </h1>
          <p className="subtext">
            Create your account to begin your clinical communication journey.
          </p>
        </div>

        {/* Form Section */}
        <div className="mt-8 w-full max-w-sm mx-auto">
          <div className="flex flex-col mb-4">
            <label htmlFor="email" className="text-left font-semibold mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="border p-2 rounded"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col mb-4">
            <label
              htmlFor="password"
              className="text-left font-semibold mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              className="border p-2 rounded"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {response && (
            <p className="mb-2">{response}</p>
          )}

          {/* Sign Up Button */}
          <button
            className="button-primary"
            onClick={handleSignUp}
          >
            Sign Up
          </button>

          <p className="mt-4">
            Already have an account?{" "}
            <Link href="/signin">
              <span className="text-blue-500 cursor-pointer underline">
                Sign In
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// Optional: This tells _app.js to render this page without a Layout
SignupPage.getLayout = (page) => page;
