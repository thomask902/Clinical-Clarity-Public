import Layout from "@/components/UI/Layout"; // Import the Layout component
import "@/styles/globals.css"; // Global styles (optional)
import { useAuth } from "@/utils/auth";
import { useRouter } from "next/router";

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  // checks if user is signed in and if not redirects to signin
  const isAuthenticated = useAuth();
  const publicPages = ["/signin", "/signup"];
  const isPublicPage = publicPages.includes(router.pathname);

  // Only protect pages that are NOT in the publicPages array
  if (!isPublicPage && !isAuthenticated) return null;

  // Check if the page has `getLayout` defined
  const getLayout = Component.getLayout || ((page) => <Layout>{page}</Layout>);

  return getLayout(<Component {...pageProps} />);
}

export default MyApp;