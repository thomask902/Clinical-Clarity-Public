import Link from "next/link";
import { useRouter } from "next/router";
import Image from "next/image";

export default function Layout({ children }) {
  const router = useRouter();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

  const handleSignOut = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/signout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        console.log("Logout Successful");
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        router.push("/signin");
      } else {
        console.error("Sign out failed:", await response.json());
        alert("Sign out failed. Please try again.");
      }
    } catch (error) {
      console.error("Error during sign out:", error);
      alert("An unexpected error occurred.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900">
      {/* Header with Centered Navigation */}
      <header className="flex items-center justify-between p-4 bg-[#E8F8FF] shadow-md w-full">
        {/* Left Section: Logo & Title */}
        <div className="flex items-center gap-3">
          
          <Link href="/">
            <div className="flex items-center cursor-pointer">
            <h1 className="text-xl font-bold">Clinical Clarity</h1>
              <Image
                src="/ClinicalClarityLogo.png"
                alt="Clinical Clarity Logo"
                width={48} // Set appropriate width
                height={48} // Set appropriate height
                priority // Ensures it loads quickly
              />
            </div>
          </Link>
        </div>

        {/* Right Section */}
        <div className="w-32 flex justify-end gap-4">
          <button className="nav-button" onClick={handleSignOut}>
            <Image src="/signout.ico" alt="Sign Out" width={32} height={32} />
            <p className="nav-text">Sign Out</p>
          </button>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
