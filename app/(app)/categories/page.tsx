import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getCategories } from "@/lib/categories";
import { CategoriesView } from "./categories-view";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const categories = await getCategories(session.user.id);
  return <CategoriesView initialCategories={categories} />;
}
